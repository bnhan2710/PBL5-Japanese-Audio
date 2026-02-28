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
    audio_url: Optional[str] = None
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


class AIExamResult(BaseModel):
    raw_transcript: str
    refined_script: str
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
