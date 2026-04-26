from __future__ import annotations

import base64
import io
import logging
import json
from datetime import datetime
from typing import List
from uuid import uuid4

from fastapi import HTTPException
import httpx

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
        self.sampler = self.settings.AI_PHOTO_SAMPLER
        self.seed = self.settings.AI_PHOTO_SEED
        self.batch_size = self.settings.AI_PHOTO_BATCH_SIZE
        self.n_iter = self.settings.AI_PHOTO_N_ITER
        self.use_negative_prompt = self.settings.AI_PHOTO_USE_NEGATIVE_PROMPT
        self.output_dir = (BASE_DIR / self.settings.AI_PHOTO_OUTPUT_DIR).resolve()
        self.output_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Prompt optimization
    # ------------------------------------------------------------------

    def _clean_text(self, value: str | None) -> str:
        return value.strip() if value and value.strip() else ""

    def _format_lm_input(
        self,
        *,
        description: str,
        question_text: str | None,
        script: str | None,
        answers: list[str] | None,
        answer_focus: str | None = None,
    ) -> str:
        """Compose LM input from user-entered prompt only (no extra semantic context)."""
        user_prompt = self._clean_text(description)
        if not user_prompt:
            user_prompt = "No description provided."
        return f"Primary user prompt (must follow this exactly): {user_prompt}"

    def _extract_lm_bundle(self, data: dict) -> tuple[str, str]:
        """Extract prompt/negative_prompt from OpenAI-compatible response variants."""
        choices = data.get("choices") or []
        if not choices:
            return "", ""

        first = choices[0] or {}

        # Chat-completions style
        message = first.get("message") or {}
        message_content = message.get("content")
        if isinstance(message_content, str):
            content = message_content.strip()
            if content.startswith("{") and content.endswith("}"):
                try:
                    parsed = json.loads(content)
                    prompt = parsed.get("prompt")
                    negative = parsed.get("negative_prompt")
                    if isinstance(prompt, str) and prompt.strip():
                        return prompt.strip(), negative.strip() if isinstance(negative, str) else ""
                except Exception:
                    pass
            return content, ""
        if isinstance(message_content, list):
            text_parts: list[str] = []
            for item in message_content:
                if isinstance(item, dict) and isinstance(item.get("text"), str):
                    text_parts.append(item["text"])
            merged = " ".join(part.strip() for part in text_parts if part and part.strip())
            if merged:
                if merged.startswith("{") and merged.endswith("}"):
                    try:
                        parsed = json.loads(merged)
                        prompt = parsed.get("prompt")
                        negative = parsed.get("negative_prompt")
                        if isinstance(prompt, str) and prompt.strip():
                            return prompt.strip(), (
                                negative.strip() if isinstance(negative, str) else ""
                            )
                    except Exception:
                        pass
                return merged, ""

        # Legacy completions style
        legacy_text = first.get("text")
        if isinstance(legacy_text, str):
            return legacy_text.strip(), ""

        # Some LM Studio model adapters may place text here
        reasoning_text = message.get("reasoning_content")
        if isinstance(reasoning_text, str):
            return reasoning_text.strip(), ""

        return "", ""

    def _extract_reasoning_content(self, data: dict) -> str:
        choices = data.get("choices") or []
        if not choices:
            return ""
        first = choices[0] or {}
        message = first.get("message") or {}
        reasoning = message.get("reasoning_content")
        if isinstance(reasoning, str):
            return reasoning.strip()
        return ""

    def _build_fallback_prompt_bundle(self, for_action: bool) -> tuple[str, str]:
        """Fallback uses generic drawing-style constraints plus a simple safe scene."""
        fallback_prompt = (
            "simple jlpt worksheet illustration, monochrome black lineart on white background, "
            "clean outline, minimal scene, clear human figures"
        )
        if for_action:
            fallback_prompt += ", focus on one clear action"

        fallback_negative = (
            "color, gradient, shading, grayscale tones, rough sketch, noisy texture, text, watermark, "
            "logo, 3d, photorealistic, blur, distortion, bad anatomy"
        )
        return fallback_prompt, fallback_negative

    async def _build_english_prompt(self, lm_input: str, for_action: bool) -> tuple[str, str]:
        style_positive = self._clean_text(self.base_prompt) or (
            "strictly monochrome, black lines on pure white background, clean lineart, "
            "simple outline, high contrast, no shading, no grayscale"
        )
        style_negative = self._clean_text(self.negative_prompt) or (
            "color, gradient, shading, grayscale tones, rough sketch, noisy texture, text, watermark, "
            "logo, 3d, photorealistic, blur, distortion, bad anatomy"
        )

        system = (
            "You are a Stable Diffusion prompt writer for JLPT listening illustrations. "
            "Use the primary user prompt as the main content. "
            "Generate English prompt + negative_prompt in JSON. "
            'Output JSON only with exactly these keys: {"prompt":"...","negative_prompt":"..."}. '
            "Prompt must describe scene according to user request; keep composition clear and natural. "
            f"Always include these global style tags in prompt: {style_positive}. "
            f"Always include these global negative tags in negative_prompt: {style_negative}. "
            "No markdown, no explanation."
        )
        if for_action:
            system += " Focus on one key action if action mode is requested."

        payloads = [
            {
                "model": self.lm_model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": lm_input},
                ],
                "temperature": 0.35,
                "max_tokens": 360,
            },
            {
                "model": self.lm_model,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            system
                            + " Do not return empty response. Keep strict JLPT monochrome worksheet style."
                        ),
                    },
                    {"role": "user", "content": lm_input},
                ],
                "temperature": 0.2,
                "max_tokens": 260,
            },
        ]

        last_error_detail = ""
        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                for index, payload in enumerate(payloads):
                    try:
                        response = await client.post(self.lm_url, json=payload)
                        response.raise_for_status()
                    except httpx.HTTPStatusError as exc:
                        response_text = exc.response.text[:400] if exc.response is not None else ""
                        last_error_detail = (
                            f"HTTP {exc.response.status_code}: {response_text}"
                            if exc.response is not None
                            else str(exc)
                        )
                        logger.warning(
                            "LM Studio attempt %s failed: %s", index + 1, last_error_detail
                        )
                        continue

                    data = response.json()
                    prompt, negative_prompt = self._extract_lm_bundle(data)
                    prompt = prompt.strip().strip('"').strip("'")
                    negative_prompt = negative_prompt.strip().strip('"').strip("'")
                    if prompt:
                        final_prompt = prompt
                        final_negative = negative_prompt or ""
                        if style_positive and style_positive.lower() not in final_prompt.lower():
                            final_prompt = f"{style_positive}, {final_prompt}"
                        if style_negative and style_negative.lower() not in final_negative.lower():
                            final_negative = f"{style_negative}, {final_negative}".strip().strip(
                                ","
                            )
                        return final_prompt, final_negative

                    reasoning = self._extract_reasoning_content(data)
                    if reasoning:
                        logger.warning(
                            "LM Studio returned reasoning_content without prompt on attempt %s",
                            index + 1,
                        )
                        recover_payload = {
                            "model": self.lm_model,
                            "messages": [
                                {
                                    "role": "system",
                                    "content": (
                                        "Convert the provided analysis into final JSON with prompt and negative_prompt for Stable Diffusion. "
                                        'Return only {"prompt":"...","negative_prompt":"..."}.'
                                    ),
                                },
                                {"role": "user", "content": reasoning},
                            ],
                            "temperature": 0.1,
                            "max_tokens": 180,
                        }
                        try:
                            recover_response = await client.post(self.lm_url, json=recover_payload)
                            recover_response.raise_for_status()
                            recover_data = recover_response.json()
                            recovered_prompt, recovered_negative = self._extract_lm_bundle(
                                recover_data
                            )
                            recovered_prompt = recovered_prompt.strip().strip('"').strip("'")
                            recovered_negative = recovered_negative.strip().strip('"').strip("'")
                            if recovered_prompt:
                                final_prompt = recovered_prompt
                                final_negative = recovered_negative or ""
                                if (
                                    style_positive
                                    and style_positive.lower() not in final_prompt.lower()
                                ):
                                    final_prompt = f"{style_positive}, {final_prompt}"
                                if (
                                    style_negative
                                    and style_negative.lower() not in final_negative.lower()
                                ):
                                    final_negative = (
                                        f"{style_negative}, {final_negative}".strip().strip(",")
                                    )
                                return final_prompt, final_negative
                        except httpx.HTTPStatusError as exc:
                            response_text = (
                                exc.response.text[:400] if exc.response is not None else ""
                            )
                            last_error_detail = (
                                f"HTTP {exc.response.status_code}: {response_text}"
                                if exc.response is not None
                                else str(exc)
                            )
                            logger.warning(
                                "LM Studio recover attempt failed: %s", last_error_detail
                            )

                    logger.warning("LM Studio returned empty prompt on attempt %s", index + 1)
        except httpx.HTTPError as exc:
            logger.error("LM Studio request failed: %s", exc)
            raise HTTPException(
                status_code=500,
                detail="Không thể kết nối LM Studio (Gemma 4) để tạo prompt tiếng Anh.",
            ) from exc

        if last_error_detail:
            raise HTTPException(
                status_code=500,
                detail=f"LM Studio trả lỗi khi tạo prompt: {last_error_detail}",
            )

        logger.warning(
            "LM Studio returned empty prompt after retries. Using JLPT fallback prompt bundle."
        )
        return self._build_fallback_prompt_bundle(for_action)

    # ------------------------------------------------------------------
    # Draw Things generation
    # ------------------------------------------------------------------

    async def _generate_single_image(
        self, lm_prompt: str, negative_prompt: str | None = None
    ) -> Image.Image:
        """Send only Gemma-generated prompt so Draw Things uses its own saved preset/config."""
        final_prompt = lm_prompt.strip()
        if not final_prompt:
            raise HTTPException(status_code=500, detail="Prompt từ Gemma 4 đang rỗng.")

        logger.info("Draw Things final prompt: %s", final_prompt)

        # Intentionally pass only prompt to let Draw Things keep all runtime settings
        # (model/sampler/steps/cfg/size/negative prompt/seed) from its own UI preset.
        payload: dict = {"prompt": final_prompt}
        if negative_prompt and negative_prompt.strip():
            payload["negative_prompt"] = negative_prompt.strip()

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
        question_text: str | None,
        script: str | None,
        answers: list[str] | None,
    ) -> dict:
        if photo_type == PhotoType.context:
            lm_input = self._format_lm_input(
                description=description,
                question_text=question_text,
                script=script,
                answers=answers,
            )
            lm_prompt, lm_negative = await self._build_english_prompt(lm_input, for_action=False)
            image = await self._generate_single_image(lm_prompt, lm_negative)
            lm_info = f"prompt: {lm_prompt}\nnegative_prompt: {lm_negative}"

        else:
            if not answers or len(answers) < 4:
                raise HTTPException(
                    status_code=422,
                    detail="Action type requires exactly 4 answer choices.",
                )
            panels: List[Image.Image] = []
            prompts: List[str] = []
            for answer in answers[:4]:
                lm_input = self._format_lm_input(
                    description=description,
                    question_text=question_text,
                    script=script,
                    answers=answers[:4],
                    answer_focus=answer,
                )
                p, n = await self._build_english_prompt(lm_input, for_action=True)
                prompts.append(f"prompt: {p} || negative_prompt: {n}")
                panels.append(await self._generate_single_image(p, n))
            lm_info = "\n---\n".join(prompts)
            image = self._create_2x2_grid(panels)

        storage_path = self._save_image(image, photo_type)
        return {
            "b64_image": self._encode_image_to_data_url(image),
            "info": lm_info,
            "storage_path": storage_path,
        }
