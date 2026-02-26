from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class ExamBase(BaseModel):
    title: str = Field(..., description="Exam title")
    description: Optional[str] = Field(None, description="Exam description")
    time_limit: Optional[int] = Field(None, description="Time limit in minutes")
    audio_id: Optional[UUID] = Field(None, description="Associated audio UUID")


class ExamCreate(ExamBase):
    """Payload for creating a new exam."""
    pass


class ExamUpdate(BaseModel):
    """Fields that can be patched."""
    title: Optional[str] = None
    description: Optional[str] = None
    time_limit: Optional[int] = None
    current_step: Optional[int] = Field(None, ge=1, le=5, description="UI wizard step 1–5")
    is_published: Optional[bool] = None
    audio_id: Optional[UUID] = None


class ExamResponse(ExamBase):
    exam_id: UUID
    creator_id: Optional[int] = None
    current_step: int
    is_published: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "exam_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                "creator_id": 1,
                "audio_id": "1fa85f64-5717-4562-b3fc-2c963f66afb7",
                "title": "JLPT N3 – 2025 Practice",
                "description": "Official style N3 listening exam",
                "time_limit": 30,
                "current_step": 1,
                "is_published": False,
                "created_at": "2024-01-01T00:00:00",
                "updated_at": "2024-01-01T00:00:00"
            }
        }
    )


class ExamListResponse(BaseModel):
    """Paginated exam list."""
    exams: List[ExamResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
