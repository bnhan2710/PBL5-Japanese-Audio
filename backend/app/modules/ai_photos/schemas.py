from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional, List


class PhotoType(str, Enum):
    context = "context"
    action = "action"


class AIPhotoRequest(BaseModel):
    photo_type: PhotoType = Field(
        ..., description="Type: 'context' (1 image) or 'action' (4-image grid)"
    )
    description: str = Field(
        ..., description="User's narrative description to guide the image generation"
    )
    script: Optional[str] = Field(
        None, description="The JLPT listening exam script/conversation text"
    )
    answers: Optional[List[str]] = Field(
        None,
        description=(
            "For 'context': all options to help infer scene. "
            "For 'action': exactly 4 answer choices (A/B/C/D), one image each."
        ),
    )


class AIPhotoResponse(BaseModel):
    b64_image: str = Field(..., description="Base64 encoded PNG image (data URL)")
    info: Optional[str] = Field(None, description="Final prompt used for generation")
    storage_path: Optional[str] = Field(
        None, description="Local file path where the generated image is stored"
    )
