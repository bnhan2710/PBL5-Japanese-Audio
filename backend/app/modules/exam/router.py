from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import get_db
from app.core.security import get_current_user
from app.modules.users.models import User
from app.modules.exam.models import Exam
from app.modules.exam.schemas import ExamCreate, ExamUpdate, ExamResponse, ExamListResponse

router = APIRouter(prefix="/exams", tags=["exams"])


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
        audio_id=payload.audio_id,
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all exams (admin sees all, others see own)."""
    offset = (page - 1) * page_size

    base_query = select(Exam)
    if current_user.role != "admin":
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
    result = await db.execute(select(Exam).where(Exam.exam_id == exam_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam


@router.patch("/{exam_id}", response_model=ExamResponse)
async def update_exam(
    exam_id: UUID,
    payload: ExamUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Partially update exam fields (title, time_limit, current_step, is_published …)."""
    result = await db.execute(select(Exam).where(Exam.exam_id == exam_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(exam, field, value)

    await db.commit()
    await db.refresh(exam)
    return exam


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
    await db.delete(exam)
    await db.commit()
