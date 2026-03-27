from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.test.schemas import (
    TestExamDetailResponse,
    TestSubmitRequest,
    TestSubmitResponse,
)
from app.modules.test.service import TestService
from app.modules.users.models import User

router = APIRouter(prefix="/test", tags=["test"])


def get_test_service(db: AsyncSession = Depends(get_db)) -> TestService:
    return TestService(db)


@router.get("/exams/{exam_id}", response_model=TestExamDetailResponse)
async def get_exam_detail_for_test(
    exam_id: UUID,
    service: TestService = Depends(get_test_service),
    current_user: User = Depends(get_current_user),
):
    """Return a candidate-facing exam payload without exposing correct answers."""
    return await service.get_exam_detail(exam_id, current_user)


@router.post("/exams/{exam_id}/submit", response_model=TestSubmitResponse, status_code=201)
async def submit_exam_test(
    exam_id: UUID,
    payload: TestSubmitRequest,
    service: TestService = Depends(get_test_service),
    current_user: User = Depends(get_current_user),
):
    """Submit a completed exam and store the resulting score."""
    return await service.submit_exam(exam_id, payload, current_user)
