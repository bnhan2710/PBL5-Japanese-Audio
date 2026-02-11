"""
JLPT Audio Splitter - Tách file audio JLPT thành mondai và câu hỏi tự động

Công nghệ sử dụng:
- Google Gemini: AI phân tích cấu trúc (FREE)
- FFmpeg: Audio processing và cắt file (thay PyDub)

"""

import whisper
import json
import logging
import subprocess
from pathlib import Path
import os
from typing import Dict, List, Optional, Tuple
from dotenv import load_dotenv
import google.generativeai as genai
from datetime import datetime

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('audio_splitter.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class JPLTAudioSplitter:
    """
    Class xử lý tách file audio JLPT thành các mondai và câu hỏi
    
    Pipeline:
    1. Transcribe audio với Whisper (lấy text + timestamps)
    2. Phân tích cấu trúc với Gemini AI (tìm mondai và câu hỏi)
    3. Cắt audio dựa trên timestamps (tạo file riêng)
    """
    
    def __init__(
        self, 
        audio_path: str, 
        output_dir: str = "output",
        whisper_model_size: str = "base",
        image_path: Optional[str] = None
    ):
        """
        Khởi tạo JLPT Audio Splitter
        
        Args:
            audio_path: Đường dẫn đến file audio JLPT (.mp3, .wav, .m4a, etc)
            output_dir: Thư mục output (mặc định: "output")
            whisper_model_size: Kích thước model Whisper (tiny/base/small/medium/large)
            image_path: Đường dẫn file ảnh đề thi (optional, để AI phân tích thêm)
        
        Raises:
            FileNotFoundError: Nếu audio file không tồn tại
            ValueError: Nếu thiếu GOOGLE_API_KEY
        """
        logger.info("🚀 Khởi tạo JLPT Audio Splitter")
        
        # Validate audio file
        self.audio_path = Path(audio_path)
        if not self.audio_path.exists():
            raise FileNotFoundError(f"❌ File audio không tồn tại: {audio_path}")
        logger.info(f"📁 Audio file: {self.audio_path}")
        
        # Setup paths
        self.image_path = Path(image_path) if image_path else None
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True, parents=True)
        logger.info(f"📂 Output directory: {self.output_dir.absolute()}")
        
        # Load Whisper model
        self.whisper_model_size = whisper_model_size
        logger.info(f"🔄 Đang load Whisper model ({whisper_model_size})...")
        try:
            self.whisper_model = whisper.load_model(whisper_model_size)
            logger.info("✅ Whisper model loaded")
        except Exception as e:
            logger.error(f"❌ Lỗi load Whisper model: {e}")
            raise
        
        # Setup Google Gemini
        logger.info("🔄 Đang setup Google Gemini API...")
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            error_msg = (
                "❌ GOOGLE_API_KEY không tìm thấy!\n"
                "📝 Hướng dẫn lấy FREE API key:\n"
                "   1. Truy cập: https://makersuite.google.com/app/apikey\n"
                "   2. Đăng nhập Google account\n"
                "   3. Tạo API key mới\n"
                "   4. Lưu vào file .env: GOOGLE_API_KEY=your_key_here"
            )
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        genai.configure(api_key=api_key)
        self.ai_client = genai.GenerativeModel('gemini-2.5-flash')
        logger.info("✅ Google Gemini configured (FREE tier)")
        
        # Stats
        self.stats = {
            "start_time": datetime.now(),
            "transcript_time": None,
            "analysis_time": None,
            "split_time": None,
            "total_mondai": 0,
            "total_questions": 0
        }
    
    def transcribe_audio(self) -> Dict:
        """
        Bước 1: Transcribe audio file thành text với timestamps chi tiết
        
        Sử dụng OpenAI Whisper để:
        - Chuyển audio thành text (Japanese)
        - Lấy timestamps cho từng segment và word
        - Lưu kết quả vào transcript.json
        
        Returns:
            Dict chứa transcript với segments và timestamps
            
        Raises:
            Exception: Nếu transcribe thất bại
        """
        logger.info("="*60)
        logger.info("📝 BƯỚC 1: TRANSCRIBE AUDIO")
        logger.info("="*60)
        
        start_time = datetime.now()
        logger.info(f"🎤 Đang transcribe: {self.audio_path.name}")
        logger.info(f"⏱️  Whisper model: {self.whisper_model_size}")
        
        try:
            result = self.whisper_model.transcribe(
                str(self.audio_path),
                language="ja",  # Japanese
                task="transcribe",
                verbose=False,  # Tắt verbose để log sạch hơn
                word_timestamps=True  # Quan trọng: timestamps từng word
            )
            
            # Lưu transcript
            transcript_path = self.output_dir / "transcript.json"
            with open(transcript_path, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            
            elapsed = (datetime.now() - start_time).total_seconds()
            self.stats["transcript_time"] = elapsed
            
            logger.info(f"✅ Transcribe hoàn thành trong {elapsed:.1f}s")
            logger.info(f"📄 Transcript saved: {transcript_path}")
            logger.info(f"📊 Tổng segments: {len(result['segments'])}")
            logger.info(f"📊 Độ dài audio: {result['segments'][-1]['end']:.1f}s")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Lỗi transcribe audio: {e}")
            raise
    
    def analyze_structure_with_ai(self, transcript: Dict) -> Dict:
        """
        Bước 2: Sử dụng Gemini AI để phân tích cấu trúc đề thi
        
        AI sẽ:
        - Tìm các MONDAI (問題) markers
        - Xác định boundaries giữa các mondai
        - Tìm câu hỏi trong mỗi mondai (いちばん, にばん, ...)
        - Trả về structure với timestamps chính xác
        
        Args:
            transcript: Kết quả từ Whisper
            
        Returns:
            Dict chứa cấu trúc mondai và questions với timestamps
            
        Raises:
            Exception: Nếu AI analysis hoặc JSON parsing thất bại
        """
        logger.info("\n" + "="*60)
        logger.info("🤖 BƯỚC 2: PHÂN TÍCH CẤU TRÚC VỚI AI")
        logger.info("="*60)
        
        start_time = datetime.now()
        
        # Chuẩn bị transcript cho AI
        segments_text = "\n".join([
            f"[{seg['start']:.2f}s - {seg['end']:.2f}s] {seg['text']}"
            for seg in transcript['segments']
        ])
        
        logger.info(f"📝 Preparing prompt với {len(transcript['segments'])} segments")
        
        # Prompt cho Gemini
        prompt = f"""Bạn là chuyên gia phân tích đề thi JLPT. Nhiệm vụ của bạn là phân tích transcript audio để xác định cấu trúc đề thi.

TRANSCRIPT VỚI TIMESTAMPS:
{segments_text}

YÊU CẦU:
1. Tìm các MONDAI (問題) - phần lớn của đề thi
   - Markers: "もんだい" (mondai), "問題", hoặc số thứ tự mondai
   
2. Tìm các câu hỏi trong mỗi mondai
   - Markers: "いちばん" (1), "にばん" (2), "さんばん" (3), "よんばん" (4), "ごばん" (5)...
   - "ばん" (ban) = số thứ tự câu hỏi
   - Thường có pause/khoảng lặng giữa các câu hỏi
   - Điểm cần cắt đó là khi có marker số + "ばん" (ban) và trước đó là tiếng chuông
   - Các câu hỏi trong cùng một mondai sẽ có thời lượng giống nhau
   - Các file đề JLPT N1, N2 ở Mondai 5 (gần cuối bài nghe) sẽ có 2 "しつもん" nằm trong một đoạn hội thoại và không được cắt audio tại đây. Chỉ được cắt nếu có chữ ”番”.
3. Xác định timestamps chính xác cho:
   - Bắt đầu và kết thúc mỗi mondai
   - Bắt đầu và kết thúc mỗi câu hỏi

OUTPUT FORMAT (JSON ONLY):
{{
  "mondai": [
    {{
      "mondai_number": 1,
      "title": "Mondai 1",
      "start_time": 0.0,
      "end_time": 120.5,
      "questions": [
        {{
          "question_number": 1,
          "start_time": 0.0,
          "end_time": 15.5,
          "text": "Excerpt của câu hỏi nếu có"
        }}
      ]
    }}
  ]
}}

LƯU Ý:
- Trả về ONLY valid JSON, không thêm text giải thích
- Timestamps phải chính xác dựa trên transcript
- Nếu không chắc chắn, ước lượng dựa trên pause và context
- Mỗi mondai phải có ít nhất 1 question"""

        try:
            logger.info("🌐 Đang gọi Gemini API...")
            response = self.ai_client.generate_content(prompt)
            result_text = response.text
            
            logger.info("✅ Nhận response từ Gemini")
            
            # Parse JSON from response
            result_text = self._extract_json_from_text(result_text)
            structure = json.loads(result_text)
            
            # Validate structure
            self._validate_structure(structure)
            
            # Lưu structure
            structure_path = self.output_dir / "structure.json"
            with open(structure_path, "w", encoding="utf-8") as f:
                json.dump(structure, f, ensure_ascii=False, indent=2)
            
            elapsed = (datetime.now() - start_time).total_seconds()
            self.stats["analysis_time"] = elapsed
            
            # Statistics
            total_mondai = len(structure['mondai'])
            total_questions = sum(len(m['questions']) for m in structure['mondai'])
            self.stats["total_mondai"] = total_mondai
            self.stats["total_questions"] = total_questions
            
            logger.info(f"✅ Phân tích hoàn thành trong {elapsed:.1f}s")
            logger.info(f"📄 Structure saved: {structure_path}")
            logger.info(f"📊 Tổng mondai: {total_mondai}")
            logger.info(f"📊 Tổng câu hỏi: {total_questions}")
            
            # Log chi tiết từng mondai
            for mondai in structure['mondai']:
                logger.info(
                    f"   Mondai {mondai['mondai_number']}: "
                    f"{len(mondai['questions'])} câu hỏi "
                    f"({mondai['start_time']:.1f}s - {mondai['end_time']:.1f}s)"
                )
            
            return structure
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ Lỗi parse JSON: {e}")
            logger.error(f"Response từ AI: {result_text[:500]}...")
            raise
        except Exception as e:
            logger.error(f"❌ Lỗi phân tích với AI: {e}")
            raise
    
    def _extract_json_from_text(self, text: str) -> str:
        """
        Trích xuất JSON từ response text (có thể có markdown code blocks)
        
        Args:
            text: Response text từ AI
            
        Returns:
            Clean JSON string
        """
        # Remove markdown code blocks
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        
        return text.strip()
    
    def _validate_structure(self, structure: Dict) -> None:
        """
        Validate structure từ AI
        
        Args:
            structure: Structure dict cần validate
            
        Raises:
            ValueError: Nếu structure không hợp lệ
        """
        if "mondai" not in structure:
            raise ValueError("Structure thiếu key 'mondai'")
        
        if not structure["mondai"]:
            raise ValueError("Structure không có mondai nào")
        
        for i, mondai in enumerate(structure["mondai"]):
            required_keys = ["mondai_number", "start_time", "end_time", "questions"]
            for key in required_keys:
                if key not in mondai:
                    raise ValueError(f"Mondai {i+1} thiếu key '{key}'")
            
            if not mondai["questions"]:
                raise ValueError(f"Mondai {i+1} không có câu hỏi nào")
            
            for j, question in enumerate(mondai["questions"]):
                required_q_keys = ["question_number", "start_time", "end_time"]
                for key in required_q_keys:
                    if key not in question:
                        raise ValueError(
                            f"Mondai {i+1}, Question {j+1} thiếu key '{key}'"
                        )
    
    def split_audio(self, structure: Dict) -> None:
        """
        Bước 3: Cắt audio file thành các mondai và câu hỏi riêng biệt
        
        Dựa vào timestamps từ AI analysis:
        - Tạo file MP3 riêng cho mỗi mondai
        - Tạo file MP3 riêng cho mỗi câu hỏi trong mondai
        - Organize theo thư mục: mondai/mondai_X/question_Y.mp3
        
        Sử dụng FFmpeg trực tiếp thay vì PyDub (Python 3.13 compatible)
        
        Args:
            structure: Structure dict từ AI analysis
            
        Raises:
            Exception: Nếu audio processing thất bại
        """
        logger.info("\n" + "="*60)
        logger.info("✂️  BƯỚC 3: CẮT AUDIO (FFmpeg)")
        logger.info("="*60)
        
        start_time = datetime.now()
        
        try:
            # Tạo thư mục mondai
            mondai_dir = self.output_dir / "mondai"
            mondai_dir.mkdir(exist_ok=True, parents=True)
            
            # Cắt từng mondai
            for mondai_info in structure['mondai']:
                mondai_num = mondai_info['mondai_number']
                logger.info(f"\n📌 Đang xử lý Mondai {mondai_num}...")
                
                # Extract mondai audio với FFmpeg
                start_time_sec = mondai_info['start_time']
                duration_sec = mondai_info['end_time'] - mondai_info['start_time']
                
                # Tạo thư mục cho mondai này
                mondai_subdir = mondai_dir / f"mondai_{mondai_num}"
                mondai_subdir.mkdir(exist_ok=True, parents=True)
                
                mondai_path = mondai_subdir / f"mondai_{mondai_num}.mp3"
                
                # FFmpeg command to extract audio segment (only audio stream)
                cmd = [
                    'ffmpeg',
                    '-i', str(self.audio_path),
                    '-ss', str(start_time_sec),
                    '-t', str(duration_sec),
                    '-vn',  # No video (skip album art/image)
                    '-acodec', 'libmp3lame',
                    '-b:a', '192k',
                    '-y',  # Overwrite output file
                    str(mondai_path)
                ]
                
                result = subprocess.run(cmd, capture_output=True, text=True)
                if result.returncode != 0:
                    logger.error(f"❌ FFmpeg error: {result.stderr}")
                    raise RuntimeError(f"FFmpeg failed for mondai {mondai_num}")
                
                logger.info(
                    f"✅ Mondai {mondai_num}: {mondai_path.name} "
                    f"({duration_sec:.1f}s)"
                )
                
                # Tạo thư mục questions bên trong mondai
                questions_dir = mondai_subdir / "questions"
                questions_dir.mkdir(exist_ok=True, parents=True)
                
                # Cắt từng question
                for question_info in mondai_info['questions']:
                    q_num = question_info['question_number']
                    q_start_sec = question_info['start_time']
                    q_duration_sec = question_info['end_time'] - question_info['start_time']
                    
                    question_path = questions_dir / f"question_{q_num}.mp3"
                    
                    # FFmpeg command for question (only audio stream)
                    cmd = [
                        'ffmpeg',
                        '-i', str(self.audio_path),
                        '-ss', str(q_start_sec),
                        '-t', str(q_duration_sec),
                        '-vn',  # No video
                        '-acodec', 'libmp3lame',
                        '-b:a', '192k',
                        '-y',
                        str(question_path)
                    ]
                    
                    result = subprocess.run(cmd, capture_output=True, text=True)
                    if result.returncode != 0:
                        logger.error(f"❌ FFmpeg error: {result.stderr}")
                        raise RuntimeError(f"FFmpeg failed for question {q_num}")
                    
                    logger.info(
                        f"   ✅ Question {q_num}: {question_path.name} "
                        f"({q_duration_sec:.1f}s)"
                    )
            
            elapsed = (datetime.now() - start_time).total_seconds()
            self.stats["split_time"] = elapsed
            
            logger.info(f"\n✅ Cắt audio hoàn thành trong {elapsed:.1f}s")
            logger.info(f"📁 Output directory: {mondai_dir.absolute()}")
            logger.info(f"\n💡 Cấu trúc output:")
            logger.info(f"   output/mondai/")
            logger.info(f"   ├── mondai_1/")
            logger.info(f"   │   ├── mondai_1.mp3")
            logger.info(f"   │   └── questions/")
            logger.info(f"   │       ├── question_1.mp3")
            logger.info(f"   │       └── ...")
            logger.info(f"   └── ...")
            
        except Exception as e:
            logger.error(f"❌ Lỗi cắt audio: {e}")
            raise
    
    def process(self) -> Dict:
        """
        Chạy toàn bộ pipeline xử lý
        
        Pipeline:
        1. Transcribe audio → text + timestamps
        2. Analyze structure → tìm mondai + questions
        3. Split audio → tạo file riêng
        
        Returns:
            Dict chứa statistics của quá trình xử lý
            
        Raises:
            Exception: Nếu bất kỳ bước nào thất bại
        """
        logger.info("\n" + "="*70)
        logger.info("🚀 BẮT ĐẦU XỬ LÝ JLPT AUDIO")
        logger.info("="*70)
        logger.info(f"📁 Input: {self.audio_path.name}")
        logger.info(f"📂 Output: {self.output_dir.absolute()}")
        logger.info(f"🤖 AI: Google Gemini 1.5 Flash (FREE)")
        logger.info(f"🎤 Whisper: {self.whisper_model_size}")
        logger.info("="*70)
        
        try:
            # Bước 1: Transcribe
            transcript = self.transcribe_audio()
            
            # Bước 2: Analyze
            structure = self.analyze_structure_with_ai(transcript)
            
            # Bước 3: Split
            self.split_audio(structure)
            
            # Calculate total time
            total_time = (datetime.now() - self.stats["start_time"]).total_seconds()
            
            # Print summary
            logger.info("\n" + "="*70)
            logger.info("✨ HOÀN THÀNH!")
            logger.info("="*70)
            logger.info(f"⏱️  Tổng thời gian: {total_time:.1f}s")
            logger.info(f"   - Transcribe: {self.stats['transcript_time']:.1f}s")
            logger.info(f"   - AI Analysis: {self.stats['analysis_time']:.1f}s")
            logger.info(f"   - Split Audio: {self.stats['split_time']:.1f}s")
            logger.info(f"📊 Kết quả:")
            logger.info(f"   - {self.stats['total_mondai']} mondai")
            logger.info(f"   - {self.stats['total_questions']} câu hỏi")
            logger.info(f"📁 Output: {self.output_dir.absolute()}")
            logger.info("="*70)
            
            return self.stats
            
        except Exception as e:
            logger.error(f"\n❌ XỬ LÝ THẤT BẠI: {e}")
            raise


def main():
    import sys
    
    # Check command line arguments
    if len(sys.argv) > 1:
        audio_path = sys.argv[1]
        output_dir = sys.argv[2] if len(sys.argv) > 2 else "output"
    else:
        # Demo với file JLPT N2
        audio_path = "data/jlpt_n2.mp3"
        output_dir = "output"
        
        print("💡 Cách sử dụng:")
        print(f"   python {__file__} <audio_path> [output_dir]")
        print(f"\nVí dụ:")
        print(f"   python {__file__} input/jlpt_n2.mp3")
        print(f"   python {__file__} input/jlpt_n2.mp3 my_output")
        print("\n🎯 Đang chạy với file: {audio_path}")
        print("="*70)
    
    try:
        # Khởi tạo và chạy
        splitter = JPLTAudioSplitter(
            audio_path=audio_path,
            output_dir=output_dir,
            whisper_model_size="base"  # tiny/base/small/medium/large
        )
        
        stats = splitter.process()
        
        # Success
        return 0
        
    except FileNotFoundError as e:
        logger.error(f"❌ File không tồn tại: {e}")
        return 1
    except ValueError as e:
        logger.error(f"❌ Lỗi cấu hình: {e}")
        return 1
    except Exception as e:
        logger.error(f"❌ Lỗi không xác định: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    exit(main())