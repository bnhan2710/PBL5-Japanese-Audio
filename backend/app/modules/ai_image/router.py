import uuid
import logging
from typing import Dict
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException

from app.core.security import get_current_user
from app.modules.users.models import User
from app.modules.ai_image.schemas import (
    AIImageTaskRequest, AIImageJobStatus, AIImageResponse
)
from app.modules.ai_image.service import AIImageService

router = APIRouter(prefix="/ai-image", tags=["ai-image"])
logger = logging.getLogger(__name__)

# Quản lý trạng thái job
_image_jobs: Dict[str, AIImageJobStatus] = {}

# Khởi tạo service một lần duy nhất (hoặc dùng Depends ở endpoint)
_image_service = AIImageService()

def get_image_service() -> AIImageService:
    return _image_service

async def _run_image_pipeline(job_id: str, payload: AIImageTaskRequest):
    """Luồng chạy ngầm để sinh ảnh và ghép khung."""
    job = _image_jobs.get(job_id)
    if not job:
        return

    try:
        # Chuyển trạng thái sang processing
        job.status = "processing"
        job.progress_message = "Step 1/3: Gemini analyzing script & planning visuals..."
        
        # Sử dụng service đã khởi tạo
        svc = get_image_service()
        
        # Thực hiện logic chính
        # Lưu ý: generate_quad_visual nên cập nhật progress nội bộ nếu được
        result = await svc.generate_quad_visual(payload)

        job.status = "done"
        job.result = result
        job.progress_message = "Successfully generated quad-image."

    except Exception as e:
        logger.error(f"Image generation failed for job {job_id}: {e}", exc_info=True)
        job.status = "failed"
        job.error = str(e)
        job.progress_message = f"Failed: {str(e)}"

@router.post(
    "/generate", 
    status_code=202, 
    response_model=AIImageResponse,
    summary="Tạo ảnh 4 ô cho câu hỏi nghe (Async)"
)
async def generate_visual(
    payload: AIImageTaskRequest,
    background_tasks: BackgroundTasks,
    # current_user: User = Depends(get_current_user)
):
    job_id = str(uuid.uuid4())
    
    # Khởi tạo job với giá trị mặc định từ Schema
    new_job = AIImageJobStatus(
        job_id=job_id,
        status="pending",
        progress_message="Image task queued..."
    )
    _image_jobs[job_id] = new_job

    background_tasks.add_task(_run_image_pipeline, job_id, payload)

    # Trả về job_id để frontend bắt đầu polling
    return AIImageResponse(job_id=job_id, status="pending")

@router.get("/job/{job_id}", response_model=AIImageJobStatus)
async def get_image_job_status(
    job_id: str, 
    current_user: User = Depends(get_current_user)
):
    job = _image_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job không tồn tại hoặc đã bị xóa")
    return job

@router.delete("/job/{job_id}", status_code=204)
async def delete_image_job(
    job_id: str, 
    # current_user: User = Depends(get_current_user)
):
    if job_id in _image_jobs:
        del _image_jobs[job_id]
        return
    raise HTTPException(status_code=404, detail="Job không tồn tại")