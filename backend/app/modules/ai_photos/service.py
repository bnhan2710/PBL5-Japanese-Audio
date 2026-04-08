from __future__ import annotations

import base64
import io
import logging
from datetime import datetime
from uuid import uuid4

import httpx
from fastapi import HTTPException

try:
    from PIL import Image
except ImportError:  # pragma: no cover - depends on local optional dependency state
    Image = None

from app.core.config import BASE_DIR, get_settings
from app.modules.ai_photos.schemas import PhotoType

logger = logging.getLogger(__name__)


class AIPhotoService:
    def __init__(self):
        if Image is None:
            raise HTTPException(
                status_code=500,
                detail="Pillow is not installed. Run `pip install -r backend/requirements.txt`.",
            )
        self.settings = get_settings()
        self.lm_url = self.settings.LM_STUDIO_API_URL
        self.lm_model = self.settings.LM_STUDIO_MODEL
        self.dt_url = self.settings.DRAW_THINGS_API_URL
        self.base_prompt = self.settings.AI_PHOTO_BASE_PROMPT
        self.negative_prompt = self.settings.AI_PHOTO_NEGATIVE_PROMPT
        self.width = self.settings.AI_PHOTO_WIDTH
        self.height = self.settings.AI_PHOTO_HEIGHT
        self.steps = self.settings.AI_PHOTO_STEPS
        self.cfg_scale = self.settings.AI_PHOTO_CFG_SCALE
        self.output_dir = (BASE_DIR / self.settings.AI_PHOTO_OUTPUT_DIR).resolve()
        self.output_dir.mkdir(parents=True, exist_ok=True)

    async def _optimize_prompt_with_lm_studio(self, user_input: str, photo_type: PhotoType) -> str:
        system_instructions = (
            "You write prompts for JLPT listening exam illustrations. "
            "Return only a compact English Stable Diffusion style prompt with comma-separated visual tags. "
            "Do not explain. Do not use bullet points. "
            "Keep the scene educational, clean, anime illustration style, and easy to understand."
        )
        if photo_type == PhotoType.action:
            system_instructions += (
                " The user context includes answer options. "
                "Emphasize four clearly distinct actions/items so the generator can produce four different panels."
            )
        else:
            system_instructions += " Focus on one contextual scene that helps the listener infer meaning."

        payload = {
            "model": self.lm_model,
            "messages": [
                {"role": "system", "content": system_instructions},
                {"role": "user", "content": user_input},
            ],
            "temperature": 0.4,
            "max_tokens": 180,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(self.lm_url, json=payload)
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPError as exc:
            logger.warning("LM Studio request failed: %s", exc)
            return user_input

        content = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
            .strip('"')
            .strip("'")
        )
        return content or user_input

    async def _generate_images(self, final_prompt: str, count: int) -> list[str]:
        payload = {
            "prompt": final_prompt,
            "negative_prompt": self.negative_prompt,
            "steps": self.steps,
            "cfg_scale": self.cfg_scale,
            "width": self.width,
            "height": self.height,
            "batch_size": count,
            "n_iter": 1,
        }

        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                response = await client.post(self.dt_url, json=payload)
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPError as exc:
            logger.error("Draw Things request failed: %s", exc)
            raise HTTPException(
                status_code=500,
                detail="Failed to connect to Draw Things. Make sure Draw Things API is running on port 7860.",
            ) from exc

        images = data.get("images", [])
        if not images:
            raise HTTPException(status_code=500, detail="Draw Things returned no images.")
        return images

    def _decode_base64_image(self, raw_base64: str) -> Image.Image:
        clean_base64 = raw_base64.split(",")[-1] if "," in raw_base64 else raw_base64
        try:
            image_bytes = base64.b64decode(clean_base64)
            return Image.open(io.BytesIO(image_bytes)).convert("RGB")
        except Exception as exc:  # noqa: BLE001
            logger.error("Invalid image data from Draw Things: %s", exc)
            raise HTTPException(status_code=500, detail="Invalid image data received from Draw Things.") from exc

    def _encode_image_to_data_url(self, image: Image.Image) -> str:
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{encoded}"

    def _create_2x2_grid(self, images: list[Image.Image]) -> Image.Image:
        if len(images) < 4:
            raise HTTPException(status_code=500, detail="Need 4 images to create an action grid.")

        width, height = images[0].size
        canvas = Image.new("RGB", (width * 2, height * 2), color="white")
        canvas.paste(images[0], (0, 0))
        canvas.paste(images[1], (width, 0))
        canvas.paste(images[2], (0, height))
        canvas.paste(images[3], (width, height))
        return canvas

    def _save_image(self, image: Image.Image, photo_type: PhotoType) -> str:
        timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        filename = f"{photo_type.value}-{timestamp}-{uuid4().hex[:8]}.png"
        path = self.output_dir / filename
        image.save(path, format="PNG")
        return str(path)

    async def generate(self, user_prompt: str, photo_type: PhotoType) -> dict:
        refined_prompt = await self._optimize_prompt_with_lm_studio(user_prompt, photo_type)
        final_prompt = ", ".join(
            part for part in [self.base_prompt.strip(), refined_prompt.strip()] if part
        )
        logger.info("AI photo prompt (%s): %s", photo_type.value, final_prompt)

        image_count = 4 if photo_type == PhotoType.action else 1
        raw_images = await self._generate_images(final_prompt, count=image_count)
        decoded_images = [self._decode_base64_image(item) for item in raw_images]

        if photo_type == PhotoType.action:
            while len(decoded_images) < 4:
                decoded_images.append(decoded_images[-1].copy())
            final_image = self._create_2x2_grid(decoded_images[:4])
        else:
            final_image = decoded_images[0]

        storage_path = self._save_image(final_image, photo_type)

        return {
            "b64_image": self._encode_image_to_data_url(final_image),
            "info": final_prompt,
            "storage_path": storage_path,
        }
