from typing import Optional, List
from datetime import datetime, timedelta
import json
import re

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from sqlalchemy.orm import selectinload

from app.modules.exam.models import Exam
from app.modules.result.models import UserResult
from app.modules.ai_feedback.models import AIFeedback
from app.modules.system_feedback.models import SystemFeedback
from app.modules.ai_exam.models import AIExamCache
from app.modules.users.models import User
from app.modules.analytics.schemas import (
    ExamStats,
    InteractionStats,
    AIQualityStats,
    SystemQualityStats,
    AnalyticsOverviewResponse,
    ChartDataPoint,
    AnalyticsFeedbackResponse,
    FeedbackListResponse,
)


class AnalyticsService:
    @staticmethod
    def _extract_jlpt_level(title: str, description: str) -> str:
        """Extract JLPT level N1-N5 from text."""
        haystack = f"{title or ''} {description or ''}"
        for level in ["N1", "N2", "N3", "N4", "N5"]:
            if re.search(
                rf"(?<![A-Z0-9])\[?{re.escape(level)}\]?(?![A-Z0-9])", haystack, re.IGNORECASE
            ):
                return level
        return "Other"

    async def get_overview(
        self,
        db: AsyncSession,
        start_date: datetime,
        end_date: datetime,
        level_filter: Optional[str] = None,
    ) -> AnalyticsOverviewResponse:

        # 1. Exam Stats
        exam_query = select(Exam).where(Exam.created_at >= start_date, Exam.created_at <= end_date)
        exams = (await db.execute(exam_query)).scalars().all()

        level_counts = {"N1": 0, "N2": 0, "N3": 0, "N4": 0, "N5": 0, "Other": 0}
        status_counts = {"Đang hoạt động": 0, "Ngừng hoạt động": 0}
        date_counts = {}

        filtered_exams = []
        for exam in exams:
            lvl = self._extract_jlpt_level(exam.title, exam.description)
            if level_filter and lvl != level_filter:
                continue
            filtered_exams.append(exam)
            level_counts[lvl] += 1
            if exam.is_published:
                status_counts["Đang hoạt động"] += 1
            else:
                status_counts["Ngừng hoạt động"] += 1

            date_str = exam.created_at.strftime("%Y-%m-%d")
            date_counts[date_str] = date_counts.get(date_str, 0) + 1

        # 2. Interaction Stats (UserResults)
        # Using cast to DATE is specific to dialect, we can just fetch and process in python for small sets or use func.date
        result_query = select(UserResult).where(
            UserResult.completed_at >= start_date, UserResult.completed_at <= end_date
        )
        if level_filter:
            # Need to join with Exam to filter by level.
            # For simplicity & since we dynamically extract level from title, we fetch exams first.
            valid_exam_ids = [str(e.exam_id) for e in filtered_exams]
            if valid_exam_ids:
                # UUID comparison might need string casting or direct UUID objects
                result_query = (
                    select(UserResult)
                    .join(Exam)
                    .where(
                        UserResult.completed_at >= start_date, UserResult.completed_at <= end_date
                    )
                )

        user_results = (
            (await db.execute(result_query.options(selectinload(UserResult.exam)))).scalars().all()
        )

        interaction_date_counts = {}
        valid_results_count = 0
        for res in user_results:
            if level_filter:
                if not res.exam:
                    continue
                lvl = self._extract_jlpt_level(res.exam.title, res.exam.description)
                if lvl != level_filter:
                    continue

            valid_results_count += 1
            if res.completed_at:
                date_str = res.completed_at.strftime("%Y-%m-%d")
                interaction_date_counts[date_str] = interaction_date_counts.get(date_str, 0) + 1

        # Calculate a continuous date range for charts
        day_diff = (end_date - start_date).days
        over_time_list = []
        for i in range(day_diff + 1):
            dt_str = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
            over_time_list.append(
                ChartDataPoint(name=dt_str, value=interaction_date_counts.get(dt_str, 0))
            )

        exam_over_time_list = []
        for i in range(day_diff + 1):
            dt_str = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
            exam_over_time_list.append(
                ChartDataPoint(name=dt_str, value=date_counts.get(dt_str, 0))
            )

        # 3. AI Quality Stats
        ai_fb_query = select(AIFeedback).where(
            AIFeedback.created_at >= start_date, AIFeedback.created_at <= end_date
        )
        ai_fbs = (await db.execute(ai_fb_query)).scalars().all()

        rating_dist = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        total_rating = 0
        for fb in ai_fbs:
            score = fb.rating_score
            if 1 <= score <= 5:
                rating_dist[score] += 1
                total_rating += score

        average_rating = total_rating / len(ai_fbs) if ai_fbs else 0.0

        # Get AI Errors from ai_exam_cache
        cache_query = select(AIExamCache).where(
            AIExamCache.created_at >= start_date,
            AIExamCache.created_at <= end_date,
            AIExamCache.status == "completed",
        )
        caches = (await db.execute(cache_query)).scalars().all()

        total_error_score = 0.0
        valid_error_count = 0
        for c in caches:
            if c.result_json:
                try:
                    data = json.loads(c.result_json)
                    if "confidence_error_score" in data:
                        total_error_score += float(data["confidence_error_score"])
                        valid_error_count += 1
                except:
                    pass

        confidence_error = total_error_score / valid_error_count if valid_error_count > 0 else 0.1

        # Reliability formula
        reliability_score = (
            (1.0 - confidence_error) * 0.7 + (average_rating / 5.0) * 0.3
            if average_rating > 0
            else (1.0 - confidence_error)
        )

        # 4. System Quality Stats
        system_fb_query = select(SystemFeedback).where(
            SystemFeedback.created_at >= start_date, SystemFeedback.created_at <= end_date
        )
        system_fbs = (await db.execute(system_fb_query)).scalars().all()

        sys_rating_dist = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        total_sys_rating = 0
        for fb in system_fbs:
            score = fb.rating_score
            if 1 <= score <= 5:
                sys_rating_dist[score] += 1
                total_sys_rating += score

        sys_average_rating = total_sys_rating / len(system_fbs) if system_fbs else 0.0

        return AnalyticsOverviewResponse(
            exam_stats=ExamStats(
                total=len(filtered_exams),
                by_level=[
                    ChartDataPoint(name=k, value=v) for k, v in level_counts.items() if v > 0
                ],
                by_status=[
                    ChartDataPoint(name=k, value=v) for k, v in status_counts.items() if v > 0
                ],
                created_over_time=exam_over_time_list,
            ),
            interaction_stats=InteractionStats(
                total_takes=valid_results_count, over_time=over_time_list
            ),
            ai_quality_stats=AIQualityStats(
                reliability_score=round(reliability_score, 4),
                confidence_error=round(confidence_error, 4),
                average_rating=round(average_rating, 2),
                rating_distribution=[
                    ChartDataPoint(name=f"{k} Sao", value=v) for k, v in rating_dist.items()
                ],
            ),
            system_quality_stats=SystemQualityStats(
                total_feedbacks=len(system_fbs),
                average_rating=round(sys_average_rating, 2),
                rating_distribution=[
                    ChartDataPoint(name=f"{k} Sao", value=v) for k, v in sys_rating_dist.items()
                ],
            ),
        )

    async def get_feedback_list(
        self,
        db: AsyncSession,
        start_date: datetime,
        end_date: datetime,
        type_filter: str = "all",  # "all", "ai", "system"
        rating_filter: Optional[int] = None,
    ) -> FeedbackListResponse:
        items = []

        if type_filter in ["all", "ai"]:
            query = (
                select(AIFeedback)
                .options(selectinload(AIFeedback.user))
                .where(AIFeedback.created_at >= start_date, AIFeedback.created_at <= end_date)
                .order_by(desc(AIFeedback.created_at))
            )
            if rating_filter:
                query = query.where(AIFeedback.rating_score == rating_filter)

            fbs = (await db.execute(query)).scalars().all()
            for fb in fbs:
                items.append(
                    AnalyticsFeedbackResponse(
                        id=str(fb.id),
                        type="ai",
                        user_id=fb.user_id,
                        user_name=(
                            f"{fb.user.first_name} {fb.user.last_name}" if fb.user else "Unknown"
                        ),
                        rating_score=fb.rating_score,
                        comment_text=fb.comment_text,
                        created_at=fb.created_at,
                    )
                )

        if type_filter in ["all", "system"]:
            query = (
                select(SystemFeedback)
                .options(selectinload(SystemFeedback.user))
                .where(
                    SystemFeedback.created_at >= start_date, SystemFeedback.created_at <= end_date
                )
                .order_by(desc(SystemFeedback.created_at))
            )
            if rating_filter:
                query = query.where(SystemFeedback.rating_score == rating_filter)

            fbs = (await db.execute(query)).scalars().all()
            for fb in fbs:
                items.append(
                    AnalyticsFeedbackResponse(
                        id=str(fb.id),
                        type="system",
                        user_id=fb.user_id,
                        user_name=(
                            f"{fb.user.first_name} {fb.user.last_name}" if fb.user else "Unknown"
                        ),
                        rating_score=fb.rating_score,
                        comment_text=fb.comment_text,
                        created_at=fb.created_at,
                    )
                )

        # Sort combined
        items.sort(key=lambda x: x.created_at, reverse=True)

        return FeedbackListResponse(items=items, total=len(items))


analytics_service = AnalyticsService()
