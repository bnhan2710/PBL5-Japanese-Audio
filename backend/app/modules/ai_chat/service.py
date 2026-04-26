from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import get_settings

from .schemas import AIChatRequest


DEFAULT_SYSTEM_PROMPT = (
    "Bạn là trợ lý AI cho nền tảng luyện nghe tiếng Nhật. "
    "Trả lời rõ ràng, ngắn gọn, dễ hiểu; giữ đúng ngôn ngữ người dùng đang dùng."
)


class AIChatService:
    @staticmethod
    async def chat(payload: AIChatRequest) -> dict[str, str]:
        settings = get_settings()

        user_messages = [
            msg for msg in payload.messages if msg.role == "user" and msg.content.strip()
        ]
        if not user_messages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one user message is required.",
            )

        has_system = any(msg.role == "system" for msg in payload.messages)
        messages = (
            [{"role": "system", "content": DEFAULT_SYSTEM_PROMPT}] if not has_system else []
        ) + [
            {"role": msg.role, "content": msg.content}
            for msg in payload.messages
            if msg.content.strip()
        ]

        body: dict[str, Any] = {
            "model": settings.LM_STUDIO_MODEL,
            "messages": messages,
            "temperature": payload.temperature,
        }
        if payload.max_tokens is not None:
            body["max_tokens"] = payload.max_tokens

        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                response = await client.post(settings.LM_STUDIO_API_URL, json=body)
            response.raise_for_status()
            data = response.json()
            reply = data["choices"][0]["message"]["content"].strip()
            if not reply:
                raise ValueError("Empty response from LM Studio")
            return {"reply": reply, "model": settings.LM_STUDIO_MODEL}
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"LM Studio chat failed: {exc}",
            ) from exc
