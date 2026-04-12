import logging

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import SystemFeedback
from .schemas import SystemFeedbackCreate

logger = logging.getLogger(__name__)


class SystemFeedbackService:
    @staticmethod
    async def create_feedback(
        db: AsyncSession,
        user_id: int,
        feedback_data: SystemFeedbackCreate,
    ) -> SystemFeedback:
        try:
            db_feedback = SystemFeedback(
                user_id=user_id,
                rating_score=feedback_data.rating_score,
                feedback_tags=feedback_data.feedback_tags,
                comment_text=feedback_data.comment_text,
                source_page=feedback_data.source_page,
            )
            db.add(db_feedback)
            await db.commit()
            await db.refresh(db_feedback)
            return db_feedback
        except Exception as exc:
            await db.rollback()
            logger.error("Error creating system feedback: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not save system feedback.",
            )

    @staticmethod
    async def get_feedbacks_by_user(
        db: AsyncSession,
        user_id: int,
        skip: int = 0,
        limit: int = 20,
    ):
        query = (
            select(SystemFeedback)
            .where(SystemFeedback.user_id == user_id)
            .offset(skip)
            .limit(limit)
        )
        result = await db.execute(query)
        return result.scalars().all()
