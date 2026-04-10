import io
import logging
import os
import re
import shutil
import tempfile
from collections import OrderedDict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional, Sequence

from app.modules.ai_exam.schemas import (
    AIExamResult,
    AIQuestion,
    AIQuestionOption,
    AISplitSegment,
    AITimestampMondai,
    AITimestampQuestion,
)

logger = logging.getLogger(__name__)
PIPELINE_VERSION = "ai-exam-cache-v6-reazon-local-ban-aware-numbering"
REPO_ROOT = Path(__file__).resolve().parents[4]
REAZON_SPLIT_DIR = REPO_ROOT / "R&D" / "Reazon" / "Spilit"
BELL_SOUND_PATH = REAZON_SPLIT_DIR / "Bell_sound.mp3"
BELL_2BAKU_PATH = REAZON_SPLIT_DIR / "Bell_2baku.mp3"
MAX_MONDAI = 5
MAX_QUESTIONS_PER_SEGMENT = 1

QUESTION_NUMBER_PATTERNS = [
    (re.compile(r"^(?:第)?(?:十二|じゅうに|ジュウニ|12)\s*番"), 12),
    (re.compile(r"^(?:第)?(?:十一|じゅういち|ジュウイチ|11)\s*番"), 11),
    (re.compile(r"^(?:第)?(?:十|じゅう|ジュウ|10)\s*番"), 10),
    (re.compile(r"^(?:第)?(?:九|きゅう|く|キュウ|ク|9)\s*番"), 9),
    (re.compile(r"^(?:第)?(?:八|はち|ハチ|8)\s*番"), 8),
    (re.compile(r"^(?:第)?(?:七|なな|しち|ナナ|シチ|7)\s*番"), 7),
    (re.compile(r"^(?:第)?(?:六|ろく|ロク|6)\s*番"), 6),
    (re.compile(r"^(?:第)?(?:五|ご|ゴ|5)\s*番"), 5),
    (re.compile(r"^(?:第)?(?:四|よん|ヨン|4)\s*番"), 4),
    (re.compile(r"^(?:第)?(?:三|さん|サン|3)\s*番"), 3),
    (re.compile(r"^(?:第)?(?:二|に|ニ|2)\s*番"), 2),
    (re.compile(r"^(?:第)?(?:一|いち|イチ|1)\s*番"), 1),
]

MONDAI_NUMBER_PATTERNS = [
    (re.compile(r"(?:問題|もんだい|モンダイ)\s*(?:五|ご|ゴ|5)"), 5),
    (re.compile(r"(?:問題|もんだい|モンダイ)\s*(?:四|よん|ヨン|4)"), 4),
    (re.compile(r"(?:問題|もんだい|モンダイ)\s*(?:三|さん|サン|3)"), 3),
    (re.compile(r"(?:問題|もんだい|モンダイ)\s*(?:二|に|ニ|2)"), 2),
    (re.compile(r"(?:問題|もんだい|モンダイ)\s*(?:一|いち|イチ|1)"), 1),
]


def _format_seconds(seconds: float) -> str:
    total_ms = int(round(seconds * 1000))
    minutes, ms = divmod(total_ms, 60000)
    secs, ms = divmod(ms, 1000)
    hours, minutes = divmod(minutes, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{ms:03d}"


def _strip_reazon_frame(text: str) -> str:
    lines = [line.rstrip() for line in (text or "").splitlines() if line.strip() and line.strip() != "--------"]
    return "\n".join(lines).strip()


def _split_sentences(text: str) -> list[str]:
    return [item.strip() for item in re.findall(r"[^。！？\n]+[。！？]?", text or "") if item.strip()]


def _normalize_sentence(sentence: str) -> str:
    normalized = (sentence or "").strip()
    if normalized and not normalized.endswith(("。", "？", "！")):
        normalized += "。"
    return normalized


def _is_question_sentence(sentence: str) -> bool:
    normalized = (sentence or "").strip()
    if not normalized:
        return False
    if "：" in normalized:
        return False
    if normalized.endswith(("か。", "か？", "ですか。", "でしょうか。", "ますか。")):
        return True
    if any(keyword in normalized for keyword in ["何", "どれ", "どこ", "誰", "いつ", "どう", "どの", "どちら", "いくつ", "なぜ", "どうして"]):
        return True
    return False


def _extract_question_texts(text: str) -> list[str]:
    sentences = _split_sentences(text)
    candidates = [_normalize_sentence(sentence) for sentence in sentences if _is_question_sentence(sentence)]
    deduped: list[str] = []
    for candidate in candidates:
        if candidate not in deduped:
            deduped.append(candidate)
    if deduped:
        return deduped[-1:]
    fallback = [_normalize_sentence(sentence) for sentence in sentences if "：" not in sentence]
    return fallback[-1:] if fallback else []


def _extract_spoken_question_number(text: str) -> Optional[int]:
    normalized_text = re.sub(r"^[\s。、「」『』\-\n]+", "", text or "")
    for pattern, number in QUESTION_NUMBER_PATTERNS:
        if pattern.search(normalized_text):
            return number
    return None


def _extract_announced_mondai_number(text: str) -> Optional[int]:
    normalized_text = re.sub(r"\s+", "", text or "")
    for pattern, number in MONDAI_NUMBER_PATTERNS:
        if pattern.search(normalized_text):
            return number
    return None


def _extract_mondai_number(label: str | None) -> int:
    if not label:
        return 0
    match = re.search(r"\d+", label)
    return int(match.group()) if match else 0


def _strip_leading_ban_block(text: str) -> str:
    lines = [line.rstrip() for line in (text or "").splitlines()]
    if not lines:
        return ""

    first_content_index: Optional[int] = None
    for index, line in enumerate(lines):
        if line.strip():
            first_content_index = index
            break

    if first_content_index is None:
        return ""

    first_line = lines[first_content_index].strip()
    if _extract_spoken_question_number(first_line) is not None:
        lines = lines[first_content_index + 1 :]
    else:
        lines = lines[first_content_index:]

    return "\n".join(lines).strip()


def _build_contextual_question_text(cleaned_text: str, current_question_text: str) -> str:
    question_text = (current_question_text or "").strip()
    body = _strip_leading_ban_block(cleaned_text)
    if not body:
        return question_text

    lines = [line.strip() for line in body.splitlines() if line.strip()]
    intro_lines: list[str] = []
    for line in lines:
        if re.match(r"^[^：\n]{1,12}：", line):
            break
        intro_lines.append(line)

    contextual = "\n".join(intro_lines).strip()
    return contextual or question_text


def _strip_speaker_prefix(text: str) -> str:
    return re.sub(r"^[^：\n]{1,12}：", "", (text or "").strip()).strip()


def _clean_option_text(text: str) -> str:
    cleaned = re.sub(r"\s+", "", (text or "").strip())
    cleaned = cleaned.strip("。！？、")
    return cleaned


def _extract_dialogue_sentences(script_text: str) -> list[str]:
    lines = [line.strip() for line in (script_text or "").splitlines() if line.strip()]
    sentences: list[str] = []
    for line in lines:
        speaker_free = _strip_speaker_prefix(line)
        for sentence in _split_sentences(speaker_free):
            normalized = _clean_option_text(sentence)
            if normalized:
                sentences.append(normalized)
    return sentences


def _extract_regex_candidates(pattern: str, text: str) -> list[str]:
    seen: list[str] = []
    for match in re.findall(pattern, text or ""):
        value = _clean_option_text(match)
        if value and value not in seen:
            seen.append(value)
    return seen


def _question_type(question_text: str) -> str:
    text = question_text or ""
    if any(keyword in text for keyword in ["何時", "いつ", "何曜日", "何日"]):
        return "time"
    if any(keyword in text for keyword in ["いくつ", "何個", "何本", "何枚", "何人", "いくら", "何階", "何冊"]):
        return "quantity"
    if any(keyword in text for keyword in ["どこ", "どちら", "どの場所"]):
        return "place"
    if any(keyword in text for keyword in ["誰", "どの人"]):
        return "person"
    if any(keyword in text for keyword in ["どうして", "なぜ"]):
        return "reason"
    if "どう" in text:
        return "method"
    return "generic"


def _extract_time_candidates(text: str) -> list[str]:
    return _extract_regex_candidates(
        r"(?:午前|午後)?\d{1,2}時(?:半|\d{1,2}分)?|(?:午前|午後)?[一二三四五六七八九十]+時(?:半|[一二三四五六七八九十]+分)?",
        text,
    )


def _extract_quantity_candidates(text: str) -> list[str]:
    return _extract_regex_candidates(
        r"\d+(?:人|個|本|枚|つ|円|階|冊|回|日)|[一二三四五六七八九十百]+(?:人|個|本|枚|つ|円|階|冊|回|日)",
        text,
    )


def _extract_place_candidates(text: str) -> list[str]:
    return _extract_regex_candidates(
        r"(?:学校|会社|駅|会議室|教室|図書館|食堂|店|スーパー|病院|郵便局|銀行|公園|家|うち|受付|空港|ホテル|レストラン|喫茶店|部屋|教務課|事務所|売り場)",
        text,
    )


def _extract_person_candidates(text: str) -> list[str]:
    return _extract_regex_candidates(
        r"(?:男の人|女の人|学生|先生|店員|社員|部長|課長|受付の人|田中さん|山田さん|佐藤さん)",
        text,
    )


def _fallback_candidates(script_text: str) -> list[str]:
    sentences = _extract_dialogue_sentences(script_text)
    candidates: list[str] = []
    for sentence in sentences:
        trimmed = sentence
        if len(trimmed) > 24:
            trimmed = trimmed[:24].rstrip("、") + "…"
        if trimmed and trimmed not in candidates:
            candidates.append(trimmed)
    return candidates


def _mutate_time_option(base: str, offset: int) -> str:
    match = re.search(r"(\d{1,2}|[一二三四五六七八九十]+)時", base)
    if not match:
        return base
    numeral = match.group(1)
    kanji_to_int = {
        "一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
        "六": 6, "七": 7, "八": 8, "九": 9, "十": 10,
    }
    if numeral.isdigit():
        hour = int(numeral)
    else:
        hour = 10 if numeral == "十" else kanji_to_int.get(numeral, 1)
    new_hour = max(1, min(12, hour + offset))
    return base.replace(match.group(0), f"{new_hour}時", 1)


def _mutate_quantity_option(base: str, offset: int) -> str:
    match = re.search(r"(\d+)(人|個|本|枚|つ|円|階|冊|回|日)", base)
    if not match:
        return base
    value = max(1, int(match.group(1)) + offset)
    return f"{value}{match.group(2)}"


def _choose_correct_answer(question_type: str, script_text: str, question_text: str) -> str:
    source_text = f"{script_text}\n{question_text}"
    if question_type == "time":
        candidates = _extract_time_candidates(source_text)
    elif question_type == "quantity":
        candidates = _extract_quantity_candidates(source_text)
    elif question_type == "place":
        candidates = _extract_place_candidates(source_text)
    elif question_type == "person":
        candidates = _extract_person_candidates(source_text)
    else:
        candidates = _fallback_candidates(script_text)

    if candidates:
        return candidates[-1]

    fallback_sentences = _extract_dialogue_sentences(script_text)
    return fallback_sentences[-1] if fallback_sentences else "内容を確認する"


def _build_answer_options(question_number: int, script_text: str, question_text: str) -> list[AIQuestionOption]:
    return [
        AIQuestionOption(label=label, content="", is_correct=False)
        for label in ["A", "B", "C", "D"]
    ]


def _estimate_question_difficulty(script_text: str, question_text: str, answers: Sequence[AIQuestionOption]) -> int:
    question_type = _question_type(question_text)
    script_len = len(re.sub(r"\s+", "", script_text or ""))
    answer_count = len([answer for answer in answers if answer.content.strip()])

    difficulty = 3
    if question_type in {"time", "quantity"}:
        difficulty -= 1
    if question_type in {"reason", "method"}:
        difficulty += 1
    if script_len > 70:
        difficulty += 1
    if answer_count <= 3:
        difficulty -= 1
    return max(1, min(5, difficulty))


def _parse_formatted_segment(formatted_text: str, raw_text: str) -> tuple[Optional[str], str, list[str], Optional[int], Optional[int]]:
    cleaned = _strip_reazon_frame(formatted_text)
    blocks = [block.strip() for block in re.split(r"\n\s*\n", cleaned) if block.strip()]

    introduction = blocks[0] if blocks else ""
    outro = blocks[-1] if len(blocks) >= 2 else ""
    dialogue_blocks = blocks[1:-1] if len(blocks) >= 3 else []
    script_text = "\n\n".join(dialogue_blocks).strip()

    if not script_text:
        speaker_lines = [line.strip() for line in cleaned.splitlines() if "：" in line]
        if speaker_lines:
            script_text = "\n".join(speaker_lines).strip()
        elif len(blocks) >= 2:
            script_text = "\n\n".join(blocks[:-1]).strip()
        else:
            script_text = cleaned or raw_text

    question_texts = _extract_question_texts(outro)
    if not question_texts:
        tail_source = blocks[-2] + "\n" + blocks[-1] if len(blocks) >= 2 else cleaned
        question_texts = _extract_question_texts(tail_source)
    if not question_texts:
        fallback_question = _normalize_sentence(outro.strip()) if outro.strip() and "：" not in outro else ""
        question_texts = [fallback_question] if fallback_question else [""]

    spoken_number = _extract_spoken_question_number(introduction or cleaned or raw_text)
    announced_mondai_number = _extract_announced_mondai_number(cleaned or raw_text)
    limited_question_texts = question_texts[-1:] or [""]
    if limited_question_texts and limited_question_texts[0]:
        limited_question_texts = [
            _build_contextual_question_text(cleaned, limited_question_texts[0])
        ]
    return introduction or None, script_text or raw_text, limited_question_texts, spoken_number, announced_mondai_number


def _format_jlpt_master(chunks_data: Sequence[dict]) -> str:
    if not chunks_data:
        return ""

    texts: list[str] = []
    for chunk in chunks_data:
        text = re.sub(r"(ピン|パン|プッ|ピッ|プ|ピ)", "", chunk.get("text", ""))
        text = text.replace("。", "").strip()
        texts.append(text)

    genders = [chunk.get("gender", "Unknown") for chunk in chunks_data]

    dialogue_start = 0
    for index, text in enumerate(texts):
        if text.endswith("か") or text.endswith("か？"):
            dialogue_start = index + 1
            break
    if dialogue_start == 0:
        dialogue_start = min(2, len(texts))

    intro_texts = [text for text in texts[:dialogue_start] if text]
    intro_str = "。".join(intro_texts)
    if intro_str:
        intro_str += "。"
    intro_str = re.sub(r"(次。?)", "", intro_str).strip()
    intro_str = re.sub(r"((?:一|二|三|四|五|六|七|八|九|十|1|2|3|4|5|6|7|8|9|10)番)？?。?", r"\1\n", intro_str)

    dialogue_end = len(texts)
    for index in range(len(texts) - 1, dialogue_start - 1, -1):
        if texts[index].endswith("か") or texts[index].endswith("か？"):
            out_start = index
            for inner in range(index, max(dialogue_start - 1, index - 5), -1):
                if any(subject in texts[inner] for subject in ["男の人", "女の人", "学生", "男の子", "女の子", "人", "何"]):
                    out_start = inner
            dialogue_end = out_start
            break

    outro_texts = [text for text in texts[dialogue_end:] if text]
    outro_str = "。".join(outro_texts)
    if outro_str:
        outro_str += "。"

    dialogue_blocks: list[str] = []
    current_gender = None
    current_text = ""
    for index in range(dialogue_start, dialogue_end):
        text = texts[index]
        gender = genders[index]
        if not text:
            continue
        if gender == "Unknown":
            gender = current_gender if current_gender else "女"
        if gender == current_gender:
            current_text += "。" + text
        else:
            if current_text:
                dialogue_blocks.append(f"{current_gender}：{current_text}。")
            current_gender = gender
            current_text = text

    if current_text:
        dialogue_blocks.append(f"{current_gender}：{current_text}。")

    dialogue_blocks = [block.replace("：。", "：") for block in dialogue_blocks]

    output = ["--------"]
    if intro_str:
        output.append(intro_str)
        output.append("")
    if dialogue_blocks:
        output.extend(dialogue_blocks)
        output.append("")
    if outro_str:
        output.append(outro_str)
    output.append("--------")
    return "\n".join(output).strip()


@dataclass
class SplitAudioChunk:
    segment_index: int
    file_name: str
    start_ms: int
    end_ms: int
    audio_bytes: bytes
    transcript: str = ""
    refined_transcript: str = ""
    introduction: Optional[str] = None
    script_text: str = ""
    question_texts: list[str] = field(default_factory=list)
    spoken_question_number: Optional[int] = None
    announced_mondai_number: Optional[int] = None


@dataclass
class StructuredSegment:
    source_segment_index: int
    source_question_index: int
    mondai_group: str
    question_number: int
    introduction: Optional[str]
    script_text: str
    question_text: str
    refined_transcript: str


class BellAudioSplitter:
    """Detect bell timestamps, skip Bell_2baku traps, and cut question clips."""

    def __init__(
        self,
        bell1_path: Path = BELL_SOUND_PATH,
        bell2_path: Path = BELL_2BAKU_PATH,
        threshold_percent: float = 0.85,
        min_distance_sec: int = 10,
        trap_window_sec: float = 4.0,
        trim_before_next_bell_ms: int = 100,
        min_segment_length_ms: int = 1500,
    ):
        self.bell1_path = bell1_path
        self.bell2_path = bell2_path
        self.threshold_percent = threshold_percent
        self.min_distance_sec = min_distance_sec
        self.trap_window_sec = trap_window_sec
        self.trim_before_next_bell_ms = trim_before_next_bell_ms
        self.min_segment_length_ms = min_segment_length_ms

    def _ensure_assets(self) -> None:
        missing = [str(path) for path in (self.bell1_path, self.bell2_path) if not path.exists()]
        if missing:
            raise RuntimeError(f"Bell sample file not found: {', '.join(missing)}")

    def find_question_starts(self, audio_path: str) -> list[int]:
        import librosa
        import numpy as np
        from scipy import signal

        self._ensure_assets()

        main_audio, sr = librosa.load(audio_path, sr=None, mono=True)
        bell1_audio, _ = librosa.load(str(self.bell1_path), sr=sr, mono=True)
        bell2_audio, _ = librosa.load(str(self.bell2_path), sr=sr, mono=True)

        corr2 = signal.correlate(main_audio, bell2_audio, mode="valid", method="fft")
        thresh2 = float(np.max(corr2)) * self.threshold_percent
        peaks2, _ = signal.find_peaks(corr2, height=thresh2, distance=sr * self.min_distance_sec)
        bell2_times_sec = [peak / sr for peak in peaks2]

        corr1 = signal.correlate(main_audio, bell1_audio, mode="valid", method="fft")
        thresh1 = float(np.max(corr1)) * self.threshold_percent
        peaks1, _ = signal.find_peaks(corr1, height=thresh1, distance=sr * self.min_distance_sec)
        bell1_times_sec = [peak / sr for peak in peaks1]

        valid_bell_times_ms: list[int] = []
        for bell_time in bell1_times_sec:
            if any(abs(bell_time - trap_time) < self.trap_window_sec for trap_time in bell2_times_sec):
                continue
            bell_ms = int(bell_time * 1000)
            if valid_bell_times_ms and bell_ms - valid_bell_times_ms[-1] < self.min_segment_length_ms:
                continue
            valid_bell_times_ms.append(bell_ms)

        return valid_bell_times_ms

    def _build_full_audio_segment(self, audio_path: str) -> SplitAudioChunk:
        from pydub import AudioSegment

        audio = AudioSegment.from_file(audio_path)
        if len(audio) < self.min_segment_length_ms:
            raise RuntimeError("Audio is too short to process.")

        buffer = io.BytesIO()
        audio.export(buffer, format="wav")
        return SplitAudioChunk(
            segment_index=1,
            file_name="segment_01.wav",
            start_ms=0,
            end_ms=len(audio),
            audio_bytes=buffer.getvalue(),
        )

    def split_audio(self, audio_bytes: bytes, suffix: str = ".mp3") -> list[SplitAudioChunk]:
        from pydub import AudioSegment

        with tempfile.NamedTemporaryFile(suffix=suffix or ".mp3", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            bell_times_ms = self.find_question_starts(tmp_path)
            if not bell_times_ms:
                logger.warning(
                    "No valid bell timestamps found in audio. Falling back to a single full-length segment."
                )
                return [self._build_full_audio_segment(tmp_path)]

            audio = AudioSegment.from_file(tmp_path)
            segments: list[SplitAudioChunk] = []
            for index, start_ms in enumerate(bell_times_ms):
                next_start_ms = bell_times_ms[index + 1] if index + 1 < len(bell_times_ms) else len(audio)
                end_ms = next_start_ms - self.trim_before_next_bell_ms if index + 1 < len(bell_times_ms) else next_start_ms
                end_ms = max(end_ms, start_ms)
                if end_ms - start_ms < self.min_segment_length_ms:
                    logger.warning(
                        "Skipping split segment %s because it is too short: %.2fs",
                        index + 1,
                        (end_ms - start_ms) / 1000.0,
                    )
                    continue

                chunk = audio[start_ms:end_ms]
                buffer = io.BytesIO()
                chunk.export(buffer, format="wav")
                segments.append(
                    SplitAudioChunk(
                        segment_index=len(segments) + 1,
                        file_name=f"segment_{len(segments) + 1:02d}.wav",
                        start_ms=start_ms,
                        end_ms=end_ms,
                        audio_bytes=buffer.getvalue(),
                    )
                )

            if not segments:
                raise RuntimeError("Bell timestamps were detected, but no usable audio segments were produced.")

            return segments
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)


class ReazonTranscriber:
    """Local Japanese ASR using ReazonSpeech-k2 + local speaker formatting."""

    NOISE_PATTERN = re.compile(r"(ピン|パン|プッ|ピッ|プ|ピ)")

    def __init__(self, model_version: str = "reazonspeech-k2-v2"):
        self.model_version = model_version
        self._model = None
        self._gender_classifier = None
        self._gender_classifier_attempted = False

    def _load_model(self) -> None:
        try:
            from reazonspeech.k2.asr import load_model

            self._model = load_model(self.model_version)
            logger.info("ReazonSpeech model loaded.")
        except ImportError as exc:
            raise RuntimeError(
                "ReazonSpeech not installed. Run: pip install reazonspeech-k2-asr"
            ) from exc

    def _load_gender_classifier(self) -> None:
        if self._gender_classifier_attempted:
            return
        self._gender_classifier_attempted = True
        try:
            from transformers import pipeline

            self._gender_classifier = pipeline(
                "audio-classification",
                model="alefiury/wav2vec2-large-xlsr-53-gender-recognition-librispeech",
            )
            logger.info("Gender classifier loaded.")
        except ImportError:
            logger.warning("transformers is not installed. Continuing without gender classifier.")
            self._gender_classifier = None
        except Exception as exc:
            logger.warning("Failed to load gender classifier: %s", exc)
            self._gender_classifier = None

    def _clean_text(self, text: str) -> str:
        text = self.NOISE_PATTERN.sub("", text or "")
        text = re.sub(r"\s+", "", text)
        return text.strip()

    def _predict_gender(self, audio_path: str) -> str:
        self._load_gender_classifier()
        if self._gender_classifier is None:
            return "Unknown"
        try:
            prediction = self._gender_classifier(audio_path)
            top_label = prediction[0]["label"].lower()
            return "男" if top_label == "male" else "女"
        except Exception as exc:
            logger.warning("Gender classification failed for %s: %s", audio_path, exc)
            return "Unknown"

    def transcribe(self, audio_bytes: bytes, suffix: str = ".wav") -> dict:
        try:
            from pydub import AudioSegment
            from pydub.silence import split_on_silence
            from reazonspeech.k2.asr import audio_from_path, transcribe
        except ImportError as exc:
            raise RuntimeError(f"Missing dependency: {exc}") from exc

        if self._model is None:
            self._load_model()

        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            audio = AudioSegment.from_file(tmp_path)
            silence_thresh = audio.dBFS - 14 if audio.dBFS != float("-inf") else -50
            chunks = split_on_silence(
                audio,
                min_silence_len=400,
                silence_thresh=silence_thresh,
                keep_silence=150,
            )
            if not chunks:
                chunks = [audio]

            chunk_dir = tempfile.mkdtemp(prefix="reazon_chunks_")
            chunks_data: list[dict] = []
            raw_parts: list[str] = []
            try:
                for index, chunk in enumerate(chunks):
                    if len(chunk) < 300:
                        continue
                    chunk_path = os.path.join(chunk_dir, f"chunk_{index}.wav")
                    chunk.export(chunk_path, format="wav")
                    try:
                        audio_content = audio_from_path(chunk_path)
                        result = transcribe(self._model, audio_content)
                        text = self._clean_text(result.text if result else "")
                        if not text:
                            continue
                        gender = self._predict_gender(chunk_path)
                        raw_parts.append(text)
                        chunks_data.append({"text": text, "gender": gender})
                    except Exception as exc:
                        logger.warning("Chunk %s transcription error: %s", index, exc)
                    finally:
                        if os.path.exists(chunk_path):
                            os.remove(chunk_path)
            finally:
                shutil.rmtree(chunk_dir, ignore_errors=True)

            raw_text = "".join(raw_parts)
            formatted_text = _format_jlpt_master(chunks_data) or raw_text
            introduction, script_text, question_texts, spoken_number, announced_mondai_number = _parse_formatted_segment(
                formatted_text,
                raw_text,
            )
            return {
                "raw_text": raw_text,
                "formatted_text": formatted_text,
                "introduction": introduction,
                "script_text": script_text,
                "question_texts": question_texts,
                "spoken_question_number": spoken_number,
                "announced_mondai_number": announced_mondai_number,
            }
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)


class AIExamService:
    """Split by bell first, then transcribe each cut with local ReazonSpeech formatting."""

    def __init__(self):
        self._splitter = BellAudioSplitter()
        self._reazon = ReazonTranscriber()
        try:
            self._reazon._load_model()
        except Exception as exc:
            logger.warning("Failed to eagerly load ReazonSpeech model: %s", exc)

    def generate(
        self,
        audio_bytes: bytes,
        filename: str,
        jlpt_level: str = "N2",
        mondai_config: Optional[list] = None,
        cloudinary_public_id: Optional[str] = None,
        cloudinary_format: Optional[str] = "mp3",
        progress_callback: Optional[Callable[[str], None]] = None,
    ) -> AIExamResult:
        self._notify(progress_callback, "Step 2/7: Detecting bell timestamps...")
        split_segments = self._splitter.split_audio(audio_bytes, suffix=Path(filename).suffix or ".mp3")
        logger.info("Split audio into %s bell-based segments.", len(split_segments))

        self._notify(progress_callback, "Step 3/7: Cutting question audio with PyDub...")
        split_segments = list(split_segments)

        self._notify(progress_callback, "Step 4/7: ReazonSpeech transcribing split audio...")
        for segment in split_segments:
            transcript_result = self._reazon.transcribe(segment.audio_bytes, suffix=".wav")
            segment.transcript = transcript_result["raw_text"]
            segment.refined_transcript = transcript_result["formatted_text"]
            segment.introduction = transcript_result["introduction"]
            segment.script_text = transcript_result["script_text"]
            segment.question_texts = transcript_result["question_texts"]
            segment.spoken_question_number = transcript_result["spoken_question_number"]
            segment.announced_mondai_number = transcript_result.get("announced_mondai_number")

        self._notify(progress_callback, "Step 5/7: Formatting scripts with local Reazon rules...")
        structured_segments = self._build_structured_segments(split_segments)

        self._notify(progress_callback, "Step 6/7: Building local question drafts...")
        questions = self._build_questions(structured_segments, split_segments)
        timestamps = self._build_timestamps(questions)
        refined_script = self._build_refined_script(structured_segments)
        raw_transcript = self._build_raw_transcript(split_segments)
        result_split_segments = [
            AISplitSegment(
                segment_index=segment.segment_index,
                file_name=segment.file_name,
                start_time=segment.start_ms / 1000.0,
                end_time=segment.end_ms / 1000.0,
                transcript=segment.transcript,
                refined_transcript=segment.refined_transcript or None,
            )
            for segment in split_segments
        ]

        self._notify(progress_callback, "Step 7/7: Attaching clipped audio URLs...")
        if cloudinary_public_id:
            self._attach_audio_urls(questions, cloudinary_public_id, cloudinary_format or "mp3")

        return AIExamResult(
            raw_transcript=raw_transcript,
            refined_script=refined_script,
            split_segments=result_split_segments,
            timestamps=timestamps,
            questions=questions,
        )

    @property
    def model_name(self) -> str:
        return "reazonspeech-local"

    @property
    def pipeline_version(self) -> str:
        return PIPELINE_VERSION

    @staticmethod
    def _notify(progress_callback: Optional[Callable[[str], None]], message: str) -> None:
        if progress_callback:
            progress_callback(message)

    @staticmethod
    def _build_structured_segments(split_segments: Sequence[SplitAudioChunk]) -> list[StructuredSegment]:
        structured: list[StructuredSegment] = []
        current_mondai = 1
        last_question_number = 0

        for segment in split_segments:
            question_text = (segment.question_texts[-1] if segment.question_texts else "")
            base_question_number = segment.spoken_question_number
            announced_mondai_number = segment.announced_mondai_number

            if announced_mondai_number is not None:
                current_mondai = max(1, min(MAX_MONDAI, announced_mondai_number))
                if not structured or current_mondai != _extract_mondai_number(structured[-1].mondai_group):
                    last_question_number = 0

            if base_question_number is None:
                base_question_number = last_question_number + 1 if last_question_number else 1
            elif structured and base_question_number == 1 and last_question_number >= 1:
                if current_mondai < MAX_MONDAI:
                    current_mondai += 1
                    last_question_number = 0
                else:
                    base_question_number = last_question_number + 1

            structured.append(
                StructuredSegment(
                    source_segment_index=segment.segment_index,
                    source_question_index=1,
                    mondai_group=f"Mondai {current_mondai}",
                    question_number=base_question_number,
                    introduction=segment.introduction,
                    script_text=segment.script_text or segment.refined_transcript or segment.transcript,
                    question_text=question_text,
                    refined_transcript=segment.refined_transcript or segment.transcript,
                )
            )

            last_question_number = base_question_number

        return structured

    @staticmethod
    def _build_raw_transcript(split_segments: Sequence[SplitAudioChunk]) -> str:
        lines = []
        for segment in split_segments:
            lines.append(
                f"[Segment {segment.segment_index:02d}] "
                f"{_format_seconds(segment.start_ms / 1000.0)} -> {_format_seconds(segment.end_ms / 1000.0)}"
            )
            lines.append(segment.transcript or "(empty)")
            lines.append("")
        return "\n".join(lines).strip()

    @staticmethod
    def _build_refined_script(structured_segments: Sequence[StructuredSegment]) -> str:
        grouped: "OrderedDict[str, list[StructuredSegment]]" = OrderedDict()
        for segment in structured_segments:
            grouped.setdefault(segment.mondai_group, []).append(segment)

        blocks: list[str] = []
        for mondai_group, segments in grouped.items():
            blocks.append(f"[{mondai_group}]")
            for segment in segments:
                blocks.append(f"[Question {segment.question_number}]")
                if segment.introduction:
                    blocks.append("[Introduction]")
                    blocks.append(segment.introduction)
                if segment.script_text:
                    blocks.append("[Conversation]")
                    blocks.append(segment.script_text)
                if segment.question_text:
                    blocks.append("[Question]")
                    blocks.append(segment.question_text)
                blocks.append("")
        return "\n".join(blocks).strip()

    @staticmethod
    def _build_questions(
        structured_segments: Sequence[StructuredSegment],
        split_segments: Sequence[SplitAudioChunk],
    ) -> list[AIQuestion]:
        segment_map = {segment.segment_index: segment for segment in split_segments}
        questions: list[AIQuestion] = []
        for structured in structured_segments:
            source = segment_map[structured.source_segment_index]
            answers = _build_answer_options(
                structured.question_number,
                structured.script_text or structured.refined_transcript or source.transcript,
                structured.question_text,
            )
            questions.append(
                AIQuestion(
                    mondai_group=structured.mondai_group,
                    question_number=structured.question_number,
                    introduction=structured.introduction,
                    script_text=structured.script_text or structured.refined_transcript or source.transcript,
                    question_text=structured.question_text,
                    difficulty=_estimate_question_difficulty(
                        structured.script_text or structured.refined_transcript or source.transcript,
                        structured.question_text,
                        answers,
                    ),
                    image_url=None,
                    source_segment_index=structured.source_segment_index,
                    source_question_index=structured.source_question_index,
                    source_start_time=source.start_ms / 1000.0,
                    source_end_time=source.end_ms / 1000.0,
                    source_transcript=source.refined_transcript or source.transcript,
                    answers=answers,
                )
            )
        return questions

    @staticmethod
    def _build_timestamps(questions: Sequence[AIQuestion]) -> list[AITimestampMondai]:
        grouped: "OrderedDict[str, list[AIQuestion]]" = OrderedDict()
        for question in questions:
            grouped.setdefault(question.mondai_group, []).append(question)

        timestamps: list[AITimestampMondai] = []
        fallback_mondai_number = 0
        for group_label, group_questions in grouped.items():
            match = re.search(r"(\d+)", group_label or "")
            if match:
                mondai_number = int(match.group(1))
            else:
                fallback_mondai_number += 1
                mondai_number = fallback_mondai_number

            valid_questions = [
                question
                for question in group_questions
                if question.source_start_time is not None and question.source_end_time is not None
            ]
            if not valid_questions:
                continue

            timestamps.append(
                AITimestampMondai(
                    mondai_number=mondai_number,
                    title=group_label.lower(),
                    start_time=min(question.source_start_time for question in valid_questions),
                    end_time=max(question.source_end_time for question in valid_questions),
                    questions=[
                        AITimestampQuestion(
                            question_number=question.question_number,
                            start_time=float(question.source_start_time),
                            end_time=float(question.source_end_time),
                            text=question.question_text or question.source_transcript,
                        )
                        for question in valid_questions
                    ],
                )
            )
        return timestamps

    @staticmethod
    def _attach_audio_urls(
        questions: Sequence[AIQuestion],
        cloudinary_public_id: str,
        cloudinary_format: str,
    ) -> None:
        import math
        import cloudinary.utils

        for question in questions:
            if question.source_start_time is None or question.source_end_time is None:
                logger.warning(
                    "Q(%s,%s): missing source timestamps, audio_url will be empty",
                    question.mondai_group,
                    question.question_number,
                )
                continue

            audio_url, _ = cloudinary.utils.cloudinary_url(
                cloudinary_public_id,
                resource_type="video",
                format=cloudinary_format,
                start_offset=math.floor(question.source_start_time * 10) / 10.0,
                end_offset=math.ceil(question.source_end_time * 10) / 10.0,
                secure=True,
            )
            question.audio_url = audio_url
            logger.info(
                "Q(%s,%s): audio [%.1fs -> %.1fs]",
                question.mondai_group,
                question.question_number,
                question.source_start_time,
                question.source_end_time,
            )
