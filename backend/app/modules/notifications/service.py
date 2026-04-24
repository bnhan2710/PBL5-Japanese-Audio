import logging
from typing import Optional

from app.db.session import AsyncSessionLocal
from app.modules.notifications.models import Notification

logger = logging.getLogger(__name__)


async def create_notification(
    *,
    user_id: int,
    title: str,
    message: str,
    type: str = "info",
    link: Optional[str] = None,
) -> None:
    """Create an in-app notification for a user."""
    try:
        async with AsyncSessionLocal() as db:
            notification = Notification(
                user_id=user_id,
                title=title,
                message=message,
                type=type,
                link=link,
            )
            db.add(notification)
            await db.commit()
    except Exception as exc:
        logger.error("Failed to create notification for user %s: %s", user_id, exc)
