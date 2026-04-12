from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(..., min_length=1, description="Message content")


class AIChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(default_factory=list)
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, ge=1, le=4096)


class AIChatResponse(BaseModel):
    reply: str
    model: str
