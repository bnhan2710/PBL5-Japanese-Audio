from celery import Celery

from app.core.config import get_settings

settings = get_settings()

broker_url = settings.CELERY_BROKER_URL or settings.REDIS_URL
result_backend = settings.CELERY_RESULT_BACKEND or broker_url

celery_app = Celery(
    "pbl5_japanese_audio",
    broker=broker_url,
    backend=result_backend,
    include=["app.modules.ai_exam.tasks"],
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Ho_Chi_Minh",
    enable_utc=False,
    task_always_eager=settings.CELERY_TASK_ALWAYS_EAGER,
)
