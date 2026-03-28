import os
import sys
import re
from pydub import AudioSegment
from pydub.silence import split_on_silence
import reazonspeech as rs
from transformers import pipeline

def format_jlpt_master(chunks_data):
    """
    Tách biệt 3 phần: Intro -> Hội thoại -> Outro. Lọc sạch tiếng chuông rác.
    """
    if not chunks_data:
        return ""

    texts = []
    for c in chunks_data:
        text = c['text']
        # 1. BỘ LỌC ÂM THANH RÁC: Xóa ngay các tiếng chuông ReazonSpeech nhận nhầm
        text = re.sub(r'(ピン|パン|プッ|ピッ|プ|ピ)', '', text)
        text = text.replace("。", "").strip()
        texts.append(text)

    genders = [c['gender'] for c in chunks_data]

    # ==========================================
    # 2. TÌM INTRO (Đọc từ đầu đến chữ "か" đầu tiên)
    # ==========================================
    dialogue_start = 0
    for i, text in enumerate(texts):
        if text.endswith("か") or text.endswith("か？"):
            dialogue_start = i + 1
            break
            
    if dialogue_start == 0:
        dialogue_start = min(2, len(texts))

    intro_texts = [t for t in texts[:dialogue_start] if t]
    
    # Gộp Intro, xóa các chữ "次" (Tiếp theo), bẻ dòng số câu (一番)
    intro_str = "。".join(intro_texts) + "。"
    intro_str = re.sub(r'(次。?)', "", intro_str).strip()
    intro_str = re.sub(r'((?:一|二|三|四|1|2|3|4)番)？?。?', r'\1\n', intro_str)

    # ==========================================
    # 3. TÌM OUTRO ĐÚNG CHUẨN (Quét ngược từ dưới lên)
    # ==========================================
    dialogue_end = len(texts)
    for i in range(len(texts)-1, dialogue_start-1, -1):
        if texts[i].endswith("か") or texts[i].endswith("か？"):
            out_start = i
            # Thuật toán quét ngược: Tìm chủ ngữ của câu hỏi để gom trọn vẹn câu
            # Lùi lại tối đa 4 đoạn để tìm các từ khóa chủ ngữ
            for j in range(i, max(dialogue_start - 1, i - 5), -1):
                if any(subj in texts[j] for subj in ["男の人", "女の人", "学生", "男の子", "女の子", "人", "何"]):
                    out_start = j
            dialogue_end = out_start
            break
            
    outro_texts = [t for t in texts[dialogue_end:] if t]
    outro_str = "。".join(outro_texts) + "。" if outro_texts else ""

    # ==========================================
    # 4. XỬ LÝ HỘI THOẠI (Chỉ gắn Nam/Nữ ở khu vực này)
    # ==========================================
    dialogue_blocks = []
    current_gender = None
    current_text = ""

    for i in range(dialogue_start, dialogue_end):
        text = texts[i]
        gender = genders[i]
        
        if not text:
            continue

        if gender == "Unknown":
            gender = current_gender if current_gender else "女"
            
        # NẾU CÙNG 1 NGƯỜI NÓI -> Gộp thành 1 câu dài (Tránh đứt đoạn)
        if gender == current_gender:
            current_text += "。" + text
        else:
            if current_text:
                dialogue_blocks.append(f"{current_gender}：{current_text}。")
            current_gender = gender
            current_text = text
            
    if current_text:
        dialogue_blocks.append(f"{current_gender}：{current_text}。")

    # Dọn dẹp dấu chấm dư ở đầu dòng nếu có
    for idx in range(len(dialogue_blocks)):
        dialogue_blocks[idx] = dialogue_blocks[idx].replace("：。", "：")

    # ==========================================
    # 5. RÁP THÀNH PHẨM (Format sạch sẽ)
    # ==========================================
    final_output = "--------\n"
    final_output += f"{intro_str}\n\n"
    
    if dialogue_blocks:
        final_output += "\n".join(dialogue_blocks) + "\n\n"
        
    final_output += f"{outro_str}\n"
    final_output += "--------\n"
    
    return final_output

def process_audio_file(input_file, save_file=True):
    if not os.path.isfile(input_file):
        print(f"Lỗi: Không tìm thấy file '{input_file}'")
        return None

    print(f"Đang xử lý: {input_file}")
    audio = AudioSegment.from_file(input_file)
    
    chunks = split_on_silence(
        audio,
        min_silence_len=400, 
        silence_thresh=audio.dBFS - 14,
        keep_silence=150
    )
    
    print(f"Đã chia thành {len(chunks)} đoạn nhỏ.")

    from reazonspeech.k2.asr import load_model, transcribe, audio_from_path
    print("Đang nạp mô hình dịch Text (ReazonSpeech)...")
    text_model = load_model("reazonspeech-k2-v2")

    print("Đang nạp AI Nhận diện Giới tính...")
    gender_classifier = pipeline("audio-classification", model="alefiury/wav2vec2-large-xlsr-53-gender-recognition-librispeech")

    chunks_data = []
    temp_dir = "temp_chunks"
    os.makedirs(temp_dir, exist_ok=True)

    print("Bắt đầu dịch và phân tích Nam/Nữ...")
    
    for i, chunk in enumerate(chunks):
        if len(chunk) < 300: 
            continue
            
        chunk_path = os.path.join(temp_dir, f"chunk_{i}.wav")
        chunk.export(chunk_path, format="wav")
        
        try:
            audio_data = audio_from_path(chunk_path)
            ret = transcribe(text_model, audio_data)
            text = ret.text.strip() if ret.text else ""
            
            if text:
                gender_pred = gender_classifier(chunk_path)
                top_label = gender_pred[0]['label'].lower()
                gender = "男" if top_label == "male" else "女"
                
                print(f"Đoạn {i+1} [{gender}]: {text}")
                chunks_data.append({'text': text, 'gender': gender})
                
        except Exception as e:
            pass
        
        os.remove(chunk_path)

    os.rmdir(temp_dir)

    final_text = format_jlpt_master(chunks_data)
    
    if save_file:
        output_file = f"{os.path.splitext(input_file)[0]}_transcript.txt"
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(final_text)
            
        print("-" * 30)
        print(f"🎉 Hoàn thành! File kịch bản chuẩn đã lưu tại: {output_file}")
    
    return final_text

if __name__ == "__main__":
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    else:
        input_file = input("Nhập đường dẫn file audio: ").strip().strip("'").strip('"')

    process_audio_file(input_file)