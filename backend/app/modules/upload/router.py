from fastapi import APIRouter, Depends, UploadFile, File
from app.shared.upload import upload_image, upload_audio
from app.core.security import get_current_user
from app.modules.users.models import User

router = APIRouter(prefix="/upload", tags=["upload"])

@router.post("/image", summary="Upload an image file (general use)")
async def upload_image_endpoint(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
):
    """
    Tải ảnh lên Cloudinary và trả về thông tin (secure_url)
    """
    secure_url = await upload_image(file, folder="images")
    return {"secure_url": secure_url}

@router.post("/audio", summary="Upload an audio file (general use)")
async def upload_audio_endpoint(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
):
    """
    Tải audio (mp3, wav, ogg) lên Cloudinary và trả về thông tin
    """
    result = await upload_audio(file, folder="audios")
    return result
