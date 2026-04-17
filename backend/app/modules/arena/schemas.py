from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.modules.test.schemas import TestExamDetailResponse, TestSubmitRequest, TestSubmitResponse


JLPTLevel = Literal["N5", "N4", "N3", "N2", "N1"]


class ContestCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    min_jlpt_level: JLPTLevel = "N5"
    max_participants: Optional[int] = Field(None, ge=1)
    time_limit: int = Field(..., ge=1)
    start_time: datetime
    end_time: datetime
    exam_id: UUID


class ContestParticipantSummary(BaseModel):
    user_id: int
    result_id: Optional[UUID] = None
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ContestLeaderboardEntry(BaseModel):
    user_id: int
    username: str
    display_name: str
    avatar_url: Optional[str] = None
    score: float
    rank: int
    joined_at: datetime


class ContestResponse(BaseModel):
    contest_id: UUID
    title: str
    description: Optional[str] = None
    min_jlpt_level: JLPTLevel
    max_participants: Optional[int] = None
    time_limit: int
    start_time: datetime
    end_time: datetime
    creator_id: Optional[int] = None
    exam_id: UUID
    exam_title: str
    participant_count: int
    joined: bool = False
    joined_at: Optional[datetime] = None
    result_id: Optional[UUID] = None
    leaderboard: list[ContestLeaderboardEntry] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ContestListResponse(BaseModel):
    contests: list[ContestResponse]


class ContestJoinResponse(BaseModel):
    contest: ContestResponse
    message: str


class ContestTakeResponse(BaseModel):
    contest: ContestResponse
    exam: TestExamDetailResponse


class ContestSubmitRequest(TestSubmitRequest):
    pass


class ContestSubmitResponse(BaseModel):
    contest: ContestResponse
    submission: TestSubmitResponse
