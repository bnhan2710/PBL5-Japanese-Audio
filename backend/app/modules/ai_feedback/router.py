from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.database import get_db
from app.core.security import get_current_user
from app.db.models import User

from .schemas import AIFeedbackCreate, AIFeedbackResponse
from .service import AIFeedbackService

router = APIRouter(prefix="/ai-feedbacks", tags=["ai-feedbacks"])


@router.post("", response_model=AIFeedbackResponse, status_code=201)
async def create_feedback(
    feedback_data: AIFeedbackCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Tạo phản hồi đánh giá chất lượng cho nội dung AI sinh ra.
    """
    return await AIFeedbackService.create_feedback(db, current_user.id, feedback_data)


@router.get("/me", response_model=List[AIFeedbackResponse])
async def get_my_feedbacks(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy danh sách feedback của user hiện tại.
    """
    return await AIFeedbackService.get_feedbacks_by_user(db, current_user.id, skip, limit)
