from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


# ---------------------------------------------------------------------------
# Answer schemas
# ---------------------------------------------------------------------------

class AnswerBase(BaseModel):
    content: Optional[str] = Field(None, description="Text content of the answer option")
    image_url: Optional[str] = Field(None, description="Image URL if answer is image-based")
    is_correct: bool = Field(False, description="Whether this is the correct answer")
    order_index: Optional[int] = Field(None, description="Display order: 0=A, 1=B, 2=C, 3=D")


class AnswerCreate(AnswerBase):
    """Payload for creating an answer. question_id supplied by the route."""
    question_id: UUID


class AnswerUpdate(BaseModel):
    content: Optional[str] = None
    image_url: Optional[str] = None
    is_correct: Optional[bool] = None
    order_index: Optional[int] = None


class AnswerResponse(AnswerBase):
    answer_id: UUID
    question_id: UUID

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "answer_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                "question_id": "1fa85f64-5717-4562-b3fc-2c963f66afb7",
                "content": "午前9時",
                "image_url": None,
                "is_correct": True,
                "order_index": 0
            }
        }
    )


# ---------------------------------------------------------------------------
# Question schemas
# ---------------------------------------------------------------------------

class QuestionBase(BaseModel):
    mondai_group: Optional[str] = Field(None, description="e.g. 'Mondai 1'")
    question_number: Optional[int] = Field(None, description="Question number within the group")
    audio_clip_url: Optional[str] = Field(None, description="URL for the specific audio clip")
    question_text: Optional[str] = Field(None, description="Question text")
    image_url: Optional[str] = Field(None, description="Image URL for image-type questions")
    explanation: Optional[str] = Field(None, description="Explanation for the correct answer")


class QuestionCreate(QuestionBase):
    """Payload for creating a question. exam_id supplied by the route."""
    exam_id: UUID
    answers: Optional[List[AnswerCreate]] = Field(default_factory=list, description="Inline answers (optional)")


class QuestionUpdate(BaseModel):
    mondai_group: Optional[str] = None
    question_number: Optional[int] = None
    audio_clip_url: Optional[str] = None
    question_text: Optional[str] = None
    image_url: Optional[str] = None
    explanation: Optional[str] = None


class QuestionResponse(QuestionBase):
    question_id: UUID
    exam_id: UUID

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "question_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                "exam_id": "2fa85f64-5717-4562-b3fc-2c963f66afb8",
                "mondai_group": "Mondai 2",
                "question_number": 1,
                "audio_clip_url": "https://cdn.example.com/clips/q1.mp3",
                "question_text": "男の人はいつ会議に出発しますか。",
                "image_url": None,
                "explanation": "会話の中で「午前9時に出発」と言っています。"
            }
        }
    )


class QuestionWithAnswersResponse(QuestionResponse):
    """Question detail including all answer options."""
    answers: List[AnswerResponse] = []

    model_config = ConfigDict(from_attributes=True)
