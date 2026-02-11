# #!/usr/bin/env python3
# """
# Audio to Text - Chuyển đổi file audio thành script tiếng Nhật

# Chức năng:
# 1. Convert 1 file: python3 audio_to_text.py file.mp3
# 2. Convert tất cả: python3 audio_to_text.py output/mondai --batch

# Script sẽ tự động:
# - Tạo file .txt cùng tên và cùng thư mục với file .mp3
# - Quét tất cả mondai và questions nếu dùng --batch
# - Giữ nguyên cấu trúc thư mục

# Author: PBL5 Team
# Version: 2.0
# """

# import whisper
# import sys
# import argparse
# import logging
# from pathlib import Path
# from typing import List, Optional

# # Setup logging
# logging.basicConfig(
#     level=logging.INFO,
#     format='%(asctime)s - %(levelname)s - %(message)s'
# )
# logger = logging.getLogger(__name__)


# def audio_to_text(audio_path: str, output_path: str = None, model = None, model_size: str = "base", quiet: bool = False) -> str:
#     """
#     Chuyển file audio thành text tiếng Nhật
    
#     Args:
#         audio_path: Đường dẫn file audio (mp3, wav, m4a, etc)
#         output_path: Đường dẫn file output (optional, mặc định: cùng tên .txt)
#         model: Whisper model đã load (optional, để tái sử dụng)
#         model_size: Whisper model size nếu chưa có model
#         quiet: Ẩn output chi tiết
    
#     Returns:
#         Text tiếng Nhật
#     """
#     audio_file = Path(audio_path)
    
#     # Kiểm tra file tồn tại
#     if not audio_file.exists():
#         raise FileNotFoundError(f"❌ File không tồn tại: {audio_path}")
    
#     # Xác định output path
#     if output_path is None:
#         # Kiểm tra nếu file nằm trong output/mondai → giữ nguyên cùng thư mục (batch mode)
#         # Nếu file nằm ở input/ hoặc nơi khác → đưa vào output/ (single file mode)
#         if "output" in str(audio_file.parent):
#             output_path = audio_file.with_suffix('.txt')
#         else:
#             # Single file mode: đưa vào thư mục output/
#             output_dir = Path("output")
#             output_dir.mkdir(exist_ok=True)
#             output_path = output_dir / audio_file.with_suffix('.txt').name
#     else:
#         output_path = Path(output_path)
    
#     if not quiet:
#         logger.info(f"📝 {audio_file.name} → {output_path.name}")
    
#     # Load Whisper model nếu chưa có
#     if model is None:
#         if not quiet:
#             logger.info(f"🔄 Loading Whisper model ({model_size})...")
#         model = whisper.load_model(model_size)
    
#     # Transcribe
#     result = model.transcribe(
#         str(audio_file),
#         language="ja",  # Japanese
#         task="transcribe",
#         initial_prompt="JLPTの聴解問題です。文脈を理解し、句読点（。、）を正しく含めた自然な日本語で書き起こしてください。",
#         verbose=False
#     )
    
#     # Lấy text
#     text = result["text"].strip()
    
#     # Lưu file
#     with open(output_path, "w", encoding="utf-8") as f:
#         f.write(text)
    
#     if not quiet:
#         logger.info(f"✅ Saved: {output_path.relative_to(audio_file.parent.parent) if len(audio_file.parents) > 1 else output_path}")
    
#     return text


# def find_audio_files(base_dir: Path) -> List[Path]:
#     """
#     Tìm tất cả file MP3 trong cấu trúc mondai
    
#     Args:
#         base_dir: Thư mục gốc (output/mondai)
        
#     Returns:
#         List các path đến file MP3
#     """
#     audio_files = []
    
#     # Tìm trong cấu trúc: mondai_X/mondai_X.mp3 và mondai_X/questions/question_Y.mp3
#     for mondai_dir in sorted(base_dir.glob("mondai_*")):
#         if not mondai_dir.is_dir():
#             continue
        
#         # File mondai chính
#         mondai_file = mondai_dir / f"{mondai_dir.name}.mp3"
#         if mondai_file.exists():
#             audio_files.append(mondai_file)
        
#         # Files questions
#         questions_dir = mondai_dir / "questions"
#         if questions_dir.exists():
#             question_files = sorted(questions_dir.glob("question_*.mp3"))
#             audio_files.extend(question_files)
    
#     return audio_files


# def batch_convert(base_dir: str, model_size: str = "base") -> dict:
#     """
#     Convert tất cả file audio trong thư mục thành text
    
#     Args:
#         base_dir: Thư mục chứa các mondai
#         model_size: Whisper model size
        
#     Returns:
#         Stats: {'total': int, 'success': int, 'failed': int}
#     """
#     base_path = Path(base_dir)
    
#     if not base_path.exists():
#         raise FileNotFoundError(f"❌ Thư mục không tồn tại: {base_dir}")
    
#     logger.info("="*60)
#     logger.info("🎬 BATCH CONVERT - Audio to Text")
#     logger.info("="*60)
#     logger.info(f"📂 Scanning: {base_path}")
    
#     # Tìm tất cả file audio
#     audio_files = find_audio_files(base_path)
    
#     if not audio_files:
#         logger.warning("⚠️ Không tìm thấy file audio nào!")
#         return {"total": 0, "success": 0, "failed": 0}
    
#     logger.info(f"📊 Found {len(audio_files)} audio files")
#     logger.info("")
    
#     # Load model một lần duy nhất
#     logger.info(f"🔄 Loading Whisper model ({model_size})...")
#     model = whisper.load_model(model_size)
#     logger.info("✅ Model loaded")
#     logger.info("")
    
#     # Process từng file
#     stats = {"total": len(audio_files), "success": 0, "failed": 0}
    
#     for i, audio_file in enumerate(audio_files, 1):
#         try:
#             logger.info(f"[{i}/{len(audio_files)}] Processing...")
#             audio_to_text(
#                 audio_path=str(audio_file),
#                 model=model,
#                 quiet=False
#             )
#             stats["success"] += 1
#             logger.info("")
            
#         except Exception as e:
#             logger.error(f"❌ Error: {e}")
#             stats["failed"] += 1
#             logger.info("")
    
#     # Summary
#     logger.info("="*60)
#     logger.info("✨ BATCH CONVERT COMPLETED")
#     logger.info("="*60)
#     logger.info(f"📊 Total files: {stats['total']}")
#     logger.info(f"✅ Success: {stats['success']}")
#     logger.info(f"❌ Failed: {stats['failed']}")
#     logger.info("="*60)
    
#     return stats


# def main():
#     """
#     Main entry point
    
#     Usage:
#     1. Convert 1 file:
#       python3 audio_to_text.py audio.mp3
#       python3 audio_to_text.py audio.mp3 script.txt
#       python3 audio_to_text.py audio.mp3 --model small

#     2. Convert tất cả (batch):
#       python3 audio_to_text.py output/mondai --batch
#       python3 audio_to_text.py output/mondai --batch --model small

#     Cấu trúc output:
#       output/mondai/
#       ├── mondai_1/
#       │   ├── mondai_1.mp3
#       │   ├── mondai_1.txt    ← Script tự động tạo
#       │   └── questions/
#       │       ├── question_1.mp3
#       │       ├── question_1.txt    ← Script tự động tạo
#       │       └── ...
#       └── ...

#     Model sizes:
#       tiny   - Nhanh nhất, độ chính xác trung bình
#       base   - Cân bằng tốc độ và độ chính xác (khuyến nghị)
#       small  - Chậm hơn, chính xác hơn
#       medium - Rất chính xác, khá chậm
#       large  - Chính xác nhất, rất chậm
#     """
#     parser = argparse.ArgumentParser(
#         description="Chuyển file audio thành script tiếng Nhật",
#         formatter_class=argparse.RawDescriptionHelpFormatter,
#         epilog=main.__doc__
#     )
    
#     parser.add_argument(
#         "path",
#         help="File audio hoặc thư mục (với --batch)"
#     )
#     parser.add_argument(
#         "output_file",
#         nargs="?",
#         default=None,
#         help="File output cho single file (optional)"
#     )
#     parser.add_argument(
#         "--batch",
#         action="store_true",
#         help="Batch mode: convert tất cả file trong thư mục"
#     )
#     parser.add_argument(
#         "--model",
#         default="small",
#         choices=["tiny", "base", "small", "medium", "large"],
#         help="Whisper model size (default: small)"
#     )
    
#     args = parser.parse_args()
    
#     try:
#         if args.batch:
#             # Batch mode
#             stats = batch_convert(
#                 base_dir=args.path,
#                 model_size=args.model
#             )
#             return 0 if stats["failed"] == 0 else 1
            
#         else:
#             # Single file mode
#             print("="*60)
#             print("🎬 AUDIO TO TEXT - JLPT Script Generator")
#             print("="*60)
#             print()
            
#             # Load model
#             print(f"🔄 Loading Whisper model ({args.model})...")
#             model = whisper.load_model(args.model)
#             print("✅ Model loaded")
#             print()
            
#             # Convert
#             audio_to_text(
#                 audio_path=args.path,
#                 output_path=args.output_file,
#                 model=model,
#                 quiet=False
#             )
            
#             print()
#             print("="*60)
#             print("✨ HOÀN THÀNH!")
#             print("="*60)
            
#             return 0
        
#     except FileNotFoundError as e:
#         logger.error(f"\n❌ Lỗi: {e}")
#         return 1
#     except Exception as e:
#         logger.error(f"\n❌ Lỗi không xác định: {e}")
#         import traceback
#         traceback.print_exc()
#         return 1


# if __name__ == "__main__":
#     sys.exit(main())
