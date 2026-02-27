from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


# ---------------------------------------------------------------------------
# Audio schemas
# ---------------------------------------------------------------------------

class AudioBase(BaseModel):
    file_name: Optional[str] = Field(None, description="Original file name")
    file_url: str = Field(..., description="URL / path to the audio file")
    duration: Optional[int] = Field(None, description="Duration in seconds")
    ai_model: Optional[str] = Field(None, description="AI model used, e.g. 'whisper-v3'")


class AudioCreate(AudioBase):
    """Payload for uploading / registering a new audio file."""
    pass


class AudioUpdate(BaseModel):
    """Fields that can be patched after creation."""
    file_name: Optional[str] = None
    duration: Optional[int] = None
    ai_status: Optional[str] = Field(None, pattern="^(pending|processing|completed|failed)$")
    ai_model: Optional[str] = None
    raw_transcript: Optional[str] = None


class AudioResponse(AudioBase):
    audio_id: UUID
    ai_status: Optional[str] = None
    raw_transcript: Optional[str] = None

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "audio_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                "file_name": "jlpt_n3_2025.mp3",
                "file_url": "https://cdn.example.com/audios/jlpt_n3_2025.mp3",
                "duration": 420,
                "ai_status": "completed",
                "ai_model": "whisper-v3",
                "raw_transcript": "こんにちは..."
            }
        }
    )


# ---------------------------------------------------------------------------
# TranscriptSegment schemas
# ---------------------------------------------------------------------------

class TranscriptSegmentBase(BaseModel):
    speaker_name: Optional[str] = Field(None, description="e.g. 'Speaker A'")
    speaker_gender: Optional[str] = Field(None, description="Male / Female")
    start_time: Optional[float] = Field(None, description="Start time in seconds")
    end_time: Optional[float] = Field(None, description="End time in seconds")
    content: str = Field(..., description="Dialogue content")
    sort_order: Optional[int] = Field(None, description="Display order")


class TranscriptSegmentCreate(TranscriptSegmentBase):
    """Payload for creating a single segment. audio_id supplied by the route."""
    audio_id: UUID


class TranscriptSegmentUpdate(BaseModel):
    speaker_name: Optional[str] = None
    speaker_gender: Optional[str] = None
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    content: Optional[str] = None
    sort_order: Optional[int] = None


class TranscriptSegmentResponse(TranscriptSegmentBase):
    segment_id: UUID
    audio_id: UUID

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "segment_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                "audio_id": "1fa85f64-5717-4562-b3fc-2c963f66afb7",
                "speaker_name": "Speaker A",
                "speaker_gender": "Female",
                "start_time": 0.0,
                "end_time": 5.2,
                "content": "こんにちは、よろしくお願いします。",
                "sort_order": 1
            }
        }
    )


class AudioWithSegmentsResponse(AudioResponse):
    """Audio detail including all transcript segments."""
    segments: List[TranscriptSegmentResponse] = []

    model_config = ConfigDict(from_attributes=True)
