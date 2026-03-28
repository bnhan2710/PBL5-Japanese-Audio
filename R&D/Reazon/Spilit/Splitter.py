# # import librosa
# # import numpy as np
# # from scipy import signal

# # def format_time(seconds):
# #     """Chuyển đổi giây sang HH:MM:SS.mmm"""
# #     m, s = divmod(seconds, 60)
# #     h, m = divmod(m, 60)
# #     return f"{int(h):02d}:{int(m):02d}:{s:06.3f}"

# # def find_bell_timestamps(main_audio_path, bell_sample_path, threshold_percent=0.85):
# #     print("⏳ Đang tải file âm thanh và chuyển về cùng một tần số lấy mẫu (Sample Rate)...")
# #     # 1. Tải file và ép về định dạng Mono (1 kênh) để so khớp chính xác
# #     # librosa mặc định đưa về sr=22050Hz, giúp việc tính toán cực nhanh
# #     main_audio, sr = librosa.load(main_audio_path, sr=None, mono=True)
# #     bell_audio, _ = librosa.load(bell_sample_path, sr=sr, mono=True)
    
# #     print("🔍 Bắt đầu quét và so khớp tiếng chuông (Template Matching)...")
# #     # 2. Sử dụng FFT Convolve để so khớp chéo siêu tốc độ
# #     # mode='valid' sẽ trả về vị trí khớp chính xác ngay điểm bắt đầu của tiếng chuông
# #     correlation = signal.correlate(main_audio, bell_audio, mode='valid', method='fft')
    
# #     # 3. Tìm các "Đỉnh" (Peaks) tương đồng
# #     # Xác định mức độ giống nhau tối đa trong file
# #     max_correlation = np.max(correlation)
    
# #     # Ngưỡng (Threshold): Ví dụ 0.85 nghĩa là độ tương đồng phải đạt ít nhất 85% so với điểm khớp nhất
# #     threshold = max_correlation * threshold_percent 
    
# #     # Khoảng cách tối thiểu giữa 2 tiếng chuông (Tránh bắt trùng 1 tiếng chuông nhiều lần)
# #     # distance = sr * 10 (Nghĩa là 2 tiếng chuông cách nhau ít nhất 10 giây)
# #     min_distance = sr * 10 
    
# #     peaks, _ = signal.find_peaks(correlation, height=threshold, distance=min_distance)
    
# #     if len(peaks) == 0:
# #         print("❌ Không tìm thấy đoạn âm thanh nào khớp với tiếng chuông mẫu.")
# #         return []

# #     print(f"\n🎯 TUYỆT VỜI! Đã bắt được {len(peaks)} tiếng chuông mẫu:")
# #     print("-" * 40)
# #     print(f"{'CÂU HỎI':<15} | {'THỜI ĐIỂM CHUÔNG KÊU':<20}")
# #     print("-" * 40)
    
# #     bell_times_ms = []
    
# #     for i, peak_index in enumerate(peaks):
# #         # Đổi từ Index của mảng sang Giây (Seconds)
# #         time_in_seconds = peak_index / sr
# #         time_in_ms = int(time_in_seconds * 1000)
# #         bell_times_ms.append(time_in_ms)
        
# #         print(f"Tiếng chuông {i+1:02d} | {format_time(time_in_seconds)}")

# #     print("-" * 40)
# #     return bell_times_ms

# # # -------- GỌI HÀM --------
# # if __name__ == "__main__":
# #     # Đưa file jlpt gốc và file chuông mẫu (chỉ cần dài khoảng 1-2 giây chứa đúng tiếng chuông)
# #     jlpt_file = "JLPT_N2.mp3" 
# #     bell_file = "Bell_sound.mp3" 
    
# #     # Bạn có thể tinh chỉnh threshold_percent. 
# #     # Nếu nó bắt sót chuông -> Hạ xuống 0.7. 
# #     # Nếu nó bắt nhầm giọng nói thành chuông -> Tăng lên 0.9 hoặc 0.95.
# #     bell_timestamps = find_bell_timestamps(jlpt_file, bell_file, threshold_percent=0.85)


# import librosa
# import numpy as np
# from scipy import signal
# from pydub import AudioSegment
# import os

# def format_time(ms):
#     """Chuyển đổi mili-giây sang HH:MM:SS.mmm"""
#     seconds = ms / 1000.0
#     m, s = divmod(seconds, 60)
#     h, m = divmod(m, 60)
#     return f"{int(h):02d}:{int(m):02d}:{s:06.3f}"

# def find_bell_timestamps(main_audio_path, bell_sample_path, threshold_percent=0.85):
#     print("⏳ [BƯỚC 1] Đang phân tích sóng âm để quét tiếng chuông (Template Matching)...")
#     # Tải file âm thanh để phân tích toán học (nhanh và nhẹ)
#     main_audio, sr = librosa.load(main_audio_path, sr=None, mono=True)
#     bell_audio, _ = librosa.load(bell_sample_path, sr=sr, mono=True)
    
#     # So khớp chéo
#     correlation = signal.correlate(main_audio, bell_audio, mode='valid', method='fft')
#     threshold = np.max(correlation) * threshold_percent 
#     min_distance = sr * 10 # Khoảng cách tối thiểu giữa 2 tiếng chuông là 10 giây
    
#     peaks, _ = signal.find_peaks(correlation, height=threshold, distance=min_distance)
    
#     # Chuyển đổi vị trí đỉnh (peaks) thành mili-giây (ms)
#     bell_times_ms = [int((peak / sr) * 1000) for peak in peaks]
#     return bell_times_ms

# def split_jlpt_by_bells(main_audio_path, bell_sample_path, output_dir="jlpt_final_bells"):
#     if not os.path.exists(output_dir):
#         os.makedirs(output_dir)

#     # 1. LẤY MẢNG THỜI GIAN CỦA TIẾNG CHUÔNG
#     bell_times_ms = find_bell_timestamps(main_audio_path, bell_sample_path)
    
#     if not bell_times_ms:
#         print("❌ Không tìm thấy tiếng chuông nào. Vui lòng kiểm tra lại file bell mẫu.")
#         return

#     print(f"🎯 Đã khóa mục tiêu {len(bell_times_ms)} tiếng chuông!")
#     print("⏳ [BƯỚC 2] Đang tải audio vào Pydub để tiến hành cắt file chất lượng cao...")
    
#     audio = AudioSegment.from_file(main_audio_path)
    
#     # 2. XÂY DỰNG MA TRẬN ĐIỂM CẮT
#     # Bắt đầu từ 0 -> Các tiếng chuông -> Kết thúc bằng độ dài file audio
#     cut_points = [0] + bell_times_ms + [len(audio)]

#     print("\n✂️ Bắt đầu xuất file:\n" + "-"*55)
#     print(f"{'TÊN FILE':<15} | {'BẮT ĐẦU':<15} | {'KẾT THÚC':<15}")
#     print("-"*55)

#     # 3. VÒNG LẶP CẮT FILE BẰNG PYDUB
#     for i in range(len(cut_points) - 1):
#         start_ms = cut_points[i]
        
#         # Logic cắt sạch: Điểm cuối lùi lại 100ms (0.1s) để không dính chuông của câu sau
#         if i < len(cut_points) - 2:
#             end_ms = cut_points[i+1] - 100
#         else:
#             # Nếu là đoạn cuối cùng thì lấy đến tận cùng file
#             end_ms = cut_points[i+1] 
            
#         # Bảo vệ tránh lỗi số âm nếu khoảng cách quá ngắn
#         if end_ms < start_ms:
#             end_ms = start_ms

#         # Thực hiện cắt
#         chunk = audio[start_ms:end_ms]
        
#         # Định danh tên file
#         if i == 0:
#             output_name = "00_intro.mp3"
#         else:
#             output_name = f"cau_{i:02d}.mp3"
            
#         output_path = os.path.join(output_dir, output_name)
        
#         # Xuất file (Lưu ý: bitrate="192k" giữ chất lượng âm thanh tốt)
#         chunk.export(output_path, format="mp3", bitrate="192k")
        
#         # In log ra màn hình
#         start_str = format_time(start_ms)
#         end_str = format_time(end_ms)
#         print(f"✅ {output_name:<13} | {start_str:<15} | {end_str:<15}")

#     print("-" * 55)
#     print(f"🎉 HOÀN THÀNH XUẤT SẮC!")
#     print(f"📁 Toàn bộ file đã được cắt sát tiếng chuông và lưu tại thư mục: '{output_dir}/'")

# # -------- GỌI HÀM THỰC THI --------
# if __name__ == "__main__":
#     # Đảm bảo 2 file này nằm cùng thư mục với script Python của bạn
#     jlpt_file = "JLPT_N2.mp3" 
#     bell_file = "Bell_sound.mp3" # File chuông mẫu cắt từ gốc (chỉ cần khoảng 1-2 giây)
    
#     split_jlpt_by_bells(jlpt_file, bell_file)


import librosa
import numpy as np
from scipy import signal
from pydub import AudioSegment
import os

def format_time(ms):
    """Chuyển đổi mili-giây sang HH:MM:SS.mmm"""
    seconds = ms / 1000.0
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}"

def find_true_bells(main_audio_path, bell1_path, bell2_path, threshold_percent=0.85):
    print("⏳ [BƯỚC 1] Đang tải audio và các file mẫu vào bộ nhớ...")
    main_audio, sr = librosa.load(main_audio_path, sr=None, mono=True)
    bell1_audio, _ = librosa.load(bell1_path, sr=sr, mono=True)
    bell2_audio, _ = librosa.load(bell2_path, sr=sr, mono=True)
    
    # ---------------------------------------------------------
    # BƯỚC 2A: TÌM CHUÔNG 2 NHỊP (BẪY MONDAI 2) TRƯỚC
    # ---------------------------------------------------------
    print("🔍 Đang rà soát để gỡ bẫy chuông 2 nhịp (Bell 2 baku)...")
    corr2 = signal.correlate(main_audio, bell2_audio, mode='valid', method='fft')
    thresh2 = np.max(corr2) * threshold_percent
    peaks2, _ = signal.find_peaks(corr2, height=thresh2, distance=sr*10)
    
    bell2_times_sec = [p / sr for p in peaks2]
    print(f"  👉 Phát hiện {len(bell2_times_sec)} chuông 2 nhịp. (Sẽ đưa vào danh sách đen/bỏ qua)")

    # ---------------------------------------------------------
    # BƯỚC 2B: TÌM CHUÔNG 1 NHỊP (MỤC TIÊU CẮT CHÍNH)
    # ---------------------------------------------------------
    print("🔍 Đang quét tiếng chuông 1 nhịp (Mục tiêu cắt)...")
    corr1 = signal.correlate(main_audio, bell1_audio, mode='valid', method='fft')
    thresh1 = np.max(corr1) * threshold_percent
    peaks1, _ = signal.find_peaks(corr1, height=thresh1, distance=sr*10)
    
    bell1_times_raw_sec = [p / sr for p in peaks1]
    
    # ---------------------------------------------------------
    # BƯỚC 2C: LỌC NHIỄU (LOẠI BỎ CHUÔNG 1 TRÙNG CHUÔNG 2)
    # ---------------------------------------------------------
    valid_bell_times_ms = []
    
    for t1 in bell1_times_raw_sec:
        is_trap = False
        for t2 in bell2_times_sec:
            # Nếu chuông 1 nhịp nằm trong khoảng 3 giây quanh chuông 2 nhịp -> Đích thị là nhận diện nhầm
            if abs(t1 - t2) < 3.0: 
                is_trap = True
                break
                
        if not is_trap:
            # Nếu an toàn, đổi sang mili-giây và lưu lại
            valid_bell_times_ms.append(int(t1 * 1000))

    print(f"🎯 Sau khi lọc bẫy, đã chốt được chính xác {len(valid_bell_times_ms)} tiếng chuông hợp lệ!")
    return valid_bell_times_ms

def split_jlpt_smart(main_audio_path, bell1_path, bell2_path, output_dir="jlpt_final_bells"):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # 1. GỌI HÀM TÌM CHUÔNG CHUẨN XÁC
    bell_times_ms = find_true_bells(main_audio_path, bell1_path, bell2_path)
    
    if not bell_times_ms:
        print("❌ Không tìm thấy chuông hợp lệ nào.")
        return

    print("⏳ [BƯỚC 3] Đang đưa vào Pydub để cắt file...\n")
    audio = AudioSegment.from_file(main_audio_path)
    cut_points = [0] + bell_times_ms + [len(audio)]

    print("-" * 55)
    print(f"{'TÊN CÂU HỎI':<15} | {'BẮT ĐẦU':<15} | {'KẾT THÚC':<15}")
    print("-" * 55)

    # 2. VÒNG LẶP CẮT FILE (Giữ nguyên logic lùi 0.1s cực mượt của bạn)
    for i in range(len(cut_points) - 1):
        start_ms = cut_points[i]
        
        if i < len(cut_points) - 2:
            end_ms = cut_points[i+1] - 100
        else:
            end_ms = cut_points[i+1] 
            
        if end_ms < start_ms:
            end_ms = start_ms

        chunk = audio[start_ms:end_ms]
        
        output_name = "00_intro.mp3" if i == 0 else f"cau_{i:02d}.mp3"
        output_path = os.path.join(output_dir, output_name)
        
        chunk.export(output_path, format="mp3", bitrate="192k")
        
        start_str = format_time(start_ms)
        end_str = format_time(end_ms)
        print(f"✅ {output_name:<13} | {start_str:<15} | {end_str:<15}")

    print("-" * 55)
    print("🎉 HOÀN THÀNH XUẤT SẮC!")
    print(f"📁 Audio cắt hoàn hảo (đã bỏ qua bẫy Mondai 2) lưu tại: '{output_dir}/'")


# -------- GỌI HÀM --------
if __name__ == "__main__":
    jlpt_file = "JLPT_N2.mp3" 
    bell_1_file = "Bell_sound.mp3"  # Chuông 1 nhịp (Cắt câu)
    bell_2_file = "Bell_2baku.mp3"  # Chuông 2 nhịp (Mondai 2 - Bỏ qua)
    
    split_jlpt_smart(jlpt_file, bell_1_file, bell_2_file)