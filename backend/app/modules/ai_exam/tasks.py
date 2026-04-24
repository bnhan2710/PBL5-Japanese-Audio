import asyncio
import base64
import logging
import uuid
from typing import Optional

from sqlalchemy import select

from app.core.celery_app import celery_app
from app.db.session import AsyncSessionLocal
from app.modules.ai_exam.models import AIExamCache
from app.modules.ai_exam.schemas import AIExamResult
from app.modules.ai_exam.service import AIExamService, MODEL_NAME, PIPELINE_VERSION
from app.modules.audio.models import Audio
from app.modules.exam.models import Exam  # noqa: F401
from app.modules.questions.models import Question, Answer  # noqa: F401
from app.modules.result.models import UserResult  # noqa: F401
from app.modules.ai_feedback.models import AIFeedback  # noqa: F401
from app.modules.users.models import User  # noqa: F401
from app.shared.upload import upload_audio_bytes

logger = logging.getLogger(__name__)

_service: Optional[AIExamService] = None


def get_service() -> AIExamService:
    global _service
    if _service is None:
        _service = AIExamService()
    return _service


async def _update_cache_status(
    cache_id: str,
    *,
    status: Optional[str] = None,
    progress_message: Optional[str] = None,
    error_message: Optional[str] = None,
    result: Optional[AIExamResult] = None,
    filename: Optional[str] = None,
    content_hash: Optional[str] = None,
    cloudinary_res: Optional[dict] = None,
) -> None:
    async with AsyncSessionLocal() as db:
        cache = await db.get(AIExamCache, uuid.UUID(cache_id))
        if cache is None:
            raise RuntimeError("AI cache record not found.")

        if status is not None:
            cache.status = status
        if progress_message is not None:
            cache.progress_message = progress_message
        if error_message is not None or status == "failed":
            cache.error_message = error_message

        if result is not None:
            audio_result = await db.execute(select(Audio).where(Audio.content_hash == content_hash))
            audio = audio_result.scalar_one_or_none()
            if audio is None:
                audio = Audio(
                    file_name=filename,
                    content_hash=content_hash,
                    file_url=cloudinary_res["secure_url"],
                    duration=int(cloudinary_res["duration"]) if cloudinary_res.get("duration") else None,
                    ai_status="completed",
                    ai_model=MODEL_NAME,
                    raw_transcript=result.raw_transcript,
                )
                db.add(audio)
                await db.flush()
            else:
                audio.file_name = audio.file_name or filename
                audio.file_url = cloudinary_res["secure_url"]
                audio.duration = int(cloudinary_res["duration"]) if cloudinary_res.get("duration") else audio.duration
                audio.ai_status = "completed"
                audio.ai_model = MODEL_NAME
                audio.raw_transcript = result.raw_transcript

            cache.audio_id = audio.audio_id
            result.audio_id = str(audio.audio_id)
            result.audio_file_url = audio.file_url
            cache.source_filename = filename
            cache.ai_model = MODEL_NAME
            cache.pipeline_version = PIPELINE_VERSION
            cache.cloudinary_public_id = cloudinary_res.get("public_id")
            cache.cloudinary_format = cloudinary_res.get("format", "mp3")
            cache.result_json = result.model_dump_json()
            cache.error_message = None

        await db.commit()


async def _run_generate_exam_task(
    *,
    job_id: str,
    cache_id: str,
    content_hash: str,
    audio_base64: str,
    filename: str,
    jlpt_level: str,
    mondai_config: Optional[list] = None,
    user_id: Optional[int] = None,
    exam_title: str = "",
) -> None:
    from app.modules.notifications.service import create_notification

    try:
        cloudinary_res: Optional[dict] = None
        audio_bytes = base64.b64decode(audio_base64.encode("ascii"))
        loop = asyncio.get_running_loop()

        await _update_cache_status(
            cache_id,
            status="processing",
            progress_message="Step 1/7: Uploading raw audio to Cloudinary...",
            error_message=None,
        )
        cloudinary_res = await upload_audio_bytes(
            audio_bytes,
            filename,
            public_id=content_hash,
        )

        service = get_service()

        def set_progress(message: str) -> None:
            future = asyncio.run_coroutine_threadsafe(
                _update_cache_status(
                    cache_id,
                    status="processing",
                    progress_message=message,
                ),
                loop,
            )
            future.result()

        result = await asyncio.to_thread(
            service.generate,
            audio_bytes,
            filename,
            jlpt_level,
            mondai_config,
            cloudinary_res.get("public_id"),
            cloudinary_res.get("format", "mp3"),
            set_progress,
        )

        await _update_cache_status(
            cache_id,
            status="completed",
            progress_message=f"Done! Generated {len(result.questions)} questions.",
            result=result,
            filename=filename,
            content_hash=content_hash,
            cloudinary_res=cloudinary_res,
        )

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
        logger.error("AI pipeline failed for job %s: %s", job_id, exc, exc_info=True)
        await _update_cache_status(
            cache_id,
            status="failed",
            progress_message="Pipeline failed.",
            error_message=str(exc),
        )
        if user_id:
            from app.modules.notifications.service import create_notification
            await create_notification(
                user_id=user_id,
                title="Sinh đề AI thất bại",
                message=f'Đề "{exam_title or filename}" ({jlpt_level}) gặp lỗi trong quá trình xử lý.',
                type="error",
                link="/exam/ai-create",
            )
        raise


@celery_app.task(name="app.modules.ai_exam.generate_exam")
def generate_exam_task(
    *,
    job_id: str,
    cache_id: str,
    content_hash: str,
    audio_base64: str,
    filename: str,
    jlpt_level: str,
    mondai_config: Optional[list] = None,
    user_id: Optional[int] = None,
    exam_title: str = "",
) -> None:
    """Run the AI exam generation pipeline in a Celery worker."""
    asyncio.run(
        _run_generate_exam_task(
            job_id=job_id,
            cache_id=cache_id,
            content_hash=content_hash,
            audio_base64=audio_base64,
            filename=filename,
            jlpt_level=jlpt_level,
            mondai_config=mondai_config,
            user_id=user_id,
            exam_title=exam_title,
        )
    )
