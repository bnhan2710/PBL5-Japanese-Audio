from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.arena.schemas import (
    ContestCreateRequest,
    ContestJoinResponse,
    ContestListResponse,
    ContestResponse,
    ContestSubmitRequest,
    ContestSubmitResponse,
    ContestTakeResponse,
    ContestUpdateRequest,
)
from app.modules.arena.service import ArenaService
from app.modules.users.models import User

router = APIRouter(prefix="/arena/contests", tags=["arena"])


def get_arena_service(db: AsyncSession = Depends(get_db)) -> ArenaService:
    return ArenaService(db)


@router.get("", response_model=ContestListResponse)
async def list_contests(
    service: ArenaService = Depends(get_arena_service),
    current_user: User = Depends(get_current_user),
):
    contests = await service.list_contests(current_user)
    return ContestListResponse(contests=contests)


@router.post("", response_model=ContestResponse, status_code=201)
async def create_contest(
    payload: ContestCreateRequest,
    service: ArenaService = Depends(get_arena_service),
    current_user: User = Depends(get_current_user),
):
    return await service.create_contest(payload, current_user)


@router.get("/{contest_id}", response_model=ContestResponse)
async def get_contest(
    contest_id: UUID,
    service: ArenaService = Depends(get_arena_service),
    current_user: User = Depends(get_current_user),
):
    return await service.get_contest(contest_id, current_user)


@router.patch("/{contest_id}", response_model=ContestResponse)
async def update_contest(
    contest_id: UUID,
    payload: ContestUpdateRequest,
    service: ArenaService = Depends(get_arena_service),
    current_user: User = Depends(get_current_user),
):
    return await service.update_contest(contest_id, payload, current_user)


@router.post("/{contest_id}/join", response_model=ContestJoinResponse)
async def join_contest(
    contest_id: UUID,
    service: ArenaService = Depends(get_arena_service),
    current_user: User = Depends(get_current_user),
):
    contest = await service.join_contest(contest_id, current_user)
    return ContestJoinResponse(contest=contest, message="Đã tham gia cuộc thi")


@router.get("/{contest_id}/take", response_model=ContestTakeResponse)
async def get_contest_exam_for_take(
    contest_id: UUID,
    service: ArenaService = Depends(get_arena_service),
    current_user: User = Depends(get_current_user),
):
    contest, exam = await service.get_contest_exam_detail(contest_id, current_user)
    return ContestTakeResponse(contest=contest, exam=exam)


@router.post("/{contest_id}/submit", response_model=ContestSubmitResponse, status_code=201)
async def submit_contest(
    contest_id: UUID,
    payload: ContestSubmitRequest,
    service: ArenaService = Depends(get_arena_service),
    current_user: User = Depends(get_current_user),
):
    contest, submission = await service.submit_contest(contest_id, payload, current_user)
    return ContestSubmitResponse(contest=contest, submission=submission)
