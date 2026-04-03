import sys
import os
import asyncio

# Để import được app module
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.modules.ai_image.service import AIImageService
from app.modules.ai_image.schemas import AIImageTaskRequest
from app.core.config import get_settings

async def main():
    # Kiểm tra API KEY
    if not get_settings().GOOGLE_API_KEY:
        print("❌ Lỗi: Chưa cấu hình GOOGLE_API_KEY trong file .env")
        return

    service = AIImageService()
    
    # Tạo 1 payload giả lập dựa trên hội thoại tiếng Nhật JLPT N3
    req = AIImageTaskRequest(
        question_id="test_jlpt_n3_mondai1",
        script_text="男の人と女の人が駅で話しています。男の人はこれから何に乗りますか？ 男：タクシーで行く？ 女：いいえ、バスの方が安いわよ。 男：わかった、じゃあバスで行こう。",
        question_text="男の人はこれから何に乗りますか？",
        jlpt_level="N3"
    )
    
    print("⏳ Đang gọi Gemini suy nghĩ kịch bản và sinh Master Seed...")
    print("⏳ Đang gọi Pollinations AI sinh 4 ảnh song song...")
    print("Tốc độ mạng có thể ảnh hưởng đến kết quả, vui lòng đợi 30s - 1 phút...\n")
    
    try:
        result = await service.generate_quad_visual(req)
        
        print("✅ QUÁ TRÌNH TẠO ẢNH HOÀN TẤT !")
        print("-" * 50)
        print("📥 Lấy hình ảnh của bạn tại đường link sau:")
        print(f"👉 {result.image_url}")
        print("-" * 50)
        
        print("📝 Các Prompts đã dùng để gọi AI:")
        for idx, prompt in enumerate(result.prompts_used, start=1):
            print(f"   Tuỳ chọn {idx}: {prompt}")
            
    except Exception as e:
        print(f"❌ Xảy ra lỗi trong quá trình sinh ảnh: {e}")

if __name__ == "__main__":
    asyncio.run(main())
