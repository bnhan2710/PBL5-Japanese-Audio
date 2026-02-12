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
    """
    Upload an image to Cloudinary and return the secure URL.
    """
    try:
        # Validate file type
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Upload to Cloudinary
        result = cloudinary.uploader.upload(
            file.file,
            folder=f"{settings.APP_NAME}/{folder}",
            resource_type="image"
        )
        
        return result.get("secure_url")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")
