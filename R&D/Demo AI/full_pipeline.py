import os
import sys
import argparse
from dotenv import load_dotenv
from transcribe_reazon_chunked import process_audio_file
from refine_transcript_gemini import refine_transcript

# Load environment variables
load_dotenv()

def main():
    parser = argparse.ArgumentParser(description="Full Transcription Pipeline (ReazonSpeech + Gemini)")
    parser.add_argument("audio_file", help="Path to the input audio file")
    
    args = parser.parse_args()
    
    # Check Google API Key
    if not os.getenv("GOOGLE_API_KEY"):
        print("Error: GOOGLE_API_KEY is missing. Please check your .env file.")
        return

    # Check Audio File
    if not os.path.isfile(args.audio_file):
        print(f"Error: File not found: {args.audio_file}")
        return

    print("="*50)
    print("Step 1: ReazonSpeech Transcription")
    print("="*50)
    
    # Run ReazonSpeech
    # This might take time depending on audio length
    # Run ReazonSpeech
    # This might take time depending on audio length
    raw_text = process_audio_file(args.audio_file, save_file=False)
    
    if not raw_text:
        print("Error: ReazonSpeech transcription failed.")
        return

    print("\n" + "="*50)
    print("Step 2: Google Gemini Refinement")
    print("="*50)
    
    # Run Gemini Refinement
    try:
        refined_text = refine_transcript(raw_text)
        
        # Save Refined Transcript
        output_file = f"{os.path.splitext(args.audio_file)[0]}_final_script_gemini.txt"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(refined_text)
            
        print("-" * 30)
        print("Pipeline Complete!")
        print(f"Final Script: {output_file}")
        print("-" * 30)
        
    except Exception as e:
        print(f"Error during refinement: {e}")

if __name__ == "__main__":
    main()
