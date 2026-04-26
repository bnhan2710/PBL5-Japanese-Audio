import math
import re
from collections import defaultdict
from typing import List, Tuple
from uuid import UUID

from fastapi import HTTPException, status
from scipy.optimize import minimize_scalar
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.audio.models import Audio
from app.modules.exam.models import Exam
from app.modules.questions.models import Question
from app.modules.result.models import UserResult
from app.modules.test.schemas import (
    TestAnswerOptionResponse,
    TestExamDetailResponse,
    TestMondaiGroupResponse,
    TestQuestionResponse,
    TestSubmitRequest,
    TestSubmitResponse,
    TestResultReviewResponse,
    TestExamReviewDetailResponse,
    TestQuestionReviewResponse,
    TestAnswerOptionReviewResponse,
)
from app.modules.users.models import User


def _extract_mondai_number(label: str | None) -> int:
    if not label:
        return 999
    match = re.search(r"\d+", label)
    return int(match.group()) if match else 999


def _sort_questions(questions: List[Question]) -> List[Question]:
    return sorted(
        questions,
        key=lambda q: (
            _extract_mondai_number(q.mondai_group),
            q.question_number if q.question_number is not None else 999,
        ),
    )


def _difficulty_to_b(difficulty: int) -> float:
    bounded = max(1, min(5, int(difficulty)))
    # Calibrated widening: Original was [-1.5, 1.5]
    return {1: -2.8, 2: -1.4, 3: 0.0, 4: 1.4, 5: 2.8}[bounded]


def _difficulty_to_a(difficulty: int) -> float:
    bounded = max(1, min(5, int(difficulty)))
    # Calibrated discrimination: Original was [0.8, 1.35]
    return {1: 1.0, 2: 1.2, 3: 1.4, 4: 1.6, 5: 1.8}[bounded]


def _estimate_question_difficulty(question: Question) -> int:
    if question.difficulty is not None:
        return max(1, min(5, int(question.difficulty)))

    if question.image_url:
        return 2

    answers = list(question.answers)
    answer_lengths = [len((answer.content or "").strip()) for answer in answers]
    total_answer_length = sum(answer_lengths)
    question_length = len((question.question_text or "").strip())
    explanation_length = len((question.explanation or "").strip())

    if len(answers) <= 3 and total_answer_length < 30 and question_length < 35:
        return 1
    if answers and all(length <= 8 for length in answer_lengths) and question_length < 45:
        return 2
    if explanation_length > 140 or question_length > 60:
        return 4
    return 3


def calculate_irt_score(responses: List[Tuple[int, int]]) -> float:
    """
    Estimate ability using a 2PL Bayesian IRT model (MAP) and map to [0, 60].
    Uses Range-Scaled Expected Score with a Quadratic (Power 2.0) transformation
    to ensure reasonable score progression at the extremes.
    """
    if not responses:
        return 0.0

    # Hard-coded absolute extremes for consistency
    if all(x == 1 for _, x in responses):
        return 60.0
    if all(x == 0 for _, x in responses):
        return 0.0

    def neg_log_posterior(theta: float) -> float:
        # 1. Log-Likelihood (2PL)
        nll = 0.0
        for difficulty, correct in responses:
            a = _difficulty_to_a(difficulty)
            b = _difficulty_to_b(difficulty)
            p = 1.0 / (1.0 + math.exp(-a * (theta - b)))
            p = max(min(p, 0.999999), 0.000001)
            if correct:
                nll -= math.log(p)
            else:
                nll -= math.log(1.0 - p)

        # 2. Bayesian Prior (theta ~ N(0, 2.0))
        # Stabilizes estimation for low question counts
        prior_sigma = 2.0
        nll += (theta**2) / (2 * (prior_sigma**2))
        return nll

    # Estimate theta using Bayesian MAP
    res = minimize_scalar(neg_log_posterior, bounds=(-4.0, 4.0), method="bounded")
    theta = float(getattr(res, "x", 0.0))

    def get_expected_correct(t: float) -> float:
        total = 0.0
        for difficulty, _ in responses:
            a = _difficulty_to_a(difficulty)
            b = _difficulty_to_b(difficulty)
            p = 1.0 / (1.0 + math.exp(-a * (t - b)))
            total += p
        return total

    # 3. Range-Scaled Expected Score Mapping
    current_exp = get_expected_correct(theta)
    min_exp = get_expected_correct(-4.0)
    max_exp = get_expected_correct(4.0)

    # Normalized expected score [0, 1]
    norm_exp = (current_exp - min_exp) / (max_exp - min_exp)
    norm_exp = max(0.0, min(1.0, norm_exp))

    # 4. Balanced Power Transformation (1.2)
    # Compresses scores at the low end but provides more reasonable
    # resolution for mid-range performance compared to quadratic (2.0).
    score = (norm_exp**1.2) * 60.0

    return round(float(max(0.0, min(60.0, score))), 2)


class TestService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_exam_entity(self, exam_id: UUID, current_user: User) -> Exam:
        result = await self.db.execute(
            select(Exam)
            .options(
                selectinload(Exam.audio),
                selectinload(Exam.questions).selectinload(Question.answers),
            )
            .where(Exam.exam_id == exam_id)
        )
        exam = result.scalar_one_or_none()
        if not exam:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

        can_access = (
            exam.is_published or current_user.role == "admin" or exam.creator_id == current_user.id
        )
        if not can_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not allowed to access this exam",
            )
        return exam

    def _build_exam_detail_response(self, exam: Exam) -> TestExamDetailResponse:
        sorted_questions = _sort_questions(list(exam.questions))

        mondai_map: dict[str, list[int]] = defaultdict(list)
        serialized_questions: List[TestQuestionResponse] = []
        for question in sorted_questions:
            if question.mondai_group:
                mondai_map[question.mondai_group].append(question.question_number or 0)

            answers = sorted(
                question.answers,
                key=lambda answer: answer.order_index if answer.order_index is not None else 999,
            )
            serialized_questions.append(
                TestQuestionResponse(
                    question_id=question.question_id,
                    mondai_group=question.mondai_group,
                    question_number=question.question_number,
                    audio_clip_url=question.audio_clip_url,
                    question_text=question.question_text,
                    hide_question_text=bool(question.hide_question_text),
                    image_url=question.image_url,
                    difficulty=question.difficulty,
                    explanation=question.explanation,
                    script_text=question.script_text,
                    raw_transcript=question.raw_transcript,
                    answers=[
                        TestAnswerOptionResponse(
                            answer_id=answer.answer_id,
                            content=answer.content,
                            image_url=answer.image_url,
                            order_index=answer.order_index,
                        )
                        for answer in answers
                    ],
                )
            )

        mondai_groups = [
            TestMondaiGroupResponse(
                label=label,
                question_count=len(numbers),
                start_number=min(numbers) if numbers else None,
                end_number=max(numbers) if numbers else None,
            )
            for label, numbers in sorted(
                mondai_map.items(),
                key=lambda item: _extract_mondai_number(item[0]),
            )
        ]

        audio_url = exam.audio.file_url if isinstance(exam.audio, Audio) else None
        return TestExamDetailResponse(
            exam_id=exam.exam_id,
            title=exam.title,
            description=exam.description,
            audio_mode=getattr(exam, "audio_mode", "practice") or "practice",
            time_limit=exam.time_limit,
            is_published=exam.is_published,
            audio_url=audio_url,
            total_questions=len(serialized_questions),
            mondai_groups=mondai_groups,
            questions=serialized_questions,
        )

    async def get_exam_detail(self, exam_id: UUID, current_user: User) -> TestExamDetailResponse:
        exam = await self._get_exam_entity(exam_id, current_user)
        return self._build_exam_detail_response(exam)

    async def get_result_review(
        self, result_id: UUID, current_user: User
    ) -> TestResultReviewResponse:
        # Get result
        result_stmt = select(UserResult).where(UserResult.result_id == result_id)
        db_result = (await self.db.execute(result_stmt)).scalar_one_or_none()

        if not db_result:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result not found")

        if db_result.user_id != current_user.id and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not allowed to access this result",
            )

        exam = await self._get_exam_entity(db_result.exam_id, current_user)
        sorted_questions = _sort_questions(list(exam.questions))

        mondai_map: dict[str, list[int]] = defaultdict(list)
        serialized_questions: List[TestQuestionReviewResponse] = []
        for question in sorted_questions:
            if question.mondai_group:
                mondai_map[question.mondai_group].append(question.question_number or 0)

            answers = sorted(
                question.answers,
                key=lambda answer: answer.order_index if answer.order_index is not None else 999,
            )
            serialized_questions.append(
                TestQuestionReviewResponse(
                    question_id=question.question_id,
                    mondai_group=question.mondai_group,
                    question_number=question.question_number,
                    audio_clip_url=question.audio_clip_url,
                    question_text=question.question_text,
                    hide_question_text=bool(question.hide_question_text),
                    image_url=question.image_url,
                    difficulty=question.difficulty,
                    explanation=question.explanation,
                    script_text=question.script_text,
                    raw_transcript=question.raw_transcript,
                    answers=[
                        TestAnswerOptionReviewResponse(
                            answer_id=answer.answer_id,
                            content=answer.content,
                            image_url=answer.image_url,
                            order_index=answer.order_index,
                            is_correct=answer.is_correct,
                        )
                        for answer in answers
                    ],
                )
            )

        mondai_groups = [
            TestMondaiGroupResponse(
                label=label,
                question_count=len(numbers),
                start_number=min(numbers) if numbers else None,
                end_number=max(numbers) if numbers else None,
            )
            for label, numbers in sorted(
                mondai_map.items(),
                key=lambda item: _extract_mondai_number(item[0]),
            )
        ]

        audio_url = exam.audio.file_url if isinstance(exam.audio, Audio) else None
        exam_review = TestExamReviewDetailResponse(
            exam_id=exam.exam_id,
            title=exam.title,
            description=exam.description,
            audio_mode=getattr(exam, "audio_mode", "practice") or "practice",
            time_limit=exam.time_limit,
            is_published=exam.is_published,
            audio_url=audio_url,
            total_questions=len(serialized_questions),
            mondai_groups=mondai_groups,
            questions=serialized_questions,
        )

        return TestResultReviewResponse(
            result_id=db_result.result_id,
            exam_id=db_result.exam_id,
            score=db_result.score or 0.0,
            total_questions=db_result.total_questions or 0,
            correct_answers=db_result.correct_answers or 0,
            completed_at=db_result.completed_at,
            exam=exam_review,
            user_answers=db_result.user_answers or {},
        )

    async def _submit_exam_from_entity(
        self,
        exam: Exam,
        payload: TestSubmitRequest,
        current_user: User,
    ) -> TestSubmitResponse:
        sorted_questions = _sort_questions(list(exam.questions))

        question_lookup = {question.question_id: question for question in sorted_questions}
        submitted_answers = {
            item.question_id: item.answer_id
            for item in payload.answers
            if item.question_id in question_lookup
        }

        correct_answers = 0
        answered_questions = 0
        responses: List[Tuple[int, int]] = []

        for question in sorted_questions:
            selected_answer_id = submitted_answers.get(question.question_id)
            is_correct = 0

            if selected_answer_id:
                answered_questions += 1
                answer_lookup = {answer.answer_id: answer for answer in question.answers}
                selected_answer = answer_lookup.get(selected_answer_id)
                if selected_answer and selected_answer.is_correct:
                    correct_answers += 1
                    is_correct = 1

            difficulty = _estimate_question_difficulty(question)
            responses.append((difficulty, is_correct))

        total_questions = len(sorted_questions)
        score = round(calculate_irt_score(responses), 2)

        user_answers_dict = {str(k): str(v) for k, v in submitted_answers.items() if v}

        result = UserResult(
            user_id=current_user.id,
            exam_id=exam.exam_id,
            score=score,
            total_questions=total_questions,
            correct_answers=correct_answers,
            user_answers=user_answers_dict,
        )
        self.db.add(result)
        await self.db.commit()
        await self.db.refresh(result)

        return TestSubmitResponse(
            result_id=result.result_id,
            exam_id=exam.exam_id,
            score=score,
            total_questions=total_questions,
            correct_answers=correct_answers,
            answered_questions=answered_questions,
            completed_at=result.completed_at,
        )

    async def submit_exam(
        self,
        exam_id: UUID,
        payload: TestSubmitRequest,
        current_user: User,
    ) -> TestSubmitResponse:
        exam = await self._get_exam_entity(exam_id, current_user)
        return await self._submit_exam_from_entity(exam, payload, current_user)
