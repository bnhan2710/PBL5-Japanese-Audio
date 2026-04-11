from __future__ import annotations

import base64
import io
import logging
from datetime import datetime
from typing import List
from uuid import uuid4

import httpx
from fastapi import HTTPException

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover
    Image = None
    ImageDraw = None
    ImageFont = None

from app.core.config import BASE_DIR, get_settings
from app.modules.ai_photos.schemas import PhotoType

logger = logging.getLogger(__name__)

# Labels for the 4 action answer panels
_ANSWER_LABELS = ["A", "B", "C", "D"]

# Circle badge radius and margin (in pixels relative to each panel)
_BADGE_RADIUS = 22
_BADGE_MARGIN = 14


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

    # ------------------------------------------------------------------
    # Prompt optimization
    # ------------------------------------------------------------------

    async def _build_context_prompt(
        self, description: str, script: str | None, answers: list[str] | None
    ) -> str:
        """Translate user inputs to an English SD prompt via LM Studio."""
        parts = []
        if script and script.strip():
            parts.append(f"Script: {script.strip()}")
        if answers:
            parts.append("Answer choices: " + ", ".join(a for a in answers if a))
        parts.append(f"Description: {description.strip()}")
        combined = "\n".join(parts)

        system = (
            "You are a Stable Diffusion prompt writer for JLPT listening exam illustrations. "
            "The model is Animagine XL v3.1. "
            "Translate the user's Vietnamese/Japanese input into a concise English Stable Diffusion prompt. "
            "Focus on the SCENE and SETTING. "
            "Return ONLY comma-separated English visual tags. No explanation."
        )
        return await self._call_lm_studio(system, combined, fallback=description)

    async def _build_action_prompt_for_answer(
        self, description: str, script: str | None, answer: str
    ) -> str:
        """Translate one answer into its own English SD prompt via LM Studio."""
        parts = []
        if script and script.strip():
            parts.append(f"Script: {script.strip()}")
        parts.append(f"Description: {description.strip()}")
        parts.append(f"Illustrate this specific action/answer: {answer.strip()}")
        combined = "\n".join(parts)

        system = (
            "You are a Stable Diffusion prompt writer for JLPT listening exam illustrations. "
            "The model is Animagine XL v3.1. "
            "Translate the user's Vietnamese/Japanese input into a concise English Stable Diffusion prompt. "
            "Illustrate ONLY the specific answer/action, not the whole scene. "
            "Return ONLY comma-separated English visual tags. No explanation."
        )
        return await self._call_lm_studio(system, combined, fallback=f"{description}, {answer}")

    async def _call_lm_studio(self, system: str, user_input: str, fallback: str) -> str:
        """Call LM Studio chat API. Falls back to raw input if LM Studio is unavailable."""
        payload = {
            "model": self.lm_model,
            "messages": [
                {"role": "system", "content": system},
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
            logger.warning("LM Studio unavailable, using raw input as prompt: %s", exc)
            return fallback

        content = (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
            .strip('"')
            .strip("'")
        )
        return content or fallback


    # ------------------------------------------------------------------
    # Draw Things generation
    # ------------------------------------------------------------------

    async def _generate_single_image(self, lm_prompt: str) -> Image.Image:
        """Prepend base_prompt then call Draw Things.

        Only prompt + negative_prompt are sent so that Draw Things uses
        all other settings (steps, sampler, CFG, size, etc.) from its own
        app configuration — specifically tuned for Animagine XL v3.1.
        """
        # Prepend style tags from config (base_prompt) in front of LM-generated prompt
        final_prompt = ", ".join(
            part for part in [self.base_prompt.strip(), lm_prompt.strip()] if part
        )
        logger.info("Draw Things final prompt: %s", final_prompt)

        payload: dict = {"prompt": final_prompt}
        if self.negative_prompt:
            payload["negative_prompt"] = self.negative_prompt

        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                response = await client.post(self.dt_url, json=payload)
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPError as exc:
            logger.error("Draw Things request failed: %s", exc)
            raise HTTPException(
                status_code=500,
                detail="Failed to connect to Draw Things. Make sure the API is running on port 7860.",
            ) from exc

        images = data.get("images", [])
        if not images:
            raise HTTPException(status_code=500, detail="Draw Things returned no images.")

        return self._decode_base64_image(images[0])

    # ------------------------------------------------------------------
    # Image utilities
    # ------------------------------------------------------------------

    def _decode_base64_image(self, raw_base64: str) -> Image.Image:
        clean = raw_base64.split(",")[-1] if "," in raw_base64 else raw_base64
        try:
            return Image.open(io.BytesIO(base64.b64decode(clean))).convert("RGB")
        except Exception as exc:
            raise HTTPException(
                status_code=500, detail="Invalid image data received from Draw Things."
            ) from exc

    def _encode_image_to_data_url(self, image: Image.Image) -> str:
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        return f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}"

    def _draw_label_badge(self, image: Image.Image, label: str) -> Image.Image:
        """Overlay a filled circle with the letter label at the top-left corner."""
        img = image.copy()
        draw = ImageDraw.Draw(img)
        r = _BADGE_RADIUS
        m = _BADGE_MARGIN
        # Filled black circle
        draw.ellipse([m, m, m + r * 2, m + r * 2], fill="black")
        # White letter centered in the circle
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size=r)
        except Exception:
            font = ImageFont.load_default()
        cx, cy = m + r, m + r
        bbox = draw.textbbox((0, 0), label, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text((cx - tw / 2, cy - th / 2), label, fill="white", font=font)
        return img

    def _create_2x2_grid(self, images: List[Image.Image]) -> Image.Image:
        """Stitch 4 labelled panels into a 2×2 grid."""
        w, h = images[0].size
        canvas = Image.new("RGB", (w * 2, h * 2), color="white")
        positions = [(0, 0), (w, 0), (0, h), (w, h)]
        for idx, (img, pos) in enumerate(zip(images, positions)):
            labelled = self._draw_label_badge(img, _ANSWER_LABELS[idx])
            canvas.paste(labelled, pos)
        return canvas

    def _save_image(self, image: Image.Image, photo_type: PhotoType) -> str:
        ts = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        filename = f"{photo_type.value}-{ts}-{uuid4().hex[:8]}.png"
        path = self.output_dir / filename
        image.save(path, format="PNG")
        return str(path)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def generate(
        self,
        photo_type: PhotoType,
        description: str,
        script: str | None,
        answers: list[str] | None,
    ) -> dict:
        if photo_type == PhotoType.context:
            lm_prompt = await self._build_context_prompt(description, script, answers)
            image = await self._generate_single_image(lm_prompt)

        else:
            if not answers or len(answers) < 4:
                raise HTTPException(
                    status_code=422,
                    detail="Action type requires exactly 4 answer choices.",
                )
            panels: List[Image.Image] = []
            prompts: List[str] = []
            for answer in answers[:4]:
                p = await self._build_action_prompt_for_answer(description, script, answer)
                prompts.append(p)
                panels.append(await self._generate_single_image(p))
            lm_prompt = " | ".join(prompts)
            image = self._create_2x2_grid(panels)

        storage_path = self._save_image(image, photo_type)
        return {
            "b64_image": self._encode_image_to_data_url(image),
            "info": lm_prompt,
            "storage_path": storage_path,
        }
