"""
Random Exam Generation Service

This service handles the logic for randomly selecting exam questions from the question bank
based on specified configurations. It supports special handling for Mondai 5 (N1/N2 levels).
"""

import random
import logging
import re
from typing import List, Dict, Optional, Set
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.questions.models import Question, Answer
from app.modules.exam.models import Exam

logger = logging.getLogger(__name__)


class RandomExamService:
    """Service for generating random exams from existing question pool"""

    def __init__(self):
        self._jobs: Dict[str, Dict] = {}

    @staticmethod
    def _select_diverse_questions(pool: List[Question], count: int) -> List[Question]:
        """Select questions in rounds with non-deterministic cross-exam mixing.

        Desired behavior:
        - Continue selecting by question-number rounds until enough questions.
        - Mix across many source exams but avoid rigid round-robin patterns.
        - Allow occasional consecutive picks from the same exam naturally.
        """
        if count <= 0 or not pool:
            return []

        # Group by question_number, then by source exam.
        by_number_exam: Dict[int, Dict[str, List[Question]]] = {}
        seen_exams: Set[str] = set()

        for q in pool:
            key = q.question_number if (q.question_number or 0) > 0 else 10**9
            exam_key = str(q.exam_id)
            seen_exams.add(exam_key)
            by_number_exam.setdefault(key, {}).setdefault(exam_key, []).append(q)

        for exam_map in by_number_exam.values():
            for bucket in exam_map.values():
                random.shuffle(bucket)

        ordered_numbers = sorted(by_number_exam.keys())
        selected: List[Question] = []
        last_exam_id: Optional[str] = None

        while len(selected) < count:
            progressed = False

            for number in ordered_numbers:
                exam_map = by_number_exam.get(number, {})
                available_exams = [eid for eid, items in exam_map.items() if items]
                if not available_exams:
                    continue

                # Weighted random: prefer switching exam, but keep natural randomness.
                if last_exam_id and len(available_exams) > 1:
                    switch_candidates = [eid for eid in available_exams if eid != last_exam_id]
                    stay_candidates = [eid for eid in available_exams if eid == last_exam_id]
                    weighted: List[str] = []
                    weighted.extend(switch_candidates * 4)
                    weighted.extend(stay_candidates * 2)
                    chosen_exam = random.choice(weighted if weighted else available_exams)
                else:
                    chosen_exam = random.choice(available_exams)

                chosen = exam_map[chosen_exam].pop(0)
                selected.append(chosen)
                last_exam_id = chosen_exam
                progressed = True

                if len(selected) >= count:
                    break

            if not progressed:
                break

        return selected[:count]

    @staticmethod
    def _exam_matches_level(exam: Optional[Exam], jlpt_level: str) -> bool:
        if exam is None:
            return False
        haystack = f"{exam.title or ''} {exam.description or ''}"
        # Match tokens like: [N2], N2, (N2)
        return (
            re.search(
                rf"(?<![A-Z0-9])\[?{re.escape(jlpt_level)}\]?(?![A-Z0-9])", haystack, re.IGNORECASE
            )
            is not None
        )

    @staticmethod
    def validate_mondai_pool(
        available: Dict[str, List[Question]],
        mondai_config: List[Dict[str, int]],
        jlpt_level: str,
    ) -> None:
        """Raise ValueError when requested mondai counts cannot be satisfied."""
        issues: List[str] = []
        for config in mondai_config:
            mondai_id = config.get("mondai_id", 1)
            requested = config.get("count", 0)
            if requested <= 0:
                continue
            mondai_key = f"Mondai {mondai_id}"
            available_count = len(available.get(mondai_key, []))

            # Mondai 5 for N1/N2 still uses ALL questions, but minimum requested count must exist.
            if available_count < requested:
                issues.append(f"{mondai_key}: cần {requested}, hiện có {available_count}")

        if issues:
            raise ValueError(
                f"Không đủ câu hỏi đúng trình độ {jlpt_level} để tạo đề: " + "; ".join(issues)
            )

    async def get_available_questions(
        self,
        db: AsyncSession,
        jlpt_level: str,
    ) -> Dict[str, List[Question]]:
        """
        Get all available questions grouped by mondai for a specific JLPT level.

        Returns dict like {"Mondai 1": [questions], "Mondai 2": [questions], ...}
        """
        # Query questions with source exam loaded, then strictly filter by selected JLPT level.
        stmt = (
            select(Question)
            .options(selectinload(Question.answers), selectinload(Question.exam))
            .where(Question.exam_id.isnot(None))
        )

        result = await db.execute(stmt)
        all_questions = result.scalars().all()

        # Keep only questions whose source exam metadata matches selected JLPT level.
        level_questions = [q for q in all_questions if self._exam_matches_level(q.exam, jlpt_level)]

        # Group by mondai
        grouped: Dict[str, List[Question]] = {}
        for q in level_questions:
            mondai = q.mondai_group or "Unknown"
            if mondai not in grouped:
                grouped[mondai] = []
            grouped[mondai].append(q)

        return grouped

    async def generate_random_exam(
        self,
        db: AsyncSession,
        title: str,
        description: Optional[str],
        jlpt_level: str,
        mondai_config: List[Dict[str, int]],
    ) -> Dict:
        """
        Generate a random exam by selecting questions from the pool.

        mondai_config format: [{"mondai_id": 1, "count": 5}, ...]

        Special logic for Mondai 5:
        - For N1 and N2 levels, if Mondai 5 is requested, fetch ALL available Mondai 5 questions
        - For other levels, randomly select from available Mondai 5 questions
        """
        try:
            # Get available questions grouped by mondai
            available = await self.get_available_questions(db, jlpt_level)

            # Enforce strict pool validation: if any requested mondai is insufficient, stop.
            self.validate_mondai_pool(available, mondai_config, jlpt_level)

            selected_questions: List[Question] = []
            mondai_summary: Dict[str, int] = {}

            for config in mondai_config:
                mondai_id = config.get("mondai_id", 1)
                count = config.get("count", 0)

                if count <= 0:
                    continue

                mondai_key = f"Mondai {mondai_id}"
                pool = available.get(mondai_key, [])

                if not pool:
                    logger.warning(f"No questions available for {mondai_key}")
                    continue

                # Special handling for Mondai 5 in N1 and N2
                if mondai_id == 5 and jlpt_level in ["N1", "N2"]:
                    # Use ALL available Mondai 5 questions, not random selection
                    selected = pool
                    logger.info(
                        f"Mondai 5 ({jlpt_level}): Using all {len(pool)} available questions (no randomization)"
                    )
                else:
                    # Random selection for other mondais with cross-exam diversity.
                    selected = self._select_diverse_questions(pool, count)

                selected_questions.extend(selected)
                mondai_summary[mondai_key] = len(selected)

            # Keep the generated order so frontend can preserve audio-friendly sequence.

            return {
                "title": title,
                "description": description,
                "level": jlpt_level,
                "total_questions": len(selected_questions),
                "questions": selected_questions,
                "mondai_summary": mondai_summary,
            }

        except Exception as e:
            logger.error(f"Error generating random exam: {str(e)}")
            raise

    async def create_exam_from_random_selection(
        self,
        db: AsyncSession,
        creator_id: int,
        title: str,
        description: Optional[str],
        question_ids: List[str],
    ) -> Exam:
        """
        Create an exam record with the selected random questions.
        This would typically be called after the user confirms the random selection.
        """
        exam = Exam(
            creator_id=creator_id,
            title=title,
            description=description,
            current_step=1,
            is_published=False,
        )
        db.add(exam)
        await db.flush()  # Get the exam_id before committing

        # Associate questions with this exam
        # Note: This assumes questions can be copied/reassociated or links can be updated
        # The exact implementation depends on your business logic

        await db.commit()
        await db.refresh(exam)

        return exam
