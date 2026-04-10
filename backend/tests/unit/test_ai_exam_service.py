import tempfile
from pathlib import Path

from pydub import AudioSegment
from pydub.generators import Sine

from app.modules.ai_exam.service import (
    AIExamService,
    BELL_2BAKU_PATH,
    BELL_SOUND_PATH,
    BellAudioSplitter,
    SplitAudioChunk,
    _parse_formatted_segment,
)


def _load_bell(path: Path) -> AudioSegment:
    return AudioSegment.from_file(path)


def test_bell_splitter_ignores_bell_2baku_trap():
    bell1 = _load_bell(BELL_SOUND_PATH)
    bell2 = _load_bell(BELL_2BAKU_PATH)
    tone = Sine(440).to_audio_segment(duration=1800).apply_gain(-12)

    full_audio = (
        AudioSegment.silent(duration=600)
        + bell1
        + tone
        + AudioSegment.silent(duration=600)
        + bell2
        + AudioSegment.silent(duration=500)
        + bell1
        + tone
        + AudioSegment.silent(duration=2500)
        + bell1
        + tone
    )

    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        full_audio.export(tmp.name, format="wav")
        splitter = BellAudioSplitter(
            threshold_percent=0.8,
            min_distance_sec=1,
            trap_window_sec=4.0,
            min_segment_length_ms=500,
        )
        timestamps = splitter.find_question_starts(tmp.name)

    assert len(timestamps) == 2
    assert timestamps[0] < timestamps[1]


def test_bell_splitter_falls_back_to_full_audio_when_no_bell_detected():
    tone = Sine(440).to_audio_segment(duration=2200).apply_gain(-10)

    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        tone.export(tmp.name, format="wav")
        audio_bytes = Path(tmp.name).read_bytes()

    splitter = BellAudioSplitter(
        threshold_percent=0.8,
        min_distance_sec=1,
        trap_window_sec=4.0,
        min_segment_length_ms=500,
    )
    segments = splitter.split_audio(audio_bytes, suffix=".wav")

    assert len(segments) == 1
    assert segments[0].segment_index == 1
    assert segments[0].start_ms == 0
    assert segments[0].end_ms >= 2000
    assert segments[0].audio_bytes


class _FakeSplitter:
    def split_audio(self, audio_bytes: bytes, suffix: str = ".mp3"):
        return [
            SplitAudioChunk(
                segment_index=1,
                file_name="segment_01.wav",
                start_ms=1000,
                end_ms=5000,
                audio_bytes=b"segment-1",
            ),
            SplitAudioChunk(
                segment_index=2,
                file_name="segment_02.wav",
                start_ms=7000,
                end_ms=11000,
                audio_bytes=b"segment-2",
            ),
        ]


class _FakeReazon:
    def _load_model(self):
        return None

    def transcribe(self, audio_bytes: bytes, suffix: str = ".wav") -> dict:
        if audio_bytes == b"segment-1":
            return {
                "raw_text": "二番会社での会話です男会議は三時です男の人は何時に会議をしますか",
                "formatted_text": "--------\n二番\n会社での会話です。\n\n男：会議は三時です。\n\n男の人は何時に会議をしますか。\n--------",
                "introduction": "二番\n会社での会話です。",
                "script_text": "男：会議は三時です。",
                "question_texts": ["会社での会話です。"],
                "spoken_question_number": 2,
                "announced_mondai_number": None,
            }
        return {
            "raw_text": "一番お店での会話です女りんごを二つください男はいわかりました男の人はどう返事をしましたか",
            "formatted_text": "--------\n一番\nお店での会話です。\n\n女：りんごを二つください。\n男：はい、わかりました。\n\n男の人はどう返事をしましたか。\n--------",
            "introduction": "一番\nお店での会話です。",
            "script_text": "女：りんごを二つください。\n男：はい、わかりました。",
            "question_texts": ["お店での会話です。"],
            "spoken_question_number": 1,
            "announced_mondai_number": None,
        }


def test_generate_uses_local_reazon_only_and_keeps_one_question_per_segment():
    service = AIExamService.__new__(AIExamService)
    service._splitter = _FakeSplitter()
    service._reazon = _FakeReazon()

    progress_messages = []
    result = service.generate(
        audio_bytes=b"full-audio",
        filename="sample.mp3",
        jlpt_level="N2",
        cloudinary_public_id=None,
        progress_callback=progress_messages.append,
    )

    assert len(result.split_segments) == 2
    assert len(result.questions) == 2
    assert sum(len(item.questions) for item in (result.timestamps or [])) == 2
    assert result.questions[0].script_text.startswith("男：")
    assert result.questions[1].script_text.startswith("女：")
    assert result.questions[0].question_number == 2
    assert result.questions[1].mondai_group == "Mondai 2"
    assert result.questions[1].question_number == 1
    assert result.questions[1].source_segment_index == 2
    assert result.questions[1].source_question_index == 1
    assert result.questions[1].question_text == "お店での会話です。"
    assert len(result.questions[0].answers) == 4
    assert all(not answer.is_correct for answer in result.questions[0].answers)
    assert all(answer.content == "" for answer in result.questions[0].answers)
    assert result.questions[0].difficulty is not None
    assert [item.mondai_number for item in result.timestamps or []] == [1, 2]
    assert progress_messages == [
        "Step 2/7: Detecting bell timestamps...",
        "Step 3/7: Cutting question audio with PyDub...",
        "Step 4/7: ReazonSpeech transcribing split audio...",
        "Step 5/7: Formatting scripts with local Reazon rules...",
        "Step 6/7: Building local question drafts...",
        "Step 7/7: Attaching clipped audio URLs...",
    ]


def test_build_structured_segments_caps_mondai_at_five():
    split_segments = [
        SplitAudioChunk(
            segment_index=index,
            file_name=f"segment_{index:02d}.wav",
            start_ms=index * 1000,
            end_ms=index * 1000 + 800,
            audio_bytes=b"",
            transcript=f"segment-{index}",
            refined_transcript=f"segment-{index}",
            introduction=f"{'一番' if index % 2 == 1 else '二番'}\nテストです。",
            script_text=f"男：segment-{index}",
            question_texts=[f"質問 {index}。"],
            spoken_question_number=1 if index % 2 == 1 else 2,
        )
        for index in range(1, 11)
    ]

    structured = AIExamService._build_structured_segments(split_segments)

    assert structured[-1].mondai_group == "Mondai 5"
    assert len({item.mondai_group for item in structured}) == 5


def test_build_structured_segments_uses_leading_ban_and_opens_new_mondai_on_ichiban():
    split_segments = [
        SplitAudioChunk(
            segment_index=1,
            file_name="segment_01.wav",
            start_ms=1000,
            end_ms=2000,
            audio_bytes=b"",
            transcript="segment-1",
            refined_transcript="segment-1",
            introduction="二番\n会話です。",
            script_text="男：...",
            question_texts=["質問A。"],
            spoken_question_number=2,
        ),
        SplitAudioChunk(
            segment_index=2,
            file_name="segment_02.wav",
            start_ms=2000,
            end_ms=3000,
            audio_bytes=b"",
            transcript="segment-2",
            refined_transcript="segment-2",
            introduction="十一番\n会話です。",
            script_text="女：...",
            question_texts=["質問B。"],
            spoken_question_number=11,
        ),
        SplitAudioChunk(
            segment_index=3,
            file_name="segment_03.wav",
            start_ms=3000,
            end_ms=4000,
            audio_bytes=b"",
            transcript="segment-3",
            refined_transcript="segment-3",
            introduction="一番\n会話です。",
            script_text="男：...",
            question_texts=["質問C。"],
            spoken_question_number=1,
        ),
    ]

    structured = AIExamService._build_structured_segments(split_segments)

    assert [(item.mondai_group, item.question_number) for item in structured] == [
        ("Mondai 1", 2),
        ("Mondai 1", 11),
        ("Mondai 2", 1),
    ]


def test_build_questions_generates_non_empty_time_options():
    split_segments = [
        SplitAudioChunk(
            segment_index=1,
            file_name="segment_01.wav",
            start_ms=1000,
            end_ms=3000,
            audio_bytes=b"",
            transcript="",
            refined_transcript="",
            introduction="一番\n会社での会話です。",
            script_text="男：会議は3時です。\n女：わかりました。",
            question_texts=["男の人は何時に会議をしますか。"],
            spoken_question_number=1,
        )
    ]

    structured = AIExamService._build_structured_segments(split_segments)
    questions = AIExamService._build_questions(structured, split_segments)

    assert len(questions) == 1
    assert questions[0].difficulty in {1, 2, 3, 4, 5}
    assert len(questions[0].answers) == 4
    assert all(answer.content == "" for answer in questions[0].answers)
    assert all(not answer.is_correct for answer in questions[0].answers)


def test_parse_formatted_segment_expands_question_text_from_ban_to_current_question():
    formatted_text = (
        "--------\n"
        "二番\n"
        "会社での会話です。\n\n"
        "男：会議は三時です。\n"
        "女：わかりました。\n\n"
        "男の人は何時に会議をしますか。\n"
        "--------"
    )

    introduction, script_text, question_texts, spoken_number, announced_mondai_number = _parse_formatted_segment(
        formatted_text,
        raw_text="",
    )

    assert introduction is not None
    assert "会社での会話です。" in introduction
    assert "男：会議は三時です。" in script_text
    assert question_texts == ["会社での会話です。"]
    assert spoken_number == 2
    assert announced_mondai_number is None


def test_build_structured_segments_prefers_announced_mondai_number():
    split_segments = [
        SplitAudioChunk(
            segment_index=1,
            file_name="segment_01.wav",
            start_ms=1000,
            end_ms=2000,
            audio_bytes=b"",
            transcript="segment-1",
            refined_transcript="segment-1",
            introduction="問題一\n一番\n会話です。",
            script_text="男：...",
            question_texts=["質問A。"],
            spoken_question_number=1,
            announced_mondai_number=1,
        ),
        SplitAudioChunk(
            segment_index=2,
            file_name="segment_02.wav",
            start_ms=3000,
            end_ms=4000,
            audio_bytes=b"",
            transcript="segment-2",
            refined_transcript="segment-2",
            introduction="問題五\n一番\n会話です。",
            script_text="女：...",
            question_texts=["質問B。"],
            spoken_question_number=1,
            announced_mondai_number=5,
        ),
    ]

    structured = AIExamService._build_structured_segments(split_segments)

    assert [(item.mondai_group, item.question_number) for item in structured] == [
        ("Mondai 1", 1),
        ("Mondai 5", 1),
    ]
