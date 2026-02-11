# 🎓 JLPT Audio Processing Guide (v3.0)

This guide documents the complete workflow to split JLPT audio files and generate high-accuracy Japanese scripts using AI.

## 🆕 New: All-in-One Workflow (v2.0)

**Best for:** Processing a raw audio file from start to finish in one command.

### `audio_splitter_to_text_v2.py`
This script performs the entire pipeline:
1.  **Transcribe**: ReazonSpeech (High Accuracy).
2.  **Refine**: Gemini (Speaker labels, Punctuation).
3.  **Split**: Cuts audio into Mondai and Questions using Gemini timestamps.

**Command:**
```bash
python3 R\&D/Demo\ AI/audio_splitter_to_text_v2.py "input/jlpt_n2.mp3" --output_dir output_v2
```

**Output Structure:**
```
output_v2/
├── raw_transcript.txt      # Raw Reazon text
├── refined_script.txt      # Final script
├── timestamps.json         # Cut times
└── mondai/                 # Audio files
    ├── mondai_1/
    │   ├── mondai_1.mp3
    │   └── questions/
    │       ├── question_1.mp3
    │       └── ...
```

---

## 🔄 Standard Workflow (v1.0) - Step-by-Step

The process is divided into 2 distinct steps:

1.  **Step 1: Split Audio** (using `audio_splitter.py`)
    *   Takes a long Exam Audio file (e.g., `jlpt_n2.mp3`).
    *   Splits it into smaller files for each Mondai and Question.
    *   Target: `output/mondai/mondai_X/questions/question_Y.mp3`.

2.  **Step 2: Generate Scripts** (using `full_pipeline.py`)
    *   Takes the split audio files from Step 1.
    *   Uses **ReazonSpeech** to transcribe the Japanese audio.
    *   Uses **Gemini AI** to refine the script (add speakers, punctuation, structure).
    *   Target: `question_Y.txt` (paired with the audio).

---

## Step-by-Step Instructions

### Step 1: Split Audio (Cắt file lớn)

Use `audio_splitter.py` to break the long audio file into manageable chunks.

```bash
# Basic usage
python3 R\&D/Demo\ AI/audio_splitter.py "input/jlpt_n2.mp3"
```

**Output Location**:
`output/mondai/` containing organized folders for each Mondai.

---

### Step 2: Generate Scripts (Tạo Script chi tiết)

Use `full_pipeline.py` to generate scripts for the split files. This script runs the Reazon + Gemini pipeline.

#### Option A: Process a Single Question
Good for testing or re-generating a specific file.

```bash
python3 R\&D/Demo\ AI/full_pipeline.py "output/mondai/mondai_1/questions/question_1.mp3"
```
**Output**: `question_1.txt` created in the same folder.

#### Option B: Process a Whole Directory (Batch) -> **RECOMMENDED**
Process all MP3 files in a directory (e.g., all questions in Mondai 1).

```bash
python3 R\&D/Demo\ AI/full_pipeline.py "output/mondai/mondai_1/questions" --batch
```
**Output**: A `.txt` script file for every `.mp3` file in that folder.

---

## 🛠️ Usage Reference

### `audio_splitter_to_text_v2.py` (v2.0)
*   **Input**: Raw Audio File.
*   **Action**: Reazon Transcribe -> Gemini Refine + Timestamp -> PyDub Cut.
*   **Output**: Unified folder with Script + Split Audio.

### `audio_splitter.py`
*   **Input**: Long JLPT Audio File.
*   **Action**: Whisper Transcription -> Gemini Analysis -> FFmpeg Splitting.
*   **Output**: Folders of split MP3 files.

### `full_pipeline.py`
*   **Input**: Split MP3 File(s).
*   **Action**: ReazonSpeech Transcription -> Gemini Refinement.
*   **Output**: `.txt` file with structured script:
    ```text
    [Introduction]
    ...
    [Conversation]
    男：...
    女：...
    [Question]
    ...
    ```

---

## ⚙️ Setup Requirements

1.  **Install FFmpeg**: `brew install ffmpeg`
2.  **Install Python Deps**: `pip install -r requirements.txt`
3.  **API Key**: Ensure `.env` contains `GOOGLE_API_KEY=...`

---

## 📝 Tips
*   **ReazonSpeech First Run**: The first time you run Step 2, it will download the model (~1GB). Please be patient.
*   **Speed**: ReazonSpeech is accurate but slower than Whisper. Processing a whole Mondai folder might take a few minutes.
*   **Cost**: Gemini 1.5 Flash is effectively free for this volume of text.
