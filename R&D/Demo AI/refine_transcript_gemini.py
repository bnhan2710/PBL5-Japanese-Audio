import os
import sys
import argparse
import google.generativeai as genai
from dotenv import load_dotenv

# Load key from .env
load_dotenv()
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')

if not GOOGLE_API_KEY:
    print("Warning: GOOGLE_API_KEY is not set in .env or environment")
else:
    genai.configure(api_key=GOOGLE_API_KEY)

def refine_transcript(input_text, model_name="gemini-2.5-flash"):
    """
    Refines Japanese transcript using Google Gemini.
    - Adds punctuation.
    - Identifies speakers (Man/Woman) if clear.
    """
    
    prompt = """
    You are a professional Japanese transcriber specializing in JLPT listening tests.
    Your task is to refine the following raw transcript from an ASR system into a structured script.
    
    The input text usually follows this structure:
    1.  **Introduction**: Mondai number (e.g., 一番), Situation description, and the Initial Question.
    2.  **Conversation**: The main dialogue.
    3.  **Final Question**: The question is repeated at the end.

    **Your Goal**:
    - Identify and separate these three parts clearly.
    - Add correct Japanese punctuation (。,、, ?, !).
    - Identify speakers in the Conversation part (男： / 女：).
    
    **Required Output Format**:
    
    [Introduction]
    (Mondai Number, Situation, and Initial Question go here)

    [Conversation]
    (Dialogue with speaker labels)
    男：...
    女：...

    [Question]
    (The final repeated question goes here)
    
    **Important Rules**:
    1.  **Do NOT summarize**. Keep the full content of the introduction and question.
    2.  **Speaker Identification (Critical)**:
        - Pay close attention to short responses (Aizuchi) like 「はい」「ええ」「うん」「そうですね」.
        - These often indicate a change in speaker.
        - Example: If Speaker A asks a question or gives an order, and "Hai" follows, that "Hai" usually belongs to Speaker B.
        - Do not merge these short responses into the previous speaker's line if it doesn't make sense contextually.
    3.  If the "Final Question" is missing in the source, omitting it is okay, but always look for it.
    4.  Output ONLY the refined structured text.
    """

    try:
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(f"{prompt}\n\nInput Text:\n{input_text}")
        return response.text.strip()
    except Exception as e:
        return f"Error: {str(e)}"

def main():
    parser = argparse.ArgumentParser(description="Refine Japanese transcript using Google Gemini.")
    parser.add_argument("input_file", help="Path to the raw transcript file")
    
    args = parser.parse_args()

    if not os.path.isfile(args.input_file):
        print(f"Error: File not found: {args.input_file}")
        return

    print(f"Refining: {args.input_file} (Model: gemini-1.5-flash)...")
    
    with open(args.input_file, "r", encoding="utf-8") as f:
        raw_text = f.read()

    refined_text = refine_transcript(raw_text)
    
    output_file = f"{os.path.splitext(args.input_file)[0]}_refined_gemini.txt"
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(refined_text)

    print("-" * 30)
    print("Refinement Complete!")
    print(f"Saved to: {output_file}")

if __name__ == "__main__":
    main()
