import io
import json
import logging
import asyncio
import base64
import httpx
from pathlib import Path
from typing import List, Optional
from PIL import Image, ImageDraw, ImageFont
from google import genai

from app.core.config import get_settings
from app.modules.ai_image.schemas import (
    AIImageTaskRequest, ImageOptionGenerate, ImageResultData
)
from app.shared.upload import upload_image_bytes

settings = get_settings()
logger = logging.getLogger(__name__)

class AIImageService:
    def __init__(self):
        api_key = settings.GOOGLE_API_KEY
        if not api_key:
            raise ValueError("GOOGLE_API_KEY is required for AIImageService.")
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

        # Step 1: Gemini planning
        visual_plan = await self._plan_visuals(req)
        
        # Step 2: Sinh 4 ảnh song song với cơ chế Safe Call
        logger.info(f"Generating 4 images for Question: {req.question_id}")
        
        async def safe_call(description: str):
            try:
                return await self._call_image_api(description)
            except Exception as e:
                logger.error(f"Single image gen failed: {e}")
                return self._get_fallback_image()

        image_tasks = [safe_call(opt.description) for opt in visual_plan]
        images_data = await asyncio.gather(*image_tasks)
        
        # Step 3: Ghép ảnh (Chạy trong thread pool vì xử lý Pillow nặng CPU)
        final_image_bytes = await loop.run_in_executor(
            None, self._composite_images, images_data
        )
        
        # Step 4: Upload
        filename = f"image_{req.question_id}.png"
        image_url = await self._upload_to_cloud(final_image_bytes, filename)

        return ImageResultData(
            question_id=req.question_id,
            image_url=image_url,
            prompts_used=[opt.description for opt in visual_plan]
        )

    async def _plan_visuals(self, req: AIImageTaskRequest) -> List[ImageOptionGenerate]:
        prompt = f"""
You are an expert JLPT {req.jlpt_level} Exam Illustrator. 
Task: Analyze the provided Japanese listening script and create 4 distinct visual descriptions (A, B, C, D).

Context:
- Script: {req.script_text}
- Question: {req.question_text}

Guidelines for Options:
1. One of the 4 options MUST be the Correct Answer (matching the final decision in the script).
2. The other 3 options MUST be Distractors (based on discarded choices or common misunderstandings in the script).
3. RANDOMIZE the position of the Correct Answer. It should not always be the first option.
4. Each option should be distinct and clearly related to the JLPT {req.jlpt_level} context.

Visual Style for Descriptions:
- All 4 images must share the same style: Minimalist black and white line art, Japanese Manga/ClipArt style.
- White background, no shading, clean thick lines.
- NO text, NO speech bubbles, NO characters' names inside the images.

Output format:
Return ONLY a valid JSON array of 4 objects. No preamble or postscript.
[
  {{"label": "1", "description": "detailed English prompt for DALL-E..."}},
  {{"label": "2", "description": "..."}},
  {{"label": "3", "description": "..."}},
  {{"label": "4", "description": "..."}}
]
"""
        response = self._client.models.generate_content(
            model=self._model_name,
            contents=[prompt]
        )
        data = json.loads(self._strip_json_markdown(response.text))
        return [ImageOptionGenerate(**item) for item in data]

    async def _call_image_api(self, prompt: str) -> bytes:
        url = "https://api.openai.com/v1/images/generations"
        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "dall-e-3",
            "prompt": f"{prompt} --ar 1:1 --no text, words",
            "n": 1,
            "size": "1024x1024",
            "response_format": "b64_json"
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return base64.b64decode(data["data"][0]["b64_json"])

    def _composite_images(self, images_data: List[bytes]) -> bytes:
        size = 512
        margin = 15
        canvas_size = (size * 2 + margin, size * 2 + margin)
        canvas = Image.new("RGB", canvas_size, (255, 255, 255))
        draw = ImageDraw.Draw(canvas)
        
        try:
            # Lưu ý: Bạn cần đảm bảo file font tồn tại hoặc dùng default
            font = ImageFont.load_default() 
        except:
            font = None

        positions = [(0, 0), (size + margin, 0), (0, size + margin), (size + margin, size + margin)]
        labels = ["1", "2", "3", "4"]

        for idx, img_bytes in enumerate(images_data):
            try:
                img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                img = img.resize((size, size), Image.Resampling.LANCZOS)
                canvas.paste(img, positions[idx])
                
                # Vẽ nhãn số
                draw.ellipse([positions[idx][0]+5, positions[idx][1]+5, positions[idx][0]+45, positions[idx][1]+45], fill="white", outline="black")
                draw.text((positions[idx][0]+20, positions[idx][1]+10), labels[idx], fill="black", font=font)
            except Exception as e:
                logger.error(f"Error pasting image {idx}: {e}")

        # Vẽ vạch ngăn cách
        mid = size + margin // 2
        draw.line([(mid, 0), (mid, canvas_size[1])], fill=(200, 200, 200), width=3)
        draw.line([(0, mid), (canvas_size[0], mid)], fill=(200, 200, 200), width=3)

        output = io.BytesIO()
        canvas.save(output, format='PNG')
        return output.getvalue()

    def _get_fallback_image(self) -> bytes:
        img = Image.new("RGB", (512, 512), (240, 240, 240))
        draw = ImageDraw.Draw(img)
        draw.text((200, 250), "Image N/A", fill=(150, 150, 150))
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    async def _upload_to_cloud(self, image_bytes: bytes, filename: str) -> str:
        try:
            result = await upload_image_bytes(image_bytes, filename)
            return result.get("secure_url", "")
        except Exception as e:
            logger.error(f"Cloudinary upload failed: {e}")
            return ""