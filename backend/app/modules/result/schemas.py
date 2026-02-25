from uuid import UUID
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class UserResultCreate(BaseModel):
    """Payload submitted when a user finishes an exam."""
    exam_id: UUID = Field(..., description="Exam UUID")
    score: float = Field(..., description="Final score (e.g. 8.5)")
    total_questions: int = Field(..., description="Total number of questions")
    correct_answers: int = Field(..., description="Number of correct answers")


class UserResultResponse(BaseModel):
    result_id: UUID
    user_id: Optional[int] = None
    exam_id: Optional[UUID] = None
    score: Optional[float] = None
    total_questions: Optional[int] = None
    correct_answers: Optional[int] = None
    completed_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "result_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                "user_id": 1,
                "exam_id": "2fa85f64-5717-4562-b3fc-2c963f66afb8",
                "score": 8.5,
                "total_questions": 10,
                "correct_answers": 8,
                "completed_at": "2024-01-01T12:30:00"
            }
        }
    )


class UserResultListResponse(BaseModel):
    """Paginated results list."""
    results: List[UserResultResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ExamSummaryResponse(BaseModel):
    """Aggregate statistics for an exam (admin view)."""
    exam_id: UUID
    total_attempts: int
    average_score: Optional[float]
    highest_score: Optional[float]
    lowest_score: Optional[float]
