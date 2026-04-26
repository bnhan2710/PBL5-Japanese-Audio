from typing import Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class ChartDataPoint(BaseModel):
    name: str
    value: int | float


class ExamStats(BaseModel):
    total: int
    by_level: List[ChartDataPoint]
    by_status: List[ChartDataPoint]
    created_over_time: List[ChartDataPoint]


class InteractionStats(BaseModel):
    total_takes: int
    over_time: List[ChartDataPoint]


class AIQualityStats(BaseModel):
    reliability_score: float = Field(..., description="0 to 1 score (e.g. 0.85 means 85% reliable)")
    confidence_error: float = Field(..., description="0 to 1 score representing AI error")
    average_rating: float = Field(..., description="1 to 5 average star rating")
    rating_distribution: List[ChartDataPoint] = Field(..., description="Count of 1-5 stars")


class SystemQualityStats(BaseModel):
    total_feedbacks: int = Field(..., description="Total system feedback submissions")
    average_rating: float = Field(..., description="1 to 5 average star rating")
    rating_distribution: List[ChartDataPoint] = Field(..., description="Count of 1-5 stars")


class AnalyticsOverviewResponse(BaseModel):
    exam_stats: ExamStats
    interaction_stats: InteractionStats
    ai_quality_stats: AIQualityStats
    system_quality_stats: SystemQualityStats


class AnalyticsFeedbackResponse(BaseModel):
    id: str
    type: str  # 'ai' or 'system'
    user_id: int
    user_name: Optional[str] = None
    rating_score: int
    comment_text: Optional[str] = None
    created_at: datetime


class FeedbackListResponse(BaseModel):
    items: List[AnalyticsFeedbackResponse]
    total: int
