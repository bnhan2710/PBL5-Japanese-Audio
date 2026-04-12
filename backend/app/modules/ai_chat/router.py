from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.modules.users.models import User

from .schemas import AIChatRequest, AIChatResponse
from .service import AIChatService

router = APIRouter(prefix="/ai-chat", tags=["ai-chat"])


@router.post("/completions", response_model=AIChatResponse)
async def create_chat_completion(
    payload: AIChatRequest,
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    result = await AIChatService.chat(payload)
    return AIChatResponse(**result)
