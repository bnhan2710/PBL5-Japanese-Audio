import os
import sys
import json
import logging
import argparse
import time
from pathlib import Path
from dotenv import load_dotenv
from pydub import AudioSegment
from pydub.silence import split_on_silence
import google.generativeai as genai
import reazonspeech as rs
from reazonspeech.k2.asr import load_model, transcribe, audio_from_path

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('pipeline_v2.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class ReazonTranscriber:
    def __init__(self, model_version="reazonspeech-k2-v2"):
        self.model_version = model_version
        self.model = None

    def load_model(self):
        logger.info(f"Loading ReazonSpeech model: {self.model_version}")
        try:
            self.model = load_model(self.model_version)
            logger.info("Model loaded successfully.")
        except Exception as e:
            logger.error(f"Error loading ReazonSpeech model: {e}")
            raise

    def transcribe(self, audio_path):
        """
        Transcribes audio using chunked approach to handle long files.
        Returns the full transcript text.
        """
        if not self.model:
            self.load_model()
            
        logger.info(f"Loading audio for transcription: {audio_path}")
        audio = AudioSegment.from_file(audio_path)
        
        # Split on silence
        silence_thresh = audio.dBFS - 14
        min_silence_len = 250
        keep_silence = 200
        
        logger.info("Splitting audio into chunks...")
        chunks = split_on_silence(
            audio,
            min_silence_len=min_silence_len,
            silence_thresh=silence_thresh,
            keep_silence=keep_silence
        )
        logger.info(f"Split into {len(chunks)} chunks.")
        
        full_transcript = []
        temp_dir = "temp_chunks_v2"
        os.makedirs(temp_dir, exist_ok=True)
        
        try:
            for i, chunk in enumerate(chunks):
                if len(chunk) < 200: # Skip very short chunks
                    continue
                    
                chunk_path = os.path.join(temp_dir, f"chunk_{i}.wav")
                chunk.export(chunk_path, format="wav")
                
                try:
                    audio_chunk = audio_from_path(chunk_path)
                    ret = transcribe(self.model, audio_chunk)
                    text = ret.text
                    
                    if text:
                        if text not in ["プ", "ピッ"]: # Filter out bell sounds if recognized as text
                             full_transcript.append(text)
                except Exception as e:
                    logger.warning(f"Error transcribing chunk {i}: {e}")
                
                # Cleanup immediate chunk
                if os.path.exists(chunk_path):
                    os.remove(chunk_path)
                    
        finally:
            # Cleanup temp dir
            if os.path.exists(temp_dir):
                import shutil
                shutil.rmtree(temp_dir)
                
        final_text = "".join(full_transcript)
        logger.info("Transcription complete.")
        return final_text

class GeminiAnalyzer:
    def __init__(self, api_key):
        if not api_key:
            raise ValueError("Google API Key is required.")
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')

    def upload_audio(self, audio_path):
        logger.info(f"Uploading audio to Gemini: {audio_path}")
        try:
            audio_file = genai.upload_file(path=audio_path)
            logger.info(f"Audio uploaded. URI: {audio_file.uri}")
            
            # Wait for processing
            while audio_file.state.name == "PROCESSING":
                time.sleep(2)
                audio_file = genai.get_file(audio_file.name)
                
            if audio_file.state.name == "FAILED":
                raise ValueError("Audio processing failed.")
                
            logger.info("Audio processing complete.")
            return audio_file
        except Exception as e:
            logger.error(f"Error uploading audio: {e}")
            raise

    def generate_refined_script(self, audio_file, raw_transcript):
        logger.info("Generating refined script (Introduction, Conversation, Question)...")
        
        prompt = """
        You are a professional Japanese transcriber specializing in JLPT listening tests.
        Your task is to refine the following raw transcript from an ASR system into a structured script.
        
        The input includes both the AUDIO file and the RAW TRANSCRIPT. Use both to ensure accuracy.
        
        The structure usually follows this pattern for each question:
        1.  **Introduction**: Mondai number (e.g., 一番), Situation description, and the Initial Question.
        2.  **Conversation**: The main dialogue.
        3.  **Final Question**: The question is repeated at the end.

        **Your Goal**:
        - Identify and separate these three parts clearly for EACH question found in the audio.
        - Add correct Japanese punctuation (。,、, ?, !).
        - Identify speakers in the Conversation part (男： / 女：).
        
        **Required Output Format**:
        
        [Question 1]
        [Introduction]
        (Mondai Number + Question 1 Intro)

        [Conversation]
        (Dialogue with speaker labels)
        男：...
        女：...

        [Question]
        (The final repeated question)

        [Question 2]
        ...
        
        **Important Rules**:
        1.  **Do NOT summarize**. Keep the full content.
        2.  **Speaker Identification**: Use the audio to confirm speakers.
        3.  Output ONLY the refined structured text.
        """
        
        try:
            response = self.model.generate_content([prompt, audio_file, f"Raw Transcript:\n{raw_transcript}"])
            return response.text.strip()
        except Exception as e:
            logger.error(f"Error generating refined script: {e}")
            raise

    def generate_timestamps(self, audio_file, raw_transcript):
        logger.info("Generating timestamps for Mondai and Questions...")
        
        prompt = """
        You are an expert in analyzing JLPT listening tests.
        Your task is to identify the start and end timestamps for each "Mondai" (Problem) and each "Question" within them.

        **Input**: You have access to the Audio file and the Raw Transcript.
        
        **Definitions**:
        1. **Mondai (Problem)**: Top-level section (e.g., Mondai 1, Mondai 2). Starts with "Mondai" or similar announcement.
        2. **Question**: Individual questions within a Mondai.
           - Often identified by "Ichiban" (1), "Niban" (2), etc.
           - **Split Point**: The question starts at the **BELL SOUND** (Tiếng chuông) preceding the number (e.g., Bell -> "Ichiban"). 
           - **End Point**: The question ends at the next bell sound or the end of the section.
           
        **Task**:
        Return a JSON object with the exact timestamps.

        **Output Format (JSON ONLY)**:
        {
          "mondai": [
            {
              "mondai_number": 1,
              "title": "Mondai 1",
              "start_time": 0.0,
              "end_time": 120.5,
              "questions": [
                {
                  "question_number": 1,
                  "start_time": 0.0,
                  "end_time": 15.5,
                  "text": "Start of Question 1"
                }
              ]
            }
          ]
        }
        
        IMPORTANT: Return ONLY valid JSON. No markdown code blocks.
        """
        
        try:
            response = self.model.generate_content([prompt, audio_file, f"Raw Transcript:\n{raw_transcript}"])
            text = response.text
             # Clean markdown if present
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            return json.loads(text)
        except Exception as e:
            logger.error(f"Error generating timestamps: {e}")
            logger.error(f"Raw response: {response.text if 'response' in locals() else 'N/A'}")
            raise

class AudioCutter:
    def cut_audio(self, audio_path, structure, output_dir):
        logger.info("Cutting audio based on timestamps...")
        audio = AudioSegment.from_file(audio_path)
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        mondai_dir_root = output_path / "mondai"
        mondai_dir_root.mkdir(exist_ok=True)
        
        for mondai in structure.get("mondai", []):
            m_num = mondai['mondai_number']
            
            # NOTE: We can verify prompt logic here - usually Mondai audio includes the intro + all questions
            m_start = float(mondai['start_time']) * 1000 
            m_end = float(mondai['end_time']) * 1000
            
            # Export Mondai audio
            logger.info(f"Exporting Mondai {m_num}...")
            mondai_audio = audio[m_start:m_end]
            
            m_dir = mondai_dir_root / f"mondai_{m_num}"
            m_dir.mkdir(exist_ok=True)
            
            mondai_file = m_dir / f"mondai_{m_num}.mp3"
            mondai_audio.export(mondai_file, format="mp3")
            
            # Export Questions
            q_dir = m_dir / "questions"
            q_dir.mkdir(exist_ok=True)
            
            for q in mondai.get("questions", []):
                q_num = q['question_number']
                q_start = float(q['start_time']) * 1000
                q_end = float(q['end_time']) * 1000
                
                logger.info(f"  Exporting Question {q_num}...")
                q_audio = audio[q_start:q_end]
                q_file = q_dir / f"question_{q_num}.mp3"
                q_audio.export(q_file, format="mp3")

        logger.info("Audio cutting complete.")

class PipelineOrchestrator:
    def __init__(self, input_file, output_dir="output_v2"):
        self.input_file = Path(input_file)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.reazon = ReazonTranscriber()
        self.gemini = GeminiAnalyzer(os.getenv("GOOGLE_API_KEY"))
        self.cutter = AudioCutter()

    def run(self):
        if not self.input_file.exists():
            logger.error(f"Input file not found: {self.input_file}")
            return
            
        # 1. Transcribe with ReazonSpeech
        logger.info("--- Step 1: Transcription (ReazonSpeech) ---")
        raw_transcript = self.reazon.transcribe(str(self.input_file))
        
        # Save raw transcript
        with open(self.output_dir / "raw_transcript.txt", "w", encoding="utf-8") as f:
            f.write(raw_transcript)
            
        # 2. Analyze with Gemini
        logger.info("--- Step 2: Analysis (Gemini) ---")
        
        # Upload audio once
        audio_file = self.gemini.upload_audio(str(self.input_file))
        
        # 2a. Refine Script
        try:
            refined_script = self.gemini.generate_refined_script(audio_file, raw_transcript)
            with open(self.output_dir / "refined_script.txt", "w", encoding="utf-8") as f:
                f.write(refined_script)
        except Exception as e:
            logger.error(f"Failed to generate refined script: {e}")
            
        # 2b. Generate Timestamps
        timestamps = None
        try:
            timestamps = self.gemini.generate_timestamps(audio_file, raw_transcript)
            with open(self.output_dir / "timestamps.json", "w", encoding="utf-8") as f:
                json.dump(timestamps, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Failed to generate timestamps: {e}")
            
        # 3. Cut Audio
        if timestamps:
            logger.info("--- Step 3: Cutting Audio (PyDub) ---")
            try:
                self.cutter.cut_audio(str(self.input_file), timestamps, str(self.output_dir))
            except Exception as e:
                logger.error(f"Failed to cut audio: {e}")
        else:
             logger.warning("Skipping audio cutting due to missing timestamps.")
        
        logger.info("=== Pipeline Complete! ===")
        logger.info(f"Outputs saved to: {self.output_dir.absolute()}")

def main():
    parser = argparse.ArgumentParser(description="Audio Splitter + Text v2.0 (Reazon + Gemini + PyDub)")
    parser.add_argument("input_file", help="Path to input audio file")
    parser.add_argument("--output_dir", default="output_v2", help="Directory to save outputs")
    args = parser.parse_args()
    
    orchestrator = PipelineOrchestrator(args.input_file, args.output_dir)
    orchestrator.run()

if __name__ == "__main__":
    main()
