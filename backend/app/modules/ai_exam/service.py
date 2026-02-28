import os
import io
import json
import logging
import time
import tempfile
import asyncio
import shutil
from pathlib import Path
from typing import Optional, List
from concurrent.futures import ThreadPoolExecutor

from app.core.config import get_settings
from app.modules.ai_exam.schemas import (
    AIExamResult, AIQuestion, AIQuestionOption,
    AITimestampMondai, AITimestampQuestion
)

settings = get_settings()
logger = logging.getLogger(__name__)


# ─── Helpers ───────────────────────────────────────────────────────────────

def _strip_json_markdown(text: str) -> str:
    """Strip ```json ... ``` or ``` ... ``` fences from LLM output."""
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]
    return text.strip()


# ─── ReazonSpeech Transcriber ──────────────────────────────────────────────

class ReazonTranscriber:
    """Local Japanese ASR using ReazonSpeech-k2."""

    def __init__(self, model_version: str = "reazonspeech-k2-v2"):
        self.model_version = model_version
        self._model = None

    def _load_model(self):
        try:
            from reazonspeech.k2.asr import load_model
            self._model = load_model(self.model_version)
            logger.info("ReazonSpeech model loaded.")
        except ImportError:
            raise RuntimeError(
                "ReazonSpeech not installed. Run: pip install reazonspeech-k2-asr"
            )

    def transcribe(self, audio_bytes: bytes, suffix: str = ".mp3") -> str:
        """Transcribe audio bytes → raw Japanese text."""
        try:
            from pydub import AudioSegment
            from pydub.silence import split_on_silence
            from reazonspeech.k2.asr import transcribe, audio_from_path
        except ImportError as e:
            raise RuntimeError(f"Missing dependency: {e}")

        if self._model is None:
            self._load_model()

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            audio = AudioSegment.from_file(tmp_path)
            silence_thresh = audio.dBFS - 14
            chunks = split_on_silence(
                audio,
                min_silence_len=250,
                silence_thresh=silence_thresh,
                keep_silence=200,
            )
            logger.info(f"Split into {len(chunks)} chunks for transcription.")

            chunk_dir = tempfile.mkdtemp(prefix="reazon_chunks_")
            full_transcript: List[str] = []

            try:
                # Export all chunk files first
                chunk_paths: List[tuple[int, str]] = []
                for i, chunk in enumerate(chunks):
                    if len(chunk) < 200:
                        continue
                    chunk_path = os.path.join(chunk_dir, f"chunk_{i}.wav")
                    chunk.export(chunk_path, format="wav")
                    chunk_paths.append((i, chunk_path))

                # Transcribe sequentially (k2 model is NOT thread-safe)
                for i, chunk_path in chunk_paths:
                    try:
                        ac = audio_from_path(chunk_path)
                        ret = transcribe(self._model, ac)
                        if ret.text and ret.text not in ("プ", "ピッ"):
                            full_transcript.append(ret.text)
                    except Exception as exc:
                        logger.warning(f"Chunk {i} transcription error: {exc}")
                    finally:
                        if os.path.exists(chunk_path):
                            os.remove(chunk_path)
            finally:
                shutil.rmtree(chunk_dir, ignore_errors=True)

            return "".join(full_transcript)
        finally:
            os.unlink(tmp_path)


# ─── Gemini Analyzer ───────────────────────────────────────────────────────

class GeminiAnalyzer:
    """Gemini AI for script refinement, timestamp detection, question generation."""

    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("GOOGLE_API_KEY is required.")
        from google import genai
        self._client = genai.Client(api_key=api_key)
        self._model_name = "gemini-2.5-flash"

    def _generate(self, contents: list) -> str:
        response = self._client.models.generate_content(
            model=self._model_name,
            contents=contents,
        )
        return response.text.strip()

    def upload_audio(self, audio_bytes: bytes, filename: str, max_retries: int = 3):
        """Upload audio to Gemini Files API and wait for processing.
        
        Retries on transient connection errors (BrokenPipe, ConnectionAborted, etc.).
        """
        from google.genai import types
        import mimetypes

        suffix = Path(filename).suffix
        mime_type = mimetypes.guess_type(filename)[0] or "audio/mpeg"

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            last_exc = None
            for attempt in range(1, max_retries + 1):
                try:
                    logger.info(f"Uploading audio to Gemini (attempt {attempt}/{max_retries})...")
                    audio_file = self._client.files.upload(
                        file=tmp_path,
                        config=types.UploadFileConfig(
                            display_name=filename,
                            mime_type=mime_type,
                        ),
                    )
                    while audio_file.state.name == "PROCESSING":
                        time.sleep(2)
                        audio_file = self._client.files.get(name=audio_file.name)
                    if audio_file.state.name == "FAILED":
                        raise RuntimeError("Gemini audio processing failed.")
                    logger.info(f"Audio uploaded successfully: {audio_file.uri}")
                    return audio_file
                except (BrokenPipeError, ConnectionError, OSError) as exc:
                    last_exc = exc
                    wait = 2 ** attempt
                    logger.warning(f"Upload attempt {attempt} failed ({exc}). Retrying in {wait}s...")
                    time.sleep(wait)
                except Exception as exc:
                    raise
            raise RuntimeError(f"Failed to upload audio after {max_retries} attempts: {last_exc}")
        finally:
            os.unlink(tmp_path)

    def delete_audio(self, audio_file) -> None:
        """Delete uploaded audio file from Gemini Files API to free storage."""
        try:
            self._client.files.delete(name=audio_file.name)
            logger.info(f"Deleted Gemini file: {audio_file.name}")
        except Exception as exc:
            logger.warning(f"Failed to delete Gemini file {audio_file.name}: {exc}")

    def refine_script(self, audio_file, raw_transcript: str) -> str:
        prompt = """
You are a professional Japanese transcriber specializing in JLPT listening tests.
Refine the raw ASR transcript using both the AUDIO and RAW TRANSCRIPT as input.

Structure for each question:
1. [Introduction]: Mondai number + situation description + initial question
2. [Conversation]: Dialogue with speaker labels (男：/ 女：)
3. [Question]: Final repeated question

Rules:
- Do NOT summarize. Keep full content.
- Add correct Japanese punctuation (。、? !)
- Output ONLY structured text, no extra commentary.

Format:
[Question N]
[Introduction]
...
[Conversation]
男：...
女：...
[Question]
...
"""
        return self._generate([prompt, audio_file, f"Raw Transcript:\n{raw_transcript}"])

    def generate_timestamps(self, audio_file, raw_transcript: str) -> List[AITimestampMondai]:
        prompt = """
You are an expert in analyzing JLPT listening tests.
Identify start and end timestamps for each Mondai and Question in the audio.

Definitions:
- Mondai: Top-level section (Mondai 1, 2, ...)
- Question: Individual questions (1番, 2番, ...), starts at BELL SOUND before number

Output ONLY valid JSON (no markdown blocks):
{
  "mondai": [
    {
      "mondai_number": 1,
      "title": "Mondai 1",
      "start_time": 0.0,
      "end_time": 120.5,
      "questions": [
        {"question_number": 1, "start_time": 0.0, "end_time": 15.5, "text": "..."}
      ]
    }
  ]
}
"""
        text = self._generate([prompt, audio_file, f"Raw Transcript:\n{raw_transcript}"])
        data = json.loads(_strip_json_markdown(text))

        return [
            AITimestampMondai(
                mondai_number=m["mondai_number"],
                title=m["title"],
                start_time=float(m["start_time"]),
                end_time=float(m["end_time"]),
                questions=[AITimestampQuestion(**q) for q in m.get("questions", [])],
            )
            for m in data.get("mondai", [])
        ]

    def generate_questions(
        self,
        audio_file,
        refined_script: str,
        jlpt_level: str,
        mondai_config: Optional[list] = None,
    ) -> List[AIQuestion]:
        if mondai_config:
            lines = [f"- Mondai {m.mondai_id}: {m.count} câu hỏi" for m in mondai_config]
            mondai_instruction = "Generate questions for:\n" + "\n".join(lines)
        else:
            mondai_instruction = "Generate appropriate number of questions per mondai."

        prompt = f"""
You are a JLPT {jlpt_level} exam creator.
Based on the REFINED SCRIPT and AUDIO, generate multiple-choice listening questions.

{mondai_instruction}

For each question:
- mondai_group: "Mondai 1", "Mondai 2", etc.
- question_number: sequential within mondai
- introduction: brief situation setup (Japanese)
- script_text: the conversation or monologue text (Japanese)
- question_text: the question asked (Japanese)
- answers: exactly 4 options (A/B/C/D), one is_correct=true

Output ONLY valid JSON array (no markdown):
[
  {{
    "mondai_group": "Mondai 1",
    "question_number": 1,
    "introduction": "...",
    "script_text": "男：...\\n女：...",
    "question_text": "女の人は何をしますか。",
    "answers": [
      {{"label": "A", "content": "...", "is_correct": false}},
      {{"label": "B", "content": "...", "is_correct": true}},
      {{"label": "C", "content": "...", "is_correct": false}},
      {{"label": "D", "content": "...", "is_correct": false}}
    ]
  }}
]
"""
        text = self._generate([prompt, audio_file, f"Refined Script:\n{refined_script}"])
        raw_questions = json.loads(_strip_json_markdown(text))

        return [
            AIQuestion(
                mondai_group=q["mondai_group"],
                question_number=q["question_number"],
                introduction=q.get("introduction"),
                script_text=q.get("script_text", ""),
                question_text=q.get("question_text", ""),
                answers=[AIQuestionOption(**a) for a in q.get("answers", [])],
            )
            for q in raw_questions
        ]


# ─── Main Orchestrator Service ──────────────────────────────────────────────

class AIExamService:
    """
    Optimized hybrid pipeline:

    Phase 1 (parallel):  ReazonSpeech ASR  ║  Gemini audio upload
    Phase 2 (parallel):  Gemini refine     ║  Gemini timestamps
    Phase 3 (sequential): Gemini questions (needs refined_script)
    Phase 4: Build audio URLs from timestamp map
    """

    def __init__(self):
        api_key = settings.GOOGLE_API_KEY
        self._reazon = ReazonTranscriber()
        try:
            self._reazon._load_model()
        except Exception as e:
            logger.warning(f"Failed to eagerly load ReazonSpeech model: {e}")
        self._gemini = GeminiAnalyzer(api_key) if api_key else None

    # ── sync wrappers so we can submit to ThreadPoolExecutor ──────────────

    def _run_transcribe(self, audio_bytes: bytes, suffix: str) -> str:
        try:
            return self._reazon.transcribe(audio_bytes, suffix=suffix)
        except RuntimeError as e:
            logger.warning(f"ReazonSpeech unavailable, skipping ASR: {e}")
            return "(ReazonSpeech not available – using Gemini only)"

    def _run_upload(self, audio_bytes: bytes, filename: str):
        return self._gemini.upload_audio(audio_bytes, filename)

    def _run_refine(self, audio_file, raw_transcript: str) -> str:
        return self._gemini.refine_script(audio_file, raw_transcript)

    def _run_timestamps(self, audio_file, raw_transcript: str):
        try:
            return self._gemini.generate_timestamps(audio_file, raw_transcript)
        except Exception as exc:
            logger.warning(f"Timestamp generation failed: {exc}")
            return None

    # ── async orchestration ───────────────────────────────────────────────

    async def _generate_async(
        self,
        audio_bytes: bytes,
        filename: str,
        jlpt_level: str,
        mondai_config: Optional[list],
        cloudinary_public_id: Optional[str],
        cloudinary_format: str,
    ) -> AIExamResult:

        loop = asyncio.get_event_loop()
        suffix = Path(filename).suffix

        # ── Phase 1: ASR + Upload in parallel ────────────────────────────
        logger.info("Phase 1: ReazonSpeech ASR + Gemini upload (parallel)...")
        with ThreadPoolExecutor(max_workers=2) as pool:
            raw_transcript, audio_file = await asyncio.gather(
                loop.run_in_executor(pool, self._run_transcribe, audio_bytes, suffix),
                loop.run_in_executor(pool, self._run_upload, audio_bytes, filename),
            )
        logger.info(f"Raw transcript: {len(raw_transcript)} chars | audio uploaded: {audio_file.name}")

        # ── Phase 2: Refine script + Timestamps in parallel ──────────────
        logger.info("Phase 2: Refine script + Timestamps (parallel)...")
        with ThreadPoolExecutor(max_workers=2) as pool:
            refined_script, timestamps = await asyncio.gather(
                loop.run_in_executor(pool, self._run_refine, audio_file, raw_transcript),
                loop.run_in_executor(pool, self._run_timestamps, audio_file, raw_transcript),
            )
        logger.info(f"Refined script: {len(refined_script)} chars")

        # ── Phase 3: Generate questions (needs refined_script) ────────────
        logger.info("Phase 3: Generating JLPT questions...")
        questions = self._gemini.generate_questions(
            audio_file, refined_script, jlpt_level, mondai_config
        )

        # ── Phase 4: Attach audio URLs ────────────────────────────────────
        if timestamps and cloudinary_public_id:
            self._attach_audio_urls(questions, timestamps, cloudinary_public_id, cloudinary_format)

        # ── Cleanup: delete uploaded Gemini file ──────────────────────────
        self._gemini.delete_audio(audio_file)

        return AIExamResult(
            raw_transcript=raw_transcript,
            refined_script=refined_script,
            timestamps=timestamps,
            questions=questions,
        )

    # ── public entry point ────────────────────────────────────────────────

    def generate(
        self,
        audio_bytes: bytes,
        filename: str,
        jlpt_level: str = "N2",
        mondai_config: Optional[list] = None,
        cloudinary_public_id: Optional[str] = None,
        cloudinary_format: Optional[str] = "mp3",
    ) -> AIExamResult:
        if not self._gemini:
            raise RuntimeError("GOOGLE_API_KEY not configured.")

        return asyncio.run(
            self._generate_async(
                audio_bytes, filename, jlpt_level,
                mondai_config, cloudinary_public_id, cloudinary_format,
            )
        )

    # ── helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _attach_audio_urls(
        questions: List[AIQuestion],
        timestamps: List[AITimestampMondai],
        cloudinary_public_id: str,
        cloudinary_format: str,
    ) -> None:
        import math
        import re
        import cloudinary.utils

        # Build (mondai_number, question_number) → (start, end) lookup
        ts_map = {
            (m.mondai_number, q.question_number): (q.start_time, q.end_time)
            for m in timestamps
            for q in m.questions
        }

        def _extract_number(s: str) -> int:
            match = re.search(r"\d+", s)
            return int(match.group()) if match else 0

        for q in questions:
            mondai_num = _extract_number(q.mondai_group)
            key = (mondai_num, q.question_number)
            if key not in ts_map:
                continue
            st, et = ts_map[key]
            audio_url, _ = cloudinary.utils.cloudinary_url(
                cloudinary_public_id,
                resource_type="video",
                format=cloudinary_format,
                start_offset=math.floor(st * 10) / 10.0,
                end_offset=math.ceil(et * 10) / 10.0,
                secure=True,
            )
            q.audio_url = audio_url