import uuid
import json
import hashlib
import logging
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal, get_db
from app.core.security import get_current_user
from app.modules.users.models import User
from app.modules.audio.models import Audio
from app.modules.ai_exam.models import AIExamCache
from app.modules.ai_exam.schemas import (
    AIGenerateRequest,
    AIGenerateResponse,
    AIJobStatusResponse,
    AIExamResult,
    MondaiCountConfig,
)
from app.modules.ai_exam.service import AIExamService

router = APIRouter(prefix="/ai", tags=["ai"])
logger = logging.getLogger(__name__)

_jobs: dict[str, AIJobStatusResponse] = {}

# Eagerly load the AI Service and its ASR model at server startup
try:
    _service: Optional[AIExamService] = AIExamService()
    logger.info("AIExamService eagerly initialized at startup.")
except Exception as e:
    logger.warning(f"Could not initialize AIExamService eagerly: {e}")
    _service = None


def get_service() -> AIExamService:
    global _service
    if _service is None:
        _service = AIExamService()
    return _service


def _normalize_mondai_config(mondai_config: Optional[list]) -> str:
    if not mondai_config:
        return "[]"
    normalized = []
    for item in mondai_config:
        if hasattr(item, "model_dump"):
            normalized.append(item.model_dump())
        else:
            normalized.append(item)
    normalized.sort(key=lambda item: (item.get("mondai_id", 0), item.get("count", 0)))
    return json.dumps(normalized, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _compute_content_hash(audio_bytes: bytes) -> str:
    return hashlib.sha256(audio_bytes).hexdigest()


def _compute_cache_key(
    content_hash: str,
    jlpt_level: str,
    mondai_config: Optional[list],
    model_name: str,
    pipeline_version: str,
) -> str:
    key_payload = {
        "content_hash": content_hash,
        "jlpt_level": jlpt_level,
        "mondai_config": json.loads(_normalize_mondai_config(mondai_config)),
        "model_name": model_name,
        "pipeline_version": pipeline_version,
    }
    raw_key = json.dumps(key_payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def _job_from_result(
    job_id: str, result: AIExamResult, progress_message: str
) -> AIJobStatusResponse:
    return AIJobStatusResponse(
        job_id=job_id,
        status="done",
        progress_message=progress_message,
        result=result,
    )


async def _run_pipeline(
    job_id: str,
    cache_id: str,
    content_hash: str,
    audio_bytes: bytes,
    filename: str,
    jlpt_level: str,
    mondai_config: Optional[list],
    user_id: Optional[int] = None,
    exam_title: str = "",
):
    """Background task: run split-first AI pipeline and update job store."""
    from app.shared.upload import upload_audio_bytes
    from app.modules.notifications.service import create_notification

    job = _jobs.get(job_id)
    if not job:
        return

    try:
        job.status = "processing"

        def set_progress(message: str) -> None:
            current = _jobs.get(job_id)
            if current:
                current.progress_message = message

        set_progress("Step 1/7: Uploading raw audio to Cloudinary...")
        cloudinary_res = await upload_audio_bytes(
            audio_bytes,
            filename,
            public_id=content_hash,
        )
        public_id = cloudinary_res.get("public_id")
        fmt = cloudinary_res.get("format", "mp3")

        svc = get_service()

        import asyncio

        result: AIExamResult = await asyncio.to_thread(
            svc.generate,
            audio_bytes,
            filename,
            jlpt_level,
            mondai_config,
            public_id,
            fmt,
            set_progress,
        )

        async with AsyncSessionLocal() as db:
            cache = await db.get(AIExamCache, uuid.UUID(cache_id))
            if cache is None:
                raise RuntimeError("AI cache record not found during pipeline completion.")

            audio_result = await db.execute(select(Audio).where(Audio.content_hash == content_hash))
            audio = audio_result.scalar_one_or_none()
            if audio is None:
                audio = Audio(
                    file_name=filename,
                    content_hash=content_hash,
                    file_url=cloudinary_res["secure_url"],
                    duration=(
                        int(cloudinary_res["duration"]) if cloudinary_res.get("duration") else None
                    ),
                    ai_status="completed",
                    ai_model=svc.model_name,
                    raw_transcript=result.raw_transcript,
                )
                db.add(audio)
                await db.flush()
            else:
                audio.file_name = audio.file_name or filename
                audio.file_url = cloudinary_res["secure_url"]
                audio.duration = (
                    int(cloudinary_res["duration"])
                    if cloudinary_res.get("duration")
                    else audio.duration
                )
                audio.ai_status = "completed"
                audio.ai_model = svc.model_name
                audio.raw_transcript = result.raw_transcript

            cache.audio_id = audio.audio_id
            result.audio_id = str(audio.audio_id)
            result.audio_file_url = audio.file_url
            cache.source_filename = filename
            cache.status = "completed"
            cache.progress_message = f"Done! Generated {len(result.questions)} questions."
            cache.ai_model = svc.model_name
            cache.pipeline_version = svc.pipeline_version
            cache.cloudinary_public_id = public_id
            cache.cloudinary_format = fmt
            result.confidence_error_score = 0.10
            cache.result_json = result.model_dump_json()
            cache.error_message = None
            await db.commit()

        job.status = "done"
        job.progress_message = f"Done! Generated {len(result.questions)} questions."
        job.result = result

        if user_id:
            title_display = exam_title or filename
            await create_notification(
                user_id=user_id,
                title="Sinh đề AI hoàn thành!",
                message=f'Đề "{title_display}" ({jlpt_level}) đã được tạo xong với {len(result.questions)} câu hỏi. Nhấn để xem kết quả.',
                type="success",
                link=f"/exam/ai-create?job={job_id}",
            )

    except Exception as exc:
        logger.error(f"AI pipeline failed for job {job_id}: {exc}", exc_info=True)
        async with AsyncSessionLocal() as db:
            cache = await db.get(AIExamCache, uuid.UUID(cache_id))
            if cache is not None:
                cache.status = "failed"
                cache.progress_message = "Pipeline failed."
                cache.error_message = str(exc)
                await db.commit()
        job.status = "failed"
        job.error = str(exc)
        job.progress_message = "Pipeline failed."

        if user_id:
            await create_notification(
                user_id=user_id,
                title="Sinh đề AI thất bại",
                message=f'Đề "{exam_title or filename}" ({jlpt_level}) gặp lỗi trong quá trình xử lý.',
                type="error",
                link=f"/exam/ai-create",
            )


@router.post(
    "/generate-exam",
    response_model=AIGenerateResponse,
    status_code=202,
    summary="Generate JLPT exam from audio using AI (async)",
)
async def generate_exam_from_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(..., description="Full JLPT listening audio file (mp3/wav)"),
    jlpt_level: str = Form("N2", description="JLPT level: N5/N4/N3/N2/N1"),
    title: str = Form("", description="Exam title"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a full JLPT audio file → split by bell → transcribe each clip → generate exam asynchronously.
    Returns a `job_id` to poll for status.
    """
    if not file.content_type or not (
        file.content_type.startswith("audio/") or file.content_type in ("application/octet-stream",)
    ):
        raise HTTPException(
            status_code=400, detail=f"File must be audio (mp3/wav/ogg). Got: {file.content_type}"
        )

    audio_bytes = await file.read()
    filename = file.filename or "audio.mp3"
    svc = get_service()
    content_hash = _compute_content_hash(audio_bytes)
    mondai_config = None
    cache_key = _compute_cache_key(
        content_hash,
        jlpt_level,
        mondai_config,
        svc.model_name,
        svc.pipeline_version,
    )

    cache_result = await db.execute(select(AIExamCache).where(AIExamCache.cache_key == cache_key))
    cache = cache_result.scalar_one_or_none()

    if cache and cache.status == "completed" and cache.result_json:
        job_id = str(uuid.uuid4())
        result = AIExamResult.model_validate_json(cache.result_json)
        if result.audio_id:
            existing_audio = await db.get(Audio, uuid.UUID(result.audio_id))
            if existing_audio is None:
                result.audio_id = None
                result.audio_file_url = None
        _jobs[job_id] = _job_from_result(
            job_id,
            result,
            "Duplicate audio detected. Reused cached AI result.",
        )
        return AIGenerateResponse(
            job_id=job_id,
            status="done",
            progress_message="Duplicate audio detected. Reused cached AI result.",
        )

    if cache and cache.status == "processing" and cache.job_id and cache.job_id in _jobs:
        active_job = _jobs[cache.job_id]
        return AIGenerateResponse(
            job_id=cache.job_id,
            status=active_job.status,
            progress_message="Duplicate audio is already being processed. Reusing active job.",
        )

    if cache is None:
        cache = AIExamCache(
            cache_key=cache_key,
            content_hash=content_hash,
            source_filename=filename,
            jlpt_level=jlpt_level,
            mondai_config_json=_normalize_mondai_config(mondai_config),
            status="pending",
            ai_model=svc.model_name,
            pipeline_version=svc.pipeline_version,
            user_id=current_user.id,
        )
        db.add(cache)
        try:
            await db.flush()
        except IntegrityError:
            await db.rollback()
            cache_result = await db.execute(
                select(AIExamCache).where(AIExamCache.cache_key == cache_key)
            )
            cache = cache_result.scalar_one()
    else:
        cache.source_filename = filename
        cache.jlpt_level = jlpt_level
        cache.mondai_config_json = _normalize_mondai_config(mondai_config)
        cache.ai_model = svc.model_name
        cache.pipeline_version = svc.pipeline_version
        if cache.user_id is None:
            cache.user_id = current_user.id

    job_id = str(uuid.uuid4())
    cache.status = "processing"
    cache.job_id = job_id
    cache.error_message = None
    await db.commit()

    _jobs[job_id] = AIJobStatusResponse(
        job_id=job_id,
        status="pending",
        progress_message="Job queued. Starting pipeline...",
    )

    background_tasks.add_task(
        _run_pipeline,
        job_id=job_id,
        cache_id=str(cache.cache_id),
        content_hash=content_hash,
        audio_bytes=audio_bytes,
        filename=filename,
        jlpt_level=jlpt_level,
        mondai_config=mondai_config,
        user_id=current_user.id,
        exam_title=title,
    )

    return AIGenerateResponse(
        job_id=job_id,
        status="pending",
        progress_message="Job queued. Starting pipeline...",
    )


@router.get(
    "/job/{job_id}",
    response_model=AIJobStatusResponse,
    summary="Poll AI generation job status",
)
async def get_job_status(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Poll the status of an AI exam generation job."""
    job = _jobs.get(job_id)
    if job:
        return job

    cache_result = await db.execute(select(AIExamCache).where(AIExamCache.job_id == job_id))
    cache = cache_result.scalar_one_or_none()
    if cache is None:
        raise HTTPException(status_code=404, detail="Job not found")

    if cache.status == "completed" and cache.result_json:
        result = AIExamResult.model_validate_json(cache.result_json)
        if result.audio_id:
            existing_audio = await db.get(Audio, uuid.UUID(result.audio_id))
            if existing_audio is None:
                result.audio_id = None
                result.audio_file_url = None
        return AIJobStatusResponse(
            job_id=job_id,
            status="done",
            progress_message="Loaded completed AI result from persistent cache.",
            result=result,
        )
    if cache.status == "failed":
        return AIJobStatusResponse(
            job_id=job_id,
            status="failed",
            progress_message="Pipeline failed.",
            error=cache.error_message,
        )
    return AIJobStatusResponse(
        job_id=job_id,
        status="processing",
        progress_message="Job is still processing.",
    )


@router.delete(
    "/job/{job_id}",
    status_code=204,
    summary="Remove a completed/failed job from memory",
)
async def delete_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
):
    if job_id in _jobs:
        del _jobs[job_id]


@router.get(
    "/my-jobs",
    summary="List AI exam jobs for the current user",
)
async def list_my_jobs(
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a list of the current user's AI exam generation jobs (most recent first)."""
    result = await db.execute(
        select(AIExamCache)
        .where(AIExamCache.user_id == current_user.id)
        .order_by(AIExamCache.created_at.desc())
        .limit(limit)
    )
    caches = result.scalars().all()

    jobs = []
    for cache in caches:
        jobs.append(
            {
                "job_id": cache.job_id,
                "cache_id": str(cache.cache_id),
                "status": cache.status,
                "jlpt_level": cache.jlpt_level,
                "source_filename": cache.source_filename,
                "progress_message": cache.progress_message,
                "error_message": cache.error_message,
                "created_at": cache.created_at.isoformat() if cache.created_at else None,
                "updated_at": cache.updated_at.isoformat() if cache.updated_at else None,
            }
        )
    return {"jobs": jobs}
