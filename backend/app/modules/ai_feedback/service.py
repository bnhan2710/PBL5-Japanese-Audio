from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
import logging

from .models import AIFeedback
from .schemas import AIFeedbackCreate

logger = logging.getLogger(__name__)


class AIFeedbackService:
    @staticmethod
    async def create_feedback(
        db: AsyncSession, user_id: int, feedback_data: AIFeedbackCreate
    ) -> AIFeedback:
        """
        Create a new AI feedback entry.
        """
        try:
            db_feedback = AIFeedback(
                content_id=feedback_data.content_id,
                user_id=user_id,
                rating_score=feedback_data.rating_score,
                feedback_tags=feedback_data.feedback_tags,
                comment_text=feedback_data.comment_text,
                ai_version=feedback_data.ai_version,
            )
            db.add(db_feedback)
            await db.commit()
            await db.refresh(db_feedback)
            return db_feedback
        except Exception as e:
            await db.rollback()
            logger.error(f"Error creating AI feedback: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not save AI feedback.",
            )

    @staticmethod
    async def get_feedbacks_by_user(db: AsyncSession, user_id: int, skip: int = 0, limit: int = 20):
        """
        Get feedbacks authored by a specific user.
        """
        query = select(AIFeedback).where(AIFeedback.user_id == user_id).offset(skip).limit(limit)
        result = await db.execute(query)
        return result.scalars().all()
