import io
import json
import logging
import asyncio
import httpx
import urllib.parse 
from typing import List
from PIL import Image, ImageDraw, ImageFont
from google import genai

from app.core.config import get_settings
from app.modules.ai_image.schemas import (
    AIImageTaskRequest, ImageOptionGenerate, ImageResultData, VisualPlanResponse
)
from app.shared.upload import upload_image_bytes

settings = get_settings()
logger = logging.getLogger(__name__)

class AIImageService:
    def __init__(self):
        api_key = settings.GOOGLE_API_KEY
        if not api_key:
            raise ValueError("GOOGLE_API_KEY is required for AIImageService.")
        # Client này dùng cho Gemini Planning
        self._client = genai.Client(api_key=api_key)
        self._model_name = "gemini-2.0-flash"

    def _strip_json_markdown(self, text: str) -> str:
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        return text.strip()

    async def generate_quad_visual(self, req: AIImageTaskRequest) -> ImageResultData:
        loop = asyncio.get_event_loop()

        # Step 1: Gemini planning - Lên ý tưởng bối cảnh và 4 biến thể
        visual_plan_response = await self._plan_visuals(req)
        master_setting = visual_plan_response.master_setting
        visual_plan = visual_plan_response.options
        
        # Tạo 1 Master Seed để ép AI giữ đúng nhân vật/khuôn mặt trên cả 4 hình
        import random
        master_seed = random.randint(1, 999999)

        # Step 2: Sinh 4 ảnh song song bằng Pollinations AI (Miễn phí, ổn định)
        logger.info(f"Generating 4 images for Question: {req.question_id} with seed {master_seed}")
        
        async def safe_call(idx: int, description: str):
            try:
                # Tránh lỗi 429 từ Pollinations bằng cách gọi giãn cách nhau 1-2 giây
                await asyncio.sleep(idx * 1.5)
                full_prompt = f"{master_setting}, {description}"
                return await self._call_image_api(full_prompt, master_seed)
            except Exception as e:
                logger.error(f"Single image gen failed: {e}")
                return self._get_fallback_image()

        image_tasks = [safe_call(i, opt.description) for i, opt in enumerate(visual_plan)]
        images_data = await asyncio.gather(*image_tasks)
        
        # Step 3: Ghép 4 ảnh thành 1 khung hình (Sử dụng thread pool vì Pillow nặng CPU)
        final_image_bytes = await loop.run_in_executor(
            None, self._composite_images, images_data
        )
        
        # Step 4: Upload lên Cloudinary
        filename = f"image_{req.question_id}.png"
        image_url = await self._upload_to_cloud(final_image_bytes, filename)

        return ImageResultData(
            question_id=req.question_id,
            image_url=image_url,
            prompts_used=[opt.description for opt in visual_plan]
        )

    async def _plan_visuals(self, req: AIImageTaskRequest) -> VisualPlanResponse:
        prompt = f"""
You are an expert JLPT {req.jlpt_level} Exam Illustrator. 
Task: Analyze the provided Japanese listening script and create a cohesive visual layout for 4 options.

Context:
- Script: {req.script_text}
- Question: {req.question_text}

Guidelines:
1. Define a 'master_setting' that describes the main character(s), the background, and the overall style.
   Example: "A young Japanese man in a suit standing in a minimal office, Japanese manga style line art, black and white minimalist"
   (This master setting will be prepended to all 4 options to force the AI to draw the EXACT same style and character).
2. One option is the Correct Answer, 3 are Distractors (common mistakes).
3. The 'description' of each option should ONLY describe the specific action, object, or difference for that option, ignoring the master setting.
   Example: "He is holding a coffee cup" or "He is looking at a watch".

Output format: ONLY a valid JSON object matching this schema.
{{
  "master_setting": "Detailed master description...",
  "options": [
    {{"label": "1", "description": "Specific change for option 1..."}},
    {{"label": "2", "description": "Specific change for option 2..."}},
    {{"label": "3", "description": "Specific change for option 3..."}},
    {{"label": "4", "description": "Specific change for option 4..."}}
  ]
}}
"""
        try:
            response = self._client.models.generate_content(
                model=self._model_name,
                contents=prompt,
                config={'response_mime_type': 'application/json'}
            )
            
            clean_json = self._strip_json_markdown(response.text)
            data = json.loads(clean_json)
            return VisualPlanResponse(**data)
            
        except Exception as e:
            logger.error(f"Planning failed: {e}")
            fallback_options = [ImageOptionGenerate(label=str(i), description=f"Option {i}") for i in range(1, 5)]
            return VisualPlanResponse(
                master_setting="Japanese line art, black and white, white background",
                options=fallback_options
            )

    async def _call_image_api(self, prompt: str, seed: int, retries: int = 2) -> bytes:
        try:
            # Làm sạch prompt, cố định style Đen-Trắng chuẩn JLPT
            style_suffix = "minimalist Japanese manga style, line art, monochrome, black and white, flat shading, white background"
            clean_prompt = urllib.parse.quote(f"{prompt}, {style_suffix}")

            url = f"https://image.pollinations.ai/prompt/{clean_prompt}?width=512&height=512&seed={seed}&nologo=true"
            
            async with httpx.AsyncClient(timeout=40.0, follow_redirects=True) as client:
                for attempt in range(retries):
                    response = await client.get(url)
                    
                    if response.status_code == 429:
                        logger.warning(f"Pollinations 429 Rate limit. Retrying in 2s...")
                        await asyncio.sleep(2)
                        continue
                    
                    if response.status_code == 401:
                        logger.error("Pollinations đang đòi Key. Đang thử dùng server dự phòng...")
                        fallback_url = f"https://embed.pollinations.ai/prompt/{clean_prompt}?width=512&height=512"
                        response = await client.get(fallback_url)

                    response.raise_for_status()
                    return response.content
                    
                # Nếu hết số lần thử vẫn lỗi
                return self._get_fallback_image()
                
        except Exception as e:
            logger.error(f"Pollinations AI failed: {e}")
            return self._get_fallback_image()

    def _composite_images(self, images_data: List[bytes]) -> bytes:
        size = 512
        margin = 20
        canvas_size = (size * 2 + margin, size * 2 + margin)
        # Tạo canvas trắng
        canvas = Image.new("RGB", canvas_size, (255, 255, 255))
        draw = ImageDraw.Draw(canvas)
        
        # Load font hỗ trợ Tiếng Nhật (Katakana)
        font_paths = [
            "C:\\Windows\\Fonts\\msgothic.ttc",
            "C:\\Windows\\Fonts\\meiryo.ttc",
            "C:\\Windows\\Fonts\\YuGothM.ttc",
            "C:\\Windows\\Fonts\\arialuni.ttf",
            "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
            "/usr/share/fonts/truetype/ipafont/ipag.ttf",
            "/System/Library/Fonts/Hiragino Sans GB.ttc"
        ]
        font = None
        for fp in font_paths:
            try:
                font = ImageFont.truetype(fp, 40)
                break
            except Exception:
                continue
        if not font:
            logger.warning("No Japanese font found. Falling back to default font (Katakana might not render correctly).")
            font = ImageFont.load_default()

        positions = [
            (0, 0),                 # Ảnh 1 (Trên - Trái)
            (size + margin, 0),      # Ảnh 2 (Trên - Phải)
            (0, size + margin),      # Ảnh 3 (Dưới - Trái)
            (size + margin, size + margin) # Ảnh 4 (Dưới - Phải)
        ]
        # Sử dụng ký tự Katakana theo yêu cầu
        labels = ["ア", "イ", "ウ", "エ"]

        for idx, img_bytes in enumerate(images_data):
            try:
                img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                img = img.resize((size, size), Image.Resampling.LANCZOS)
                canvas.paste(img, positions[idx])
                
                # Vẽ hình vuông nền đen nhỏ đệm số ở góc mỗi ảnh (kiểu JLPT)
                x, y = positions[idx]
                draw.rectangle([x + 10, y + 10, x + 60, y + 60], fill="white", outline="black", width=3)
                draw.text((x + 20, y + 12), labels[idx], fill="black", font=font)
            except Exception as e:
                logger.error(f"Error pasting image {idx}: {e}")

        # Vẽ vạch chia khung (Grid lines) màu xám
        mid = size + (margin // 2)
        draw.line([(mid, 0), (mid, canvas_size[1])], fill=(200, 200, 200), width=5)
        draw.line([(0, mid), (canvas_size[0], mid)], fill=(200, 200, 200), width=5)

        output = io.BytesIO()
        canvas.save(output, format='PNG')
        return output.getvalue()

    def _get_fallback_image(self) -> bytes:
        # Ảnh xám mặc định khi lỗi sinh ảnh
        img = Image.new("RGB", (512, 512), (240, 240, 240))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    async def _upload_to_cloud(self, image_bytes: bytes, filename: str) -> str:
        try:
            result = await upload_image_bytes(image_bytes, filename)
            return result.get("secure_url", "")
        except Exception as e:
            logger.error(f"Upload failed: {e}")
            return ""