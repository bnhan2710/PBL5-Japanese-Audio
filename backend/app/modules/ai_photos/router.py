from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user
from app.modules.users.models import User
from app.modules.ai_photos.schemas import AIPhotoRequest, AIPhotoResponse
from app.modules.ai_photos.service import AIPhotoService

router = APIRouter(prefix="/ai_photos", tags=["ai_photos"])


def get_service():
    return AIPhotoService()


@router.post("/generate", response_model=AIPhotoResponse)
async def generate_ai_photo(
    request: AIPhotoRequest,
    service: AIPhotoService = Depends(get_service),
    _: User = Depends(get_current_user),
):
    """
    Generate an AI JLPT photo.
    - **context**: 1 image summarising the scene from script + answers + description.
    - **action**: 4 images (one per answer A/B/C/D) stitched into a 2×2 grid.
    """
    try:
        result = await service.generate(
            photo_type=request.photo_type,
            description=request.description,
            script=request.script,
            answers=request.answers,
        )
        return AIPhotoResponse(**result)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
