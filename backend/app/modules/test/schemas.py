from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TestAnswerOptionResponse(BaseModel):
    answer_id: UUID
    content: Optional[str] = None
    image_url: Optional[str] = None
    order_index: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class TestQuestionResponse(BaseModel):
    question_id: UUID
    mondai_group: Optional[str] = None
    question_number: Optional[int] = None
    audio_clip_url: Optional[str] = None
    question_text: Optional[str] = None
    image_url: Optional[str] = None
    difficulty: Optional[int] = Field(None, description="IRT difficulty (1-5 stars)")
    answers: List[TestAnswerOptionResponse]

    model_config = ConfigDict(from_attributes=True)


class TestMondaiGroupResponse(BaseModel):
    label: str
    question_count: int
    start_number: Optional[int] = None
    end_number: Optional[int] = None


class TestExamDetailResponse(BaseModel):
    exam_id: UUID
    title: str
    description: Optional[str] = None
    time_limit: Optional[int] = None
    is_published: bool
    audio_url: Optional[str] = None
    total_questions: int
    mondai_groups: List[TestMondaiGroupResponse]
    questions: List[TestQuestionResponse]


class TestSubmissionAnswer(BaseModel):
    question_id: UUID
    answer_id: Optional[UUID] = Field(None, description="Selected answer option for the question")


class TestSubmitRequest(BaseModel):
    answers: List[TestSubmissionAnswer] = Field(default_factory=list)
    elapsed_seconds: Optional[int] = Field(None, ge=0)


class TestSubmitResponse(BaseModel):
    result_id: UUID
    exam_id: UUID
    score: float = Field(..., description="IRT score from 0 to 60")
    total_questions: int
    correct_answers: int
    answered_questions: int
    completed_at: datetime
