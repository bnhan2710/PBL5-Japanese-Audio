from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.arena.models import Contest, ContestParticipant
from app.modules.arena.schemas import ContestCreateRequest, ContestLeaderboardEntry, ContestResponse
from app.modules.exam.models import Exam
from app.modules.questions.models import Question
from app.modules.result.models import UserResult
from app.modules.test.schemas import TestExamDetailResponse, TestSubmitRequest, TestSubmitResponse
from app.modules.test.service import TestService
from app.modules.users.models import User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_naive_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.replace(tzinfo=None)


class ArenaService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.test_service = TestService(db)

    async def _get_contest_entity(self, contest_id: UUID) -> Contest:
        result = await self.db.execute(
            select(Contest)
            .options(
                selectinload(Contest.exam).selectinload(Exam.audio),
                selectinload(Contest.exam).selectinload(Exam.questions).selectinload(Question.answers),
                selectinload(Contest.participants).selectinload(ContestParticipant.user),
                selectinload(Contest.participants).selectinload(ContestParticipant.result),
            )
            .where(Contest.contest_id == contest_id)
        )
        contest = result.scalar_one_or_none()
        if not contest:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contest not found")
        return contest

    def _build_leaderboard(self, contest: Contest) -> list[ContestLeaderboardEntry]:
        ranked = sorted(
            [participant for participant in contest.participants if participant.result is not None],
            key=lambda participant: (
                -(participant.result.score or 0.0),
                participant.result.completed_at,
                participant.joined_at,
            ),
        )

        leaderboard: list[ContestLeaderboardEntry] = []
        for index, participant in enumerate(ranked, start=1):
            user = participant.user
            username = getattr(user, "username", f"user-{participant.user_id}")
            first_name = getattr(user, "first_name", None)
            last_name = getattr(user, "last_name", None)
            display_name = (
                f"{first_name} {last_name}".strip()
                if first_name or last_name
                else username
            )
            leaderboard.append(
                ContestLeaderboardEntry(
                    user_id=participant.user_id,
                    username=username,
                    display_name=display_name,
                    avatar_url=getattr(user, "avatar_url", None),
                    score=round(participant.result.score or 0.0, 2),
                    rank=index,
                    joined_at=participant.joined_at,
                )
            )
        return leaderboard

    def _serialize_contest(self, contest: Contest, current_user: User) -> ContestResponse:
        participant = next((item for item in contest.participants if item.user_id == current_user.id), None)
        return ContestResponse(
            contest_id=contest.contest_id,
            title=contest.title,
            description=contest.description,
            min_jlpt_level=contest.min_jlpt_level,
            max_participants=contest.max_participants,
            time_limit=contest.time_limit,
            start_time=contest.start_time,
            end_time=contest.end_time,
            creator_id=contest.creator_id,
            exam_id=contest.exam_id,
            exam_title=contest.exam.title if contest.exam else "Đề thi JLPT",
            participant_count=len(contest.participants),
            joined=participant is not None,
            joined_at=participant.joined_at if participant else None,
            result_id=participant.result_id if participant else None,
            leaderboard=self._build_leaderboard(contest),
            created_at=contest.created_at,
            updated_at=contest.updated_at,
        )

    async def list_contests(self, current_user: User) -> list[ContestResponse]:
        result = await self.db.execute(
            select(Contest)
            .options(
                selectinload(Contest.exam),
                selectinload(Contest.participants).selectinload(ContestParticipant.user),
                selectinload(Contest.participants).selectinload(ContestParticipant.result),
            )
            .order_by(Contest.start_time.desc())
        )
        contests = result.scalars().unique().all()
        return [self._serialize_contest(contest, current_user) for contest in contests]

    async def get_contest(self, contest_id: UUID, current_user: User) -> ContestResponse:
        contest = await self._get_contest_entity(contest_id)
        return self._serialize_contest(contest, current_user)

    async def create_contest(self, payload: ContestCreateRequest, current_user: User) -> ContestResponse:
        start_time = _normalize_naive_utc(payload.start_time)
        end_time = _normalize_naive_utc(payload.end_time)

        if end_time <= start_time:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="End time must be after start time")

        exam = await self.db.get(Exam, payload.exam_id)
        if not exam:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
        if exam.creator_id != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot use this exam")

        contest = Contest(
            title=payload.title,
            description=payload.description,
            min_jlpt_level=payload.min_jlpt_level,
            max_participants=payload.max_participants,
            time_limit=payload.time_limit,
            start_time=start_time,
            end_time=end_time,
            creator_id=current_user.id,
            exam_id=payload.exam_id,
        )
        self.db.add(contest)
        await self.db.commit()
        await self.db.refresh(contest)
        contest = await self._get_contest_entity(contest.contest_id)
        return self._serialize_contest(contest, current_user)

    async def join_contest(self, contest_id: UUID, current_user: User) -> ContestResponse:
        contest = await self._get_contest_entity(contest_id)
        now = _utcnow()
        contest_end = contest.end_time.replace(tzinfo=timezone.utc)

        if contest_end < now:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contest has expired")

        existing = next((item for item in contest.participants if item.user_id == current_user.id), None)
        if existing:
            return self._serialize_contest(contest, current_user)

        if contest.max_participants is not None and len(contest.participants) >= contest.max_participants:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contest is full")

        participant = ContestParticipant(contest_id=contest.contest_id, user_id=current_user.id)
        self.db.add(participant)
        await self.db.commit()
        contest = await self._get_contest_entity(contest_id)
        return self._serialize_contest(contest, current_user)

    async def get_contest_exam_detail(
        self, contest_id: UUID, current_user: User
    ) -> tuple[ContestResponse, TestExamDetailResponse]:
        contest = await self._get_contest_entity(contest_id)
        participant = next((item for item in contest.participants if item.user_id == current_user.id), None)
        if not participant:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Join the contest first")

        exam_detail = self.test_service._build_exam_detail_response(contest.exam)
        exam_detail.time_limit = contest.time_limit
        return self._serialize_contest(contest, current_user), exam_detail

    async def submit_contest(
        self,
        contest_id: UUID,
        payload: TestSubmitRequest,
        current_user: User,
    ) -> tuple[ContestResponse, TestSubmitResponse]:
        contest = await self._get_contest_entity(contest_id)
        participant = next((item for item in contest.participants if item.user_id == current_user.id), None)
        if not participant:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Join the contest first")
        if participant.result_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contest already submitted")

        submission = await self.test_service._submit_exam_from_entity(contest.exam, payload, current_user)

        result = await self.db.get(UserResult, submission.result_id)
        if result:
            result.contest_id = contest.contest_id
        participant.result_id = submission.result_id
        await self.db.commit()

        contest = await self._get_contest_entity(contest_id)
        return self._serialize_contest(contest, current_user), submission
