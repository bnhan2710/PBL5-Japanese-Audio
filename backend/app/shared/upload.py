import cloudinary
import cloudinary.uploader
from fastapi import UploadFile, HTTPException
from app.core.config import get_settings

settings = get_settings()

# Configure Cloudinary
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True
)

async def upload_image(file: UploadFile, folder: str = "avatars") -> str:
    """Upload an image to Cloudinary and return the secure URL."""
    try:
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")
        result = cloudinary.uploader.upload(
            file.file,
            folder=f"{settings.APP_NAME}/{folder}",
            resource_type="image"
        )
        return result.get("secure_url")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")


async def upload_audio(file: UploadFile, folder: str = "question-audio") -> dict:
    """Upload an audio file to Cloudinary and return metadata (url, duration, public_id).
    
    Cloudinary uses resource_type='video' for audio files (mp3, wav, ogg, etc.).
    """
    try:
        content_type = file.content_type or ""
        if not (content_type.startswith("audio/") or content_type in ("application/octet-stream",)):
            raise HTTPException(
                status_code=400,
                detail=f"File must be an audio file (mp3, wav, ogg). Got: {content_type}"
            )
        result = cloudinary.uploader.upload(
            file.file,
            folder=f"{settings.APP_NAME}/{folder}",
            resource_type="video",  # Cloudinary treats audio as "video" resource
        )
        return {
            "secure_url": result.get("secure_url"),
            "public_id": result.get("public_id"),
            "duration": result.get("duration"),  # seconds (float)
            "format": result.get("format"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload audio: {str(e)}")
