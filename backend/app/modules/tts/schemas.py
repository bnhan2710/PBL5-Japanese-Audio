from typing import List, Dict, Optional
from pydantic import BaseModel, Field


class DialogueLine(BaseModel):
    speaker: str = Field(..., description="Speaker label, e.g., A")
    text: str = Field(..., description="Dialogue text")


class SpeakerConfig(BaseModel):
    model_name: str = Field("jvnv-F1-jp", description="Voice model name")
    style: str = Field("Neutral", description="Emotion style")
    pitch_scale: float = Field(1.0, description="Pitch scale factor")
    sdp_ratio: float = Field(0.2, description="SDP ratio")
    reference_audio_url: Optional[str] = Field(
        None, description="URL to reference audio for style cloning"
    )


class TTSGenerateRequest(BaseModel):
    dialogues: List[DialogueLine]
    speaker_configs: Dict[str, SpeakerConfig]
    title: Optional[str] = Field("Untitled", description="Output audio file name")
    dialogue_pause: float = Field(0.5, description="Pause duration between dialogues")
    narrator_pause: float = Field(2.5, description="Pause duration after narrator")


class TTSGenerateResponse(BaseModel):
    audio_id: Optional[str] = Field(None, description="Audio UUID")
    file_name: str
    file_url: str
