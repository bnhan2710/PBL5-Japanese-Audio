import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import get_current_user
from app.modules.users.models import User
from app.modules.notifications.models import Notification
from app.modules.notifications.schemas import NotificationResponse, NotificationListResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])
logger = logging.getLogger(__name__)


@router.get(
    "",
    response_model=NotificationListResponse,
    summary="Get current user's notifications",
)
async def get_notifications(
    limit: int = 20,
    offset: int = 0,
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        query = query.where(Notification.is_read == False)  # noqa: E712
    query = query.order_by(Notification.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    notifications = result.scalars().all()

    count_query = select(func.count()).select_from(Notification).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False,  # noqa: E712
    )
    count_result = await db.execute(count_query)
    unread_count = count_result.scalar_one()

    return NotificationListResponse(
        notifications=[
            NotificationResponse(
                id=str(n.id),
                user_id=n.user_id,
                title=n.title,
                message=n.message,
                type=n.type,
                is_read=n.is_read,
                link=n.link,
                created_at=n.created_at,
            )
            for n in notifications
        ],
        unread_count=unread_count,
    )


@router.put(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    summary="Mark a notification as read",
)
async def mark_notification_read(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import uuid
    result = await db.execute(
        select(Notification).where(
            Notification.id == uuid.UUID(notification_id),
            Notification.user_id == current_user.id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    await db.commit()
    await db.refresh(notification)
    return NotificationResponse(
        id=str(notification.id),
        user_id=notification.user_id,
        title=notification.title,
        message=notification.message,
        type=notification.type,
        is_read=notification.is_read,
        link=notification.link,
        created_at=notification.created_at,
    )


@router.put(
    "/read-all",
    summary="Mark all notifications as read",
)
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)  # noqa: E712
        .values(is_read=True)
    )
    await db.commit()
    return {"message": "All notifications marked as read"}


@router.delete(
    "/{notification_id}",
    status_code=204,
    summary="Delete a notification",
)
async def delete_notification(
    notification_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import uuid
    result = await db.execute(
        select(Notification).where(
            Notification.id == uuid.UUID(notification_id),
            Notification.user_id == current_user.id,
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    await db.delete(notification)
    await db.commit()
