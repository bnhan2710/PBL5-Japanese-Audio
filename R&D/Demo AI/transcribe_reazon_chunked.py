import os
import sys
from pydub import AudioSegment
from pydub.silence import split_on_silence
import reazonspeech as rs

def process_audio_file(input_file, save_file=True):
    if not os.path.isfile(input_file):
        print(f"Error: File not found at '{input_file}'")
        return None

    print(f"Processing: {input_file}")
    
    # 2. Load Audio
    print("Loading audio... (may take time for large files)")
    audio = AudioSegment.from_file(input_file)
    print(f"Audio duration: {len(audio)/1000:.2f}s")

    # 3. Split on silence
    # Best practice: silence_thresh should be relative to the audio's dBFS
    silence_thresh = audio.dBFS - 14 
    min_silence_len = 250 # 0.25 sec
    keep_silence = 200 # keep 0.2s of silence at ends

    print(f"Splitting audio (Threshold: {silence_thresh:.2f} dBFS)...")
    chunks = split_on_silence(
        audio,
        min_silence_len=min_silence_len,
        silence_thresh=silence_thresh,
        keep_silence=keep_silence
    )
    
    print(f"Split into {len(chunks)} chunks.")

    # 4. Transcribe each chunk
    full_transcript = []
    
    # Create temp dir for chunks
    temp_dir = "temp_chunks"
    os.makedirs(temp_dir, exist_ok=True)

    print("Loading ReazonSpeech model...")
    # Using 'reazonspeech-k2-v2' which is optimized for general Japanese
    from reazonspeech.k2.asr import load_model, transcribe, audio_from_path
    # Note: reazonspeech usually auto-downloads model. 
    # Check if GPU is available? Reazon usually detects.
    # On Mac M1/M2, it runs on CPU usually unless specific install.
    
    try:
        model = load_model("reazonspeech-k2-v2")
    except Exception as e:
        print(f"Error loading model: {e}")
        return

    print("Starting transcription...")
    
    for i, chunk in enumerate(chunks):
        # Filter very short chunks (e.g. noise < 0.2s)
        if len(chunk) < 200:
            continue
            
        chunk_path = os.path.join(temp_dir, f"chunk_{i}.wav")
        chunk.export(chunk_path, format="wav")
        
        try:
            # ReazonSpeech transcribe returns a result object
            audio = audio_from_path(chunk_path)
            ret = transcribe(model, audio)
            text = ret.text
            
            if text:
                if text in ["プ", "ピッ"]:
                    print(f"Chunk {i+1}/{len(chunks)}: [Bell/Noise detected - Separator]")
                    full_transcript.append("\n\n")
                else:
                    print(f"Chunk {i+1}/{len(chunks)}: {text}")
                    full_transcript.append(text)
            else:
                print(f"Chunk {i+1}/{len(chunks)}: [No speech detected]")
                
        except Exception as e:
            print(f"Error transcribing chunk {i}: {e}")
        
        # Cleanup chunk
        os.remove(chunk_path)

    # 5. Combine and Save
    final_text = "".join(full_transcript)
    
    if save_file:
        output_file = f"{os.path.splitext(input_file)[0]}_transcript.txt"
        
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(final_text)
            
        print("-" * 30)
        print("Transcription Complete!")
        print(f"Saved to: {output_file}")
    
    # Cleanup temp dir
    os.rmdir(temp_dir)
    
    return final_text

def main():
    print("--- Chunked ReazonSpeech Transcriber ---")
    
    # 1. Get input file
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    else:
        input_file = input("Enter the path to the audio file: ").strip().strip("'").strip('"')

    process_audio_file(input_file)

if __name__ == "__main__":
    main()
