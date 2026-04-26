from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime


class AIFeedbackBase(BaseModel):
    content_id: UUID
    rating_score: int = Field(..., ge=1, le=5, description="Điểm đánh giá từ 1 đến 5")
    feedback_tags: Optional[List[str]] = Field(
        default_factory=list, description="Danh sách các nhãn lỗi"
    )
    comment_text: Optional[str] = Field(default=None, description="Chi tiết góp ý")
    ai_version: Optional[str] = Field(default=None, description="Phiên bản AI lúc sinh nội dung")


class AIFeedbackCreate(AIFeedbackBase):
    pass


class AIFeedbackResponse(AIFeedbackBase):
    id: UUID
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
