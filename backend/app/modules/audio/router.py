from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import RoleChecker
from app.db.session import get_db
from app.modules.audio.models import Audio, TranscriptSegment
from app.modules.audio.schemas import AdminAudioListResponse, AdminAudioResponse
from app.modules.exam.models import Exam
from app.modules.users.models import User

router = APIRouter(prefix="/audios", tags=["audio"])


@router.get("", response_model=AdminAudioListResponse)
async def list_audios(
    q: str | None = Query(None, description="Search by file name, URL or transcript"),
    ai_status: str | None = Query(
        None,
        description="Filter by AI status (pending/processing/completed/failed)",
    ),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(RoleChecker(["admin"])),
):
    del admin
    filters = []
    if q:
        search_term = f"%{q.strip()}%"
        filters.append(
            or_(
                Audio.file_name.ilike(search_term),
                Audio.file_url.ilike(search_term),
                Audio.raw_transcript.ilike(search_term),
            )
        )
    if ai_status:
        filters.append(Audio.ai_status == ai_status)

    exam_count_subquery = (
        select(func.count(Exam.exam_id))
        .where(Exam.audio_id == Audio.audio_id)
        .correlate(Audio)
        .scalar_subquery()
    )
    segment_count_subquery = (
        select(func.count(TranscriptSegment.segment_id))
        .where(TranscriptSegment.audio_id == Audio.audio_id)
        .correlate(Audio)
        .scalar_subquery()
    )

    base_query = select(Audio, exam_count_subquery, segment_count_subquery)
    total_query = select(func.count(Audio.audio_id))

    if filters:
        base_query = base_query.where(*filters)
        total_query = total_query.where(*filters)

    total_result = await db.execute(total_query)
    total = total_result.scalar_one()

    query = (
        base_query.order_by(
            Audio.file_name.is_(None),
            Audio.file_name.asc(),
            Audio.audio_id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)

    audios = [
        AdminAudioResponse(
            audio_id=audio.audio_id,
            file_name=audio.file_name,
            file_url=audio.file_url,
            duration=audio.duration,
            ai_model=audio.ai_model,
            ai_status=audio.ai_status,
            raw_transcript=audio.raw_transcript,
            content_hash=audio.content_hash,
            exam_count=exam_count or 0,
            segment_count=segment_count or 0,
        )
        for audio, exam_count, segment_count in result.all()
    ]

    return AdminAudioListResponse(
        audios=audios,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )
