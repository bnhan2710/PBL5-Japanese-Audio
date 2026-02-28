import uuid
import logging
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, BackgroundTasks, HTTPException, Depends
from fastapi.responses import JSONResponse

from app.core.security import get_current_user
from app.modules.users.models import User
from app.modules.ai_exam.schemas import (
    AIGenerateRequest, AIGenerateResponse, AIJobStatusResponse,
    AIExamResult, MondaiCountConfig
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


async def _run_pipeline(
    job_id: str,
    audio_bytes: bytes,
    filename: str,
    jlpt_level: str,
    mondai_config: Optional[list],
):
    """Background task: run hybrid AI pipeline and update job store."""
    from app.shared.upload import upload_audio_bytes
    job = _jobs.get(job_id)
    if not job:
        return

    try:
        job.status = "processing"
        
        job.progress_message = "Step 1/6: Uploading raw audio to Cloudinary..."
        cloudinary_res = await upload_audio_bytes(audio_bytes, filename)
        public_id = cloudinary_res.get("public_id")
        fmt = cloudinary_res.get("format", "mp3")

        job.progress_message = "Step 2/6: ReazonSpeech transcribing audio..."
        svc = get_service()

        job.progress_message = "Step 3/6: Uploading audio to Gemini..."

        import asyncio
        result: AIExamResult = await asyncio.to_thread(
            svc.generate,
            audio_bytes,
            filename,
            jlpt_level,
            mondai_config,
            public_id,
            fmt,
        )

        job.status = "done"
        job.progress_message = f"Done! Generated {len(result.questions)} questions."
        job.result = result

    except Exception as exc:
        logger.error(f"AI pipeline failed for job {job_id}: {exc}", exc_info=True)
        job.status = "failed"
        job.error = str(exc)
        job.progress_message = "Pipeline failed."


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
    current_user: User = Depends(get_current_user),
):
    """
    Upload a full JLPT audio file → run hybrid ReazonSpeech + Gemini pipeline asynchronously.
    Returns a `job_id` to poll for status.
    """
    if not file.content_type or not (
        file.content_type.startswith("audio/")
        or file.content_type in ("application/octet-stream",)
    ):
        raise HTTPException(
            status_code=400,
            detail=f"File must be audio (mp3/wav/ogg). Got: {file.content_type}"
        )

    audio_bytes = await file.read()
    filename = file.filename or "audio.mp3"
    job_id = str(uuid.uuid4())

    # Create pending job
    _jobs[job_id] = AIJobStatusResponse(
        job_id=job_id,
        status="pending",
        progress_message="Job queued. Starting pipeline...",
    )

    background_tasks.add_task(
        _run_pipeline,
        job_id=job_id,
        audio_bytes=audio_bytes,
        filename=filename,
        jlpt_level=jlpt_level,
        mondai_config=None,  # future: parse from Form JSON
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
    current_user: User = Depends(get_current_user),
):
    """Poll the status of an AI exam generation job."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


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
