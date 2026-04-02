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


def calculate_irt_score(responses: List[Tuple[int, int]]) -> float:
    """Calculate an IRT MLE score scaled to [0, 60]."""
    if not responses:
        return 0.0

    if all(x == 1 for b, x in responses):
        return 60.0
    if all(x == 0 for b, x in responses):
        return 0.0

    def neg_log_likelihood(theta):
        nll = 0.0
        for star, correct in responses:
            b = star - 3  # mapping [1,5] stars to [-2,2] difficulty
            p = 1.0 / (1.0 + math.exp(-(theta - b)))
            p = max(min(p, 0.9999), 0.0001)
            if correct:
                nll -= math.log(p)
            else:
                nll -= math.log(1.0 - p)
        return nll

    # Find theta in [-4, 4]
    res = minimize_scalar(neg_log_likelihood, bounds=(-4, 4), method='bounded')
    theta = getattr(res, 'x', 0)

    # Map theta from [-4, 4] to [0, 60] scale
    score = ((theta + 4) / 8.0) * 60.0
    return max(0.0, min(60.0, score))


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
            exam.is_published
            or current_user.role == "admin"
            or exam.creator_id == current_user.id
        )
        if not can_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not allowed to access this exam",
            )
        return exam

    async def get_exam_detail(self, exam_id: UUID, current_user: User) -> TestExamDetailResponse:
        exam = await self._get_exam_entity(exam_id, current_user)
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
                    image_url=question.image_url,
                    difficulty=question.difficulty,
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
            time_limit=exam.time_limit,
            is_published=exam.is_published,
            audio_url=audio_url,
            total_questions=len(serialized_questions),
            mondai_groups=mondai_groups,
            questions=serialized_questions,
        )

    async def submit_exam(
        self,
        exam_id: UUID,
        payload: TestSubmitRequest,
        current_user: User,
    ) -> TestSubmitResponse:
        exam = await self._get_exam_entity(exam_id, current_user)
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

            difficulty = question.difficulty
            if difficulty is None:
                # Heuristics:
                # 2: Has image
                # 1: Short answer (<30 chars) and 3 choices
                # 4: Short text answers only (all choices <= 10 characters)
                # 3: Normal
                # (Can't check audio > 120s easily here without external lib on URLs, so stick to text-based heuristics)
                # Wait, test service doesn't have the audio clip object, just the URL.
                # So audio length check is skipped or assumed 3 if not 1, 2, 4.

                if question.image_url:
                    difficulty = 2
                else:
                    ans_list = list(question.answers)
                    total_ans_len = sum(len(a.content or "") for a in ans_list)
                    if len(ans_list) <= 3 and total_ans_len < 30:
                        difficulty = 1
                    elif len(ans_list) > 0 and all(len(a.content or "") <= 10 for a in ans_list):
                        difficulty = 4
                    else:
                        difficulty = 3

            # Treat unselected responses as incorrect
            responses.append((difficulty, is_correct))

        total_questions = len(sorted_questions)
        score = round(calculate_irt_score(responses), 2)

        result = UserResult(
            user_id=current_user.id,
            exam_id=exam.exam_id,
            score=score,
            total_questions=total_questions,
            correct_answers=correct_answers,
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
