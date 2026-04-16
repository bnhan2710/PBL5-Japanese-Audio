from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import get_current_user
from app.modules.users.models import User
from app.modules.analytics.schemas import AnalyticsOverviewResponse, FeedbackListResponse
from app.modules.analytics.service import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview", response_model=AnalyticsOverviewResponse)
async def get_analytics_overview(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    level: Optional[str] = Query(None, description="Filter by JLPT Level (N1-N5)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get general analytics overview for admin dashboard."""
    # Ensure admin role for production, but keeping it open for dev or check role
    # if current_user.role != "admin":
    #     raise HTTPException(status_code=403, detail="Not an admin")
    
    if not end_date:
        end_date = datetime.utcnow()
    else:
        end_date = end_date.replace(tzinfo=None)
        
    if not start_date:
        start_date = end_date - timedelta(days=30)
    else:
        start_date = start_date.replace(tzinfo=None)
        
    return await analytics_service.get_overview(db, start_date, end_date, level)


@router.get("/ai-feedbacks", response_model=FeedbackListResponse)
async def get_analytics_feedbacks(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    type_filter: str = Query("all", description="all, ai, system"),
    rating: Optional[int] = Query(None, description="Filter by exact star rating"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve filtered user feedbacks for drill-down view."""
    if not end_date:
        end_date = datetime.utcnow()
    else:
        end_date = end_date.replace(tzinfo=None)
        
    if not start_date:
        start_date = end_date - timedelta(days=30)
    else:
        start_date = start_date.replace(tzinfo=None)
        
    return await analytics_service.get_feedback_list(db, start_date, end_date, type_filter, rating)
