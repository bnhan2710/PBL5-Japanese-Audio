"""Pydantic schemas for random exam generation."""

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class MondaiCountConfig(BaseModel):
    """Configuration for number of questions per mondai."""

    mondai_id: int = Field(..., ge=1, le=5, description="Mondai ID (1-5)")
    count: int = Field(..., ge=1, description="Number of questions to select")


class RandomExamGenerateRequest(BaseModel):
    """Request to start random exam generation."""

    title: str = Field(..., min_length=1, description="Exam title")
    description: Optional[str] = None
    jlpt_level: Literal["N5", "N4", "N3", "N2", "N1"] = Field(default="N2")
    mondai_config: List[MondaiCountConfig] = Field(..., description="Configuration for each mondai")


class AnswerResponse(BaseModel):
    """Answer option response."""

    answer_id: str
    content: Optional[str] = None
    image_url: Optional[str] = None
    is_correct: bool
    order_index: Optional[int] = None

    class Config:
        from_attributes = True


class QuestionInRandomExam(BaseModel):
    """Question response for random exam."""

    question_id: str
    exam_id: str
    mondai_group: Optional[str] = None
    question_number: Optional[int] = None
    audio_clip_url: Optional[str] = None
    question_text: Optional[str] = None
    image_url: Optional[str] = None
    script_text: Optional[str] = None
    explanation: Optional[str] = None
    raw_transcript: Optional[str] = None
    hide_question_text: bool = False
    difficulty: Optional[int] = None
    answers: List[AnswerResponse] = []

    class Config:
        from_attributes = True


class RandomExamGenerateResponse(BaseModel):
    """Response from random exam generation request."""

    exam_id: str
    job_id: str
    status: Literal["pending", "processing", "done", "failed"]
    progress_message: str = ""
    title: str
    description: Optional[str] = None
    level: Literal["N5", "N4", "N3", "N2", "N1"]
    total_questions: int
    mondai_summary: Dict[str, int] = {}
    questions: List[QuestionInRandomExam] = []
    error: Optional[str] = None


class RandomExamJobStatusResponse(BaseModel):
    """Response for checking random exam job status."""

    exam_id: str
    job_id: str
    status: Literal["pending", "processing", "done", "failed"]
    progress_message: str = ""
    title: str
    description: Optional[str] = None
    level: Literal["N5", "N4", "N3", "N2", "N1"]
    total_questions: int
    mondai_summary: Dict[str, int] = {}
    questions: List[QuestionInRandomExam] = []
    error: Optional[str] = None


class RandomExamCreateRequest(BaseModel):
    """Request to create exam from random selection."""

    class EditedAnswer(BaseModel):
        content: Optional[str] = None
        image_url: Optional[str] = None
        is_correct: bool = False
        order_index: Optional[int] = None

    class EditedQuestion(BaseModel):
        question_id: str
        mondai_group: Optional[str] = None
        question_number: Optional[int] = None
        audio_clip_url: Optional[str] = None
        question_text: Optional[str] = None
        image_url: Optional[str] = None
        script_text: Optional[str] = None
        explanation: Optional[str] = None
        raw_transcript: Optional[str] = None
        hide_question_text: bool = False
        difficulty: Optional[int] = None
        answers: List["RandomExamCreateRequest.EditedAnswer"] = Field(default_factory=list)

    exam_id: Optional[str] = Field(None, description="Existing draft exam ID to finalize")
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    questions: List[str] = Field(default_factory=list, description="List of question IDs")
    question_ids: List[str] = Field(
        default_factory=list, description="Alternative list of question IDs"
    )
    edited_questions: List[EditedQuestion] = Field(
        default_factory=list,
        description="Edited question data to persist when creating exam",
    )
    time_limit: Optional[int] = Field(
        default=60,
        ge=1,
        le=300,
        description="Exam time limit in minutes",
    )
    is_published: bool = Field(False, description="Whether the created exam should be published")
    audio_file_url: Optional[str] = Field(None, description="Merged audio file URL")


class AvailableQuestionsResponse(BaseModel):
    """Response for available questions grouped by mondai."""

    mondai_group: str
    count: int
    questions: List[QuestionInRandomExam] = []


class AudioMergeRequest(BaseModel):
    """Request to merge multiple audio files."""

    audio_urls: List[str] = Field(..., min_items=1, description="List of audio file URLs to merge")
    silence_duration: int = Field(
        default=3, ge=1, le=60, description="Silence gap duration in seconds"
    )


class AudioMergeResponse(BaseModel):
    """Response from audio merge operation."""

    merged_audio_url: str = Field(..., description="URL of merged audio file")
