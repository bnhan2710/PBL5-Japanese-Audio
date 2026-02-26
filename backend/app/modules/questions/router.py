from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.security import get_current_user
from app.modules.users.models import User
from app.modules.questions.models import Question, Answer
from app.modules.questions.schemas import (
    QuestionCreate, QuestionUpdate, QuestionResponse, QuestionWithAnswersResponse,
    AnswerCreate, AnswerUpdate, AnswerResponse,
)
from app.shared.upload import upload_audio

router = APIRouter(tags=["questions"])


# ---------------------------------------------------------------------------
# Questions
# ---------------------------------------------------------------------------

@router.get("/exams/{exam_id}/questions", response_model=List[QuestionWithAnswersResponse])
async def list_questions(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Get all questions (with answers) for an exam."""
    result = await db.execute(
        select(Question)
        .where(Question.exam_id == exam_id)
        .order_by(Question.mondai_group, Question.question_number)
    )
    questions = result.scalars().all()
    # Eager-load answers for each question
    for q in questions:
        await db.refresh(q, attribute_names=["answers"])
    return questions


@router.post("/questions", response_model=QuestionWithAnswersResponse, status_code=201)
async def create_question(
    payload: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Create a question (and optionally its answers) for an exam."""
    question = Question(
        exam_id=payload.exam_id,
        mondai_group=payload.mondai_group,
        question_number=payload.question_number,
        audio_clip_url=payload.audio_clip_url,
        question_text=payload.question_text,
        image_url=payload.image_url,
        explanation=payload.explanation,
    )
    db.add(question)
    await db.flush()  # get question_id before adding answers

    for ans in (payload.answers or []):
        answer = Answer(
            question_id=question.question_id,
            content=ans.content,
            image_url=ans.image_url,
            is_correct=ans.is_correct,
            order_index=ans.order_index,
        )
        db.add(answer)

    await db.commit()
    await db.refresh(question, attribute_names=["answers"])
    return question


@router.get("/questions/{question_id}", response_model=QuestionWithAnswersResponse)
async def get_question(
    question_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Question).where(Question.question_id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    await db.refresh(question, attribute_names=["answers"])
    return question


@router.patch("/questions/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: UUID,
    payload: QuestionUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Question).where(Question.question_id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(question, field, value)

    await db.commit()
    await db.refresh(question)
    return question


@router.delete("/questions/{question_id}", status_code=204)
async def delete_question(
    question_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Question).where(Question.question_id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    await db.delete(question)
    await db.commit()


# ---------------------------------------------------------------------------
# Audio upload per question
# ---------------------------------------------------------------------------

@router.post(
    "/questions/{question_id}/audio",
    summary="Upload audio clip for a question",
    response_model=dict,
)
async def upload_question_audio(
    question_id: UUID,
    file: UploadFile = File(..., description="Audio file (mp3, wav, ogg – max 50 MB)"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Upload an audio file to Cloudinary and save the URL on the question."""
    result = await db.execute(select(Question).where(Question.question_id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    upload_result = await upload_audio(file, folder="question-audio")
    question.audio_clip_url = upload_result["secure_url"]

    await db.commit()
    await db.refresh(question)

    return {
        "question_id": str(question.question_id),
        "audio_clip_url": question.audio_clip_url,
        "duration": upload_result.get("duration"),
        "format": upload_result.get("format"),
    }


# ---------------------------------------------------------------------------
# Answers
# ---------------------------------------------------------------------------

@router.post("/answers", response_model=AnswerResponse, status_code=201)
async def create_answer(
    payload: AnswerCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    answer = Answer(**payload.model_dump())
    db.add(answer)
    await db.commit()
    await db.refresh(answer)
    return answer


@router.patch("/answers/{answer_id}", response_model=AnswerResponse)
async def update_answer(
    answer_id: UUID,
    payload: AnswerUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Answer).where(Answer.answer_id == answer_id))
    answer = result.scalar_one_or_none()
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(answer, field, value)

    await db.commit()
    await db.refresh(answer)
    return answer


@router.delete("/answers/{answer_id}", status_code=204)
async def delete_answer(
    answer_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Answer).where(Answer.answer_id == answer_id))
    answer = result.scalar_one_or_none()
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    await db.delete(answer)
    await db.commit()
