from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.security import get_current_user
from app.modules.users.models import User
from app.modules.exam.models import Exam
from app.modules.exam.schemas import ExamCreate, ExamUpdate, ExamResponse, ExamListResponse
import io
import httpx
from pydub import AudioSegment
from app.modules.audio.models import Audio
from app.modules.questions.models import Question
from app.shared.upload import upload_audio_bytes

router = APIRouter(prefix="/exams", tags=["exams"])


async def _resolve_audio_id(db: AsyncSession, audio_id: Optional[UUID]) -> Optional[UUID]:
    """Return audio_id only when it exists, otherwise detach exam from missing audio."""
    if audio_id is None:
        return None
    audio = await db.get(Audio, audio_id)
    return audio.audio_id if audio else None


@router.post("", response_model=ExamResponse, status_code=201)
async def create_exam(
    payload: ExamCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new exam draft."""
    exam = Exam(
        creator_id=current_user.id,
        title=payload.title,
        description=payload.description,
        time_limit=payload.time_limit,
        audio_id=await _resolve_audio_id(db, payload.audio_id),
        current_step=1,
        is_published=False,
    )
    db.add(exam)
    await db.commit()
    await db.refresh(exam)
    return exam


@router.get("", response_model=ExamListResponse)
async def list_exams(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    me_only: bool = Query(False),
    published_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all exams (admin sees all, others see own, or if me_only admin sees only own)."""
    offset = (page - 1) * page_size

    base_query = select(Exam).options(selectinload(Exam.audio))

    if published_only:
        base_query = base_query.where(Exam.is_published == True)
        if me_only:
            base_query = base_query.where(Exam.creator_id == current_user.id)
    else:
        if current_user.role != "admin" or me_only:
            base_query = base_query.where(Exam.creator_id == current_user.id)

    total_result = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total = total_result.scalar_one()

    result = await db.execute(
        base_query.order_by(Exam.created_at.desc()).offset(offset).limit(page_size)
    )
    exams = result.scalars().all()

    return ExamListResponse(
        exams=exams,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{exam_id}", response_model=ExamResponse)
async def get_exam(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Exam).options(selectinload(Exam.audio)).where(Exam.exam_id == exam_id)
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam


def _check_exam_permission(exam: Exam, user: User):
    """Raise Forbidden if user is not admin and not the creator of the exam."""
    if user.role != "admin" and exam.creator_id != user.id:
        raise HTTPException(
            status_code=403, detail="You do not have permission to modify this exam."
        )


@router.patch("/{exam_id}", response_model=ExamResponse)
async def update_exam(
    exam_id: UUID,
    payload: ExamUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Partially update exam fields (title, time_limit, current_step, is_published …)."""
    result = await db.execute(
        select(Exam).options(selectinload(Exam.audio)).where(Exam.exam_id == exam_id)
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    _check_exam_permission(exam, current_user)

    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "audio_id":
            exam.audio_id = await _resolve_audio_id(db, value)
            continue
        setattr(exam, field, value)

    await db.commit()
    await db.refresh(exam)
    return exam


@router.post("/{exam_id}/merge-audio", response_model=ExamResponse)
async def merge_exam_audio(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Merge all audio clips from questions into a single audio file for the exam."""
    result = await db.execute(
        select(Exam).options(selectinload(Exam.audio)).where(Exam.exam_id == exam_id)
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    _check_exam_permission(exam, current_user)

    q_result = await db.execute(
        select(Question)
        .where(Question.exam_id == exam_id)
        .order_by(Question.mondai_group, Question.question_number)
    )
    questions = q_result.scalars().all()

    audio_urls = [q.audio_clip_url for q in questions if q.audio_clip_url]
    if not audio_urls:
        raise HTTPException(status_code=400, detail="Cannot merge: No questions have audio clips.")

    merged_audio = AudioSegment.empty()
    silence = AudioSegment.silent(duration=2000)

    try:
        async with httpx.AsyncClient() as client:
            for i, url in enumerate(audio_urls):
                r = await client.get(url, timeout=30.0)
                if r.status_code == 200:
                    audio_file = io.BytesIO(r.content)
                    try:
                        segment = AudioSegment.from_file(audio_file)
                        if i > 0:
                            merged_audio += silence
                        merged_audio += segment
                    except Exception as e:
                        print(f"Error parsing audio for {url}: {e}")
                else:
                    print(f"Failed to download audio for {url}: {r.status_code}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download audio files: {e}")

    out_f = io.BytesIO()
    merged_audio.export(out_f, format="mp3", bitrate="128k")
    out_f.seek(0)

    from uuid import uuid4

    upload_res = await upload_audio_bytes(
        out_f.read(), filename=f"exam_merged_{uuid4().hex[:8]}.mp3", folder="merged-audio"
    )

    new_audio = Audio(
        file_url=upload_res["secure_url"],
        content_hash=f"merged_{uuid4().hex[:8]}",
        duration=int(upload_res.get("duration", 0)),
        file_name=f"exam_merged_{uuid4().hex[:8]}.mp3",
    )
    db.add(new_audio)
    await db.flush()

    exam.audio_id = new_audio.audio_id
    await db.commit()

    result = await db.execute(
        select(Exam).options(selectinload(Exam.audio)).where(Exam.exam_id == exam_id)
    )
    final_exam = result.scalar_one()

    return final_exam


@router.delete("/{exam_id}", status_code=204)
async def delete_exam(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Exam).where(Exam.exam_id == exam_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    _check_exam_permission(exam, current_user)

    await db.delete(exam)
    await db.commit()
