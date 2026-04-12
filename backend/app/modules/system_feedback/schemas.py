from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class SystemFeedbackBase(BaseModel):
    rating_score: int = Field(..., ge=1, le=5, description="Điểm đánh giá từ 1 đến 5")
    feedback_tags: Optional[List[str]] = Field(default_factory=list, description="Nhãn góp ý")
    comment_text: Optional[str] = Field(default=None, description="Chi tiết góp ý")
    source_page: Optional[str] = Field(default=None, description="Trang phát sinh feedback")


class SystemFeedbackCreate(SystemFeedbackBase):
    pass


class SystemFeedbackResponse(SystemFeedbackBase):
    id: UUID
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
