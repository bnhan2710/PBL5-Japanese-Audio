from fastapi import APIRouter, Depends, UploadFile, File
from app.core.security import get_current_user
from app.modules.users.models import User
from app.shared.upload import upload_image, upload_audio

router = APIRouter(prefix="/upload", tags=["upload"])

@router.post("/image", response_model=dict)
async def api_upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload an image to Cloudinary and return the secure URL."""
    url = await upload_image(file, folder="manual-exam-images")
    return {"secure_url": url}


@router.post("/audio", response_model=dict)
async def api_upload_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload an audio file to Cloudinary and return metadata."""
    result = await upload_audio(file, folder="manual-exam-audio")
    return result
