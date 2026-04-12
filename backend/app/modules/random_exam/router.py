"""Random Exam Generation Router.

Endpoints for generating random exams from the question pool.
"""

import logging
import re
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user
from app.db.session import get_db
from app.modules.audio.models import Audio
from app.modules.exam.models import Exam
from app.modules.exam.schemas import ExamResponse
from app.modules.questions.models import Answer, Question
from app.modules.random_exam.schemas import (
    AnswerResponse,
    AudioMergeRequest,
    AudioMergeResponse,
    QuestionInRandomExam,
    RandomExamCreateRequest,
    RandomExamGenerateRequest,
    RandomExamGenerateResponse,
    RandomExamJobStatusResponse,
)
from app.modules.random_exam.service import RandomExamService
from app.modules.users.models import User
from app.shared.audio_utils import merge_audio_files
from app.shared.upload import upload_audio_bytes

router = APIRouter(prefix="/exams/random", tags=["random-exams"])
logger = logging.getLogger(__name__)

# In-memory job storage (use Redis in production)
_jobs: dict[str, dict] = {}
_service = RandomExamService()


def _question_to_response(question: Question) -> QuestionInRandomExam:
    """Convert Question model to response schema"""
    answers = [
        AnswerResponse(
            answer_id=str(a.answer_id),
            content=a.content,
            image_url=a.image_url,
            is_correct=a.is_correct,
            order_index=a.order_index,
        )
        for a in (question.answers or [])
    ]
    return QuestionInRandomExam(
        question_id=str(question.question_id),
        exam_id=str(question.exam_id),
        mondai_group=question.mondai_group,
        question_number=question.question_number,
        audio_clip_url=question.audio_clip_url,
        question_text=question.question_text,
        image_url=question.image_url,
        script_text=question.script_text,
        explanation=question.explanation,
        raw_transcript=question.raw_transcript,
        hide_question_text=question.hide_question_text,
        difficulty=question.difficulty,
        answers=answers,
    )


@router.post("/generate", response_model=RandomExamGenerateResponse, status_code=201)
async def generate_random_exam(
    payload: RandomExamGenerateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Start random exam generation process.

    This endpoint:
    1. Creates an exam record
    2. Starts background job to randomly select questions
    3. Returns job_id for polling progress

    Special handling:
    - Mondai 5 for N1/N2: Fetches ALL available questions (no randomization)
    - Other mondais: Randomly selects specified count
    """
    try:
        # Validate question pool first; do not create draft exam if requirements cannot be met.
        available = await _service.get_available_questions(db, payload.jlpt_level)
        _service.validate_mondai_pool(
            available,
            [c.model_dump() for c in payload.mondai_config],
            payload.jlpt_level,
        )

        job_id = str(uuid.uuid4())
        exam_id = str(uuid.uuid4())

        # Create exam record
        exam = Exam(
            exam_id=uuid.UUID(exam_id),
            creator_id=current_user.id,
            title=payload.title,
            description=payload.description,
            current_step=1,
            is_published=False,
        )
        db.add(exam)
        await db.flush()

        # Initialize job state
        job_state = {
            "exam_id": exam_id,
            "job_id": job_id,
            "status": "processing",
            "progress_message": "Initializing random exam generation...",
            "title": payload.title,
            "description": payload.description,
            "level": payload.jlpt_level,
            "total_questions": 0,
            "mondai_summary": {},
            "questions": [],
            "error": None,
        }
        _jobs[job_id] = job_state

        # Start background task
        background_tasks.add_task(
            _generate_exam_background,
            job_id=job_id,
            exam_id=exam_id,
            payload=payload,
            db=db,
            current_user=current_user,
        )

        await db.commit()

        return RandomExamGenerateResponse(
            exam_id=exam_id,
            job_id=job_id,
            status="processing",
            progress_message="Random exam generation started...",
            title=payload.title,
            description=payload.description,
            level=payload.jlpt_level,
            total_questions=0,
            mondai_summary={},
            questions=[],
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error starting random exam generation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


async def _generate_exam_background(
    job_id: str,
    exam_id: str,
    payload: RandomExamGenerateRequest,
    db: AsyncSession,
    current_user: User,
):
    """Background task for random exam generation"""
    try:
        job_state = _jobs.get(job_id)
        if not job_state:
            logger.error(f"Job state not found for job_id: {job_id}")
            return

        # Step 1: Get available questions
        job_state["progress_message"] = "Fetching available questions from database..."
        available = await _service.get_available_questions(db, payload.jlpt_level)

        # Step 2: Generate random selection with special mondai 5 handling
        job_state["progress_message"] = "Selecting random questions..."
        result = await _service.generate_random_exam(
            db=db,
            title=payload.title,
            description=payload.description,
            jlpt_level=payload.jlpt_level,
            mondai_config=[c.model_dump() for c in payload.mondai_config],
        )

        # Step 3: Convert questions to responses
        job_state["progress_message"] = "Preparing results..."
        question_responses = [_question_to_response(q) for q in result["questions"]]

        # Step 4: Update job state
        job_state["status"] = "done"
        job_state["progress_message"] = "Random exam generated successfully!"
        job_state["total_questions"] = result["total_questions"]
        job_state["mondai_summary"] = result["mondai_summary"]
        job_state["questions"] = question_responses

        logger.info(
            f"Random exam generated successfully: {result['total_questions']} questions, "
            f"mondai summary: {result['mondai_summary']}"
        )

    except Exception as e:
        logger.error(f"Error in background exam generation: {str(e)}")
        job_state = _jobs.get(job_id)
        if job_state:
            job_state["status"] = "failed"
            job_state["error"] = str(e)
            job_state["progress_message"] = ""


@router.get("/job/{job_id}", response_model=RandomExamJobStatusResponse)
async def get_job_status(job_id: str):
    """
    Check the status of a random exam generation job.

    Returns:
    - status: "pending", "processing", "done", or "failed"
    - progress_message: Current progress description
    - questions: Generated questions (only when status is "done")
    - error: Error message (only when status is "failed")
    """
    job_state = _jobs.get(job_id)
    if not job_state:
        raise HTTPException(status_code=404, detail="Job not found")

    return RandomExamJobStatusResponse(
        exam_id=job_state["exam_id"],
        job_id=job_state["job_id"],
        status=job_state["status"],
        progress_message=job_state.get("progress_message", ""),
        title=job_state["title"],
        description=job_state.get("description"),
        level=job_state["level"],
        total_questions=job_state.get("total_questions", 0),
        mondai_summary=job_state.get("mondai_summary", {}),
        questions=job_state.get("questions", []),
        error=job_state.get("error"),
    )


@router.delete("/job/{job_id}", status_code=204)
async def delete_job(job_id: str):
    """Clean up job from memory"""
    if job_id in _jobs:
        del _jobs[job_id]


@router.get("/available-questions", response_model=dict)
async def get_available_questions(
    level: str = Query("N2", description="JLPT level"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all available questions grouped by mondai for random selection.

    Returns a dict like:
    {
      "Mondai 1": {"count": 10, "questions": [...]},
      "Mondai 2": {"count": 12, "questions": [...]}
    }
    """
    try:
        available = await _service.get_available_questions(db, level)

        result = {}
        for mondai_group, questions in available.items():
            result[mondai_group] = {
                "count": len(questions),
                "questions": [_question_to_response(q) for q in questions],
            }

        return result

    except Exception as e:
        logger.error(f"Error fetching available questions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create", response_model=ExamResponse, status_code=201)
async def create_exam_from_random(
    payload: RandomExamCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create an exam from random selection results.

    This endpoint:
    1. Creates a new Exam record
    2. Creates Audio record if merged audio URL provided
    3. Copies selected questions to new exam
    4. Returns the created exam

    Args:
        payload.title: Exam title
        payload.description: Exam description
        payload.question_ids or payload.questions: List of question IDs to include
        payload.audio_file_url: Optional merged audio file URL
    """
    try:
        question_ids = payload.question_ids or payload.questions
        if not question_ids:
            raise ValueError("No questions provided")

        logger.info(f"Creating exam with {len(question_ids)} questions")

        # Step 1: Reuse existing draft exam if provided; otherwise create a new one.
        existing_exam: Exam | None = None
        if payload.exam_id:
            try:
                existing_exam_id = uuid.UUID(payload.exam_id)
                existing_exam = (
                    await db.execute(
                        select(Exam).where(
                            Exam.exam_id == existing_exam_id,
                            Exam.creator_id == current_user.id,
                        )
                    )
                ).scalar_one_or_none()
            except ValueError:
                logger.warning(f"Invalid exam_id ignored: {payload.exam_id}")

        new_exam_id = existing_exam.exam_id if existing_exam else uuid.uuid4()
        exam_audio_id = None

        # Step 2: Create Audio record if merged audio provided
        if payload.audio_file_url:
            logger.info(f"Creating audio record for merged audio: {payload.audio_file_url}")
            audio = Audio(
                audio_id=uuid.uuid4(),
                file_name=f"merged-audio-{new_exam_id}.m4a",
                file_url=payload.audio_file_url,
                duration=None,  # TODO: Calculate actual duration
                ai_status="completed",
                raw_transcript="Merged audio from random exam questions",
            )
            db.add(audio)
            await db.flush()
            exam_audio_id = audio.audio_id

        if existing_exam:
            # Clear previous generated questions before re-populating.
            await db.execute(delete(Question).where(Question.exam_id == existing_exam.exam_id))
            existing_exam.title = payload.title
            existing_exam.description = payload.description
            existing_exam.audio_id = exam_audio_id
            existing_exam.current_step = 1
            existing_exam.is_published = False
            new_exam = existing_exam
            await db.flush()
        else:
            new_exam = Exam(
                exam_id=new_exam_id,
                creator_id=current_user.id,
                audio_id=exam_audio_id,
                title=payload.title,
                description=payload.description,
                current_step=1,
                is_published=False,
            )
            db.add(new_exam)
            await db.flush()

        # Step 3: Copy selected questions to new exam
        logger.info(f"Copying {len(question_ids)} questions to new exam")

        source_ids: list[uuid.UUID] = []
        for raw_id in question_ids:
            try:
                source_ids.append(uuid.UUID(raw_id))
            except ValueError:
                logger.warning(f"Invalid question id skipped: {raw_id}")

        if not source_ids:
            raise ValueError("No valid question ids provided")

        source_questions = (
            await db.execute(
                select(Question)
                .where(Question.question_id.in_(source_ids))
                .options(selectinload(Question.answers))
            )
        ).scalars().all()

        source_index = {q.question_id: q for q in source_questions}
        ordered_source_questions: list[Question] = []
        for src_id in source_ids:
            src_q = source_index.get(src_id)
            if src_q:
                ordered_source_questions.append(src_q)
            else:
                logger.warning(f"Source question not found: {src_id}")

        def mondai_sort_key(q: Question) -> tuple[int, int]:
            label = q.mondai_group or ""
            match = re.search(r"(\d+)", label)
            mondai_number = int(match.group(1)) if match else 999
            question_number = q.question_number or 0
            return mondai_number, question_number

        ordered_source_questions.sort(key=mondai_sort_key)

        mondai_counters: dict[str, int] = {}
        for src_question in ordered_source_questions:
            try:
                # Renumber questions from 1 within each mondai group for the new exam.
                mondai_key = src_question.mondai_group or "Khác"
                next_question_number = mondai_counters.get(mondai_key, 0) + 1
                mondai_counters[mondai_key] = next_question_number

                # Create copy of question in new exam
                new_question = Question(
                    question_id=uuid.uuid4(),
                    exam_id=new_exam_id,
                    mondai_group=src_question.mondai_group,
                    question_number=next_question_number,
                    audio_clip_url=src_question.audio_clip_url,
                    question_text=src_question.question_text,
                    image_url=src_question.image_url,
                    script_text=src_question.script_text,
                    explanation=src_question.explanation,
                    raw_transcript=src_question.raw_transcript,
                    hide_question_text=src_question.hide_question_text,
                    difficulty=src_question.difficulty,
                )
                db.add(new_question)
                await db.flush()

                # Copy answers
                for src_answer in src_question.answers:
                    new_answer = Answer(
                        answer_id=uuid.uuid4(),
                        question_id=new_question.question_id,
                        content=src_answer.content,
                        image_url=src_answer.image_url,
                        is_correct=src_answer.is_correct,
                        order_index=src_answer.order_index,
                    )
                    db.add(new_answer)

            except Exception as e:
                logger.error(f"Error copying question {src_question.question_id}: {str(e)}")
                continue

        await db.commit()
        await db.refresh(new_exam)

        logger.info(f"Exam created successfully: {new_exam_id}")
        return new_exam

    except Exception as e:
        logger.error(f"Error creating exam from random selection: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create exam: {str(e)}")


@router.post("/merge-audio", response_model=AudioMergeResponse, status_code=201)
async def merge_audio_endpoint(
    payload: AudioMergeRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Merge multiple audio files with silence gaps between them.
    """
    try:
        logger.info(
            "Starting audio merge: %s files, %ss silence gaps",
            len(payload.audio_urls),
            payload.silence_duration,
        )

        merged_audio = await merge_audio_files(
            audio_urls=payload.audio_urls,
            silence_duration=payload.silence_duration,
        )

        logger.info("Audio merge completed. Merged file size: %s bytes", len(merged_audio))

        upload_result = await upload_audio_bytes(
            merged_audio,
            filename=f"merged-audio-{uuid.uuid4()}.m4a",
            folder="random-exam-merged-audio",
        )
        merged_audio_url = upload_result["secure_url"]
        return AudioMergeResponse(merged_audio_url=merged_audio_url)

    except Exception as e:
        logger.error(f"Error merging audio files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Audio merge failed: {str(e)}")
