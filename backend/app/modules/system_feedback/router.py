from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.users.models import User

from .schemas import SystemFeedbackCreate, SystemFeedbackResponse
from .service import SystemFeedbackService

router = APIRouter(prefix="/system-feedbacks", tags=["system-feedbacks"])


@router.post("", response_model=SystemFeedbackResponse, status_code=201)
async def create_feedback(
    feedback_data: SystemFeedbackCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await SystemFeedbackService.create_feedback(db, current_user.id, feedback_data)


@router.get("/me", response_model=List[SystemFeedbackResponse])
async def get_my_feedbacks(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await SystemFeedbackService.get_feedbacks_by_user(db, current_user.id, skip, limit)
