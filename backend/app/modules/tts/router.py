import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from app.db.session import get_db
from app.core.security import get_current_user
from app.modules.users.models import User
from app.shared.upload import upload_audio_bytes, upload_audio
from app.modules.audio.models import Audio
from app.modules.tts.schemas import TTSGenerateRequest, TTSGenerateResponse
from app.core.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tts", tags=["tts"])

# Temporary workaround: if we don't have TTS_SERVICE_URL in settings, default to localhost:7861
# Ideally, we should add TTS_SERVICE_URL to settings.
TTS_SERVICE_URL = "http://127.0.0.1:7861"


@router.post("/generate-script", response_model=TTSGenerateResponse)
async def generate_script(
    request: TTSGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        # Transform request to match TTS Service expectations
        tts_payload = {
            "dialogues": [line.model_dump() for line in request.dialogues],
            "speaker_configs": {
                name: {
                    "model_name": cfg.model_name,
                    "style": cfg.style,
                    "pitch_scale": cfg.pitch_scale,
                    "sdp_ratio": cfg.sdp_ratio,
                    "reference_audio_path": cfg.reference_audio_url,  # Forward URL as path
                }
                for name, cfg in request.speaker_configs.items()
            },
            "dialogue_pause": request.dialogue_pause,
            "narrator_pause": request.narrator_pause,
        }

        # Step 1: Forward request to TTS Microservice
        async with httpx.AsyncClient(timeout=60000.0) as client:
            response = await client.post(f"{TTS_SERVICE_URL}/tts/multi-speaker", json=tts_payload)

        if response.status_code != 200:
            logger.error(f"TTS Service Error: {response.text}")
            raise HTTPException(
                status_code=500, detail="Failed to generate audio from TTS Service."
            )

        audio_bytes = response.content

        # Restart TTS container sau mỗi lần gen để giải phóng bộ nhớ tích lũy (model cache, torch tensors)
        # Background task — không block response, thất bại cũng không ảnh hưởng kết quả
        import asyncio, subprocess

        async def _restart_tts():
            try:
                await asyncio.sleep(1)  # đợi response trả về trước
                subprocess.run(
                    ["docker", "restart", "style-bert-vits2"], capture_output=True, timeout=30
                )
                logger.info("TTS container restarted to free memory.")
            except Exception as e:
                logger.warning(f"TTS auto-restart skipped: {e}")

        asyncio.create_task(_restart_tts())

        # Step 2: Upload to Cloudinary
        # We need a unique public_id
        content_hash = uuid.uuid4().hex
        filename = f"{request.title or 'multi_speaker'}.wav"

        cloudinary_res = await upload_audio_bytes(audio_bytes, filename, public_id=content_hash)

        # Step 3: Save to Database
        audio = Audio(
            file_name=filename,
            content_hash=content_hash,
            file_url=cloudinary_res["secure_url"],
            duration=int(cloudinary_res["duration"]) if cloudinary_res.get("duration") else None,
            ai_status="completed",
            ai_model="Style-Bert-VITS2",
            raw_transcript=" ".join([line.text for line in request.dialogues]),
        )
        db.add(audio)
        await db.commit()
        await db.refresh(audio)

        return TTSGenerateResponse(
            audio_id=str(audio.audio_id), file_name=audio.file_name, file_url=audio.file_url
        )

    except httpx.RequestError as exc:
        logger.error(f"An error occurred while requesting TTS Service: {exc}")
        raise HTTPException(
            status_code=503,
            detail="TTS Service is unavailable. Ensure sbvits2 container is running.",
        )
    except Exception as exc:
        logger.error(f"Failed to generate TTS: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/upload-sample", response_model=dict)
async def upload_sample_audio(
    file: UploadFile = File(...), current_user: User = Depends(get_current_user)
):
    """Upload a sample audio file for voice cloning (style transfer)."""
    try:
        upload_result = await upload_audio(file, folder="tts-samples")
        return {"file_url": upload_result["secure_url"]}
    except Exception as e:
        logger.error(f"Failed to upload sample: {e}")
        raise HTTPException(status_code=500, detail=str(e))
