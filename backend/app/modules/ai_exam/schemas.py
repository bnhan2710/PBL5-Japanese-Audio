from typing import Optional, List, Literal
from pydantic import BaseModel


class MondaiCountConfig(BaseModel):
    mondai_id: int
    count: int


class AIGenerateRequest(BaseModel):
    jlpt_level: Literal["N5", "N4", "N3", "N2", "N1"] = "N2"
    title: str
    mondai_config: Optional[List[MondaiCountConfig]] = None


class AIQuestionOption(BaseModel):
    label: str       # A, B, C, D
    content: str
    is_correct: bool


class AIQuestion(BaseModel):
    mondai_group: str
    question_number: int
    introduction: Optional[str] = None
    script_text: str
    question_text: str
    difficulty: Optional[int] = None
    image_url: Optional[str] = None
    audio_url: Optional[str] = None
    source_segment_index: Optional[int] = None
    source_question_index: Optional[int] = None
    source_start_time: Optional[float] = None
    source_end_time: Optional[float] = None
    source_transcript: Optional[str] = None
    answers: List[AIQuestionOption]


class AITimestampQuestion(BaseModel):
    question_number: int
    start_time: float
    end_time: float
    text: Optional[str] = None


class AITimestampMondai(BaseModel):
    mondai_number: int
    title: str
    start_time: float
    end_time: float
    questions: List[AITimestampQuestion]


class AISplitSegment(BaseModel):
    segment_index: int
    file_name: str
    start_time: float
    end_time: float
    transcript: str
    refined_transcript: Optional[str] = None


class AIExamResult(BaseModel):
    audio_id: Optional[str] = None
    audio_file_url: Optional[str] = None
    raw_transcript: str
    refined_script: str
    split_segments: List[AISplitSegment] = []
    timestamps: Optional[List[AITimestampMondai]] = None
    questions: List[AIQuestion]


class AIJobStatusResponse(BaseModel):
    job_id: str
    status: Literal["pending", "processing", "done", "failed"]
    progress_message: str = ""
    result: Optional[AIExamResult] = None
    error: Optional[str] = None


class AIGenerateResponse(BaseModel):
    job_id: str
    status: Literal["pending", "processing", "done", "failed"]
    progress_message: str = ""
