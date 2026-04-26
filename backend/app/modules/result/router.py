from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.result.schemas import UserResultListResponse
from app.modules.result.service import ResultService
from app.modules.users.models import User

router = APIRouter(prefix="/results", tags=["results"])


def get_result_service(db: AsyncSession = Depends(get_db)) -> ResultService:
    return ResultService(db)


@router.get("/me", response_model=UserResultListResponse)
async def get_my_results(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    service: ResultService = Depends(get_result_service),
    current_user: User = Depends(get_current_user),
):
    """
    Get the exam attempts (results) for the currently authenticated user.
    """
    return await service.get_user_results(current_user=current_user, page=page, page_size=page_size)


from uuid import UUID
from app.modules.result.schemas import CompetencyAnalysisResponse
from app.modules.result.competency_service import CompetencyAnalysisService


def get_competency_service(db: AsyncSession = Depends(get_db)) -> CompetencyAnalysisService:
    return CompetencyAnalysisService(db)


@router.get("/{result_id}/competency", response_model=CompetencyAnalysisResponse)
async def get_competency_analysis(
    result_id: UUID,
    service: CompetencyAnalysisService = Depends(get_competency_service),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve or generate the competency analysis for a specific exam result.
    Uses AI if not already generated.
    """
    return await service.get_or_create_analysis(result_id, current_user)
