from typing import List
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.modules.exam.models import Exam
from app.modules.result.models import UserResult
from app.modules.result.schemas import UserResultListResponse, UserResultResponse
from app.modules.users.models import User


class ResultService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_results(
        self,
        current_user: User,
        page: int = 1,
        page_size: int = 10,
    ) -> UserResultListResponse:
        """Fetch exam attempts for the current user."""
        
        # Base query for results belonging to user
        base_query = select(UserResult).where(UserResult.user_id == current_user.id)
        
        # Get total count
        count_query = select(func.count()).select_from(base_query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0
        
        # Get paginated results with joined Exam
        query = (
            base_query.options(joinedload(UserResult.exam))
            .order_by(desc(UserResult.completed_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        
        db_results = await self.db.execute(query)
        results = db_results.scalars().all()
        
        # Format response
        serialized_results = []
        for r in results:
            exam_title = r.exam.title if r.exam else "Đề thi không xác định"
            serialized_results.append(UserResultResponse(
                result_id=r.result_id,
                user_id=r.user_id,
                exam_id=r.exam_id,
                exam_title=exam_title,
                score=r.score,
                total_questions=r.total_questions,
                correct_answers=r.correct_answers,
                completed_at=r.completed_at
            ))
            
        total_pages = (total + page_size - 1) // page_size if total > 0 else 0
        
        return UserResultListResponse(
            results=serialized_results,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
