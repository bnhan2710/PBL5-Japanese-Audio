import os
from pathlib import Path
from functools import lru_cache
from typing import Optional, List
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"

load_dotenv(ENV_FILE)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, case_sensitive=True, extra="ignore")

    APP_VERSION: str = "1.0.0"
    APP_NAME: str = "Japanese Aduio"
    APP_DESCRIPTION: str = "Japanese Aduio Template"
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = ""
    TEST_DATABASE_URL: Optional[str] = "sqlite+aiosqlite:///./test_app.db"
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    API_PREFIX: str = "/api"
    FRONTEND_URL: str = "http://localhost:5173"

    # Database settings
    DB_NAME: Optional[str] = None
    DB_USER: Optional[str] = None
    DB_PASSWORD: Optional[str] = None
    DB_HOST: Optional[str] = None
    DB_PORT: Optional[int] = None
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_ECHO: bool = False
    DB_SSL_MODE: Optional[str] = None

    # JWT Settings
    SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "secret-key-for-development")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Email Settings
    SMTP_EMAIL: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_NAME: str = "PBL5 Japanese Audio"
    SMTP_SERVER: str = "smtp.gmail.com"
    SMTP_PORT: int = 587

    # Cloudinary Settings
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None

    # Google AI Settings
    GOOGLE_API_KEY: Optional[str] = None

    # Google OAuth Settings
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: Optional[str] = None

    # n8n Automation Settings
    N8N_WEBHOOK_URL: Optional[str] = os.getenv("N8N_WEBHOOK_URL")

    # AI Photos generation
    LM_STUDIO_API_URL: str = "http://127.0.0.1:1234/v1/chat/completions"
    LM_STUDIO_MODEL: str = "gemma-4-e4b-it"
    DRAW_THINGS_API_URL: str = "http://127.0.0.1:7860/sdapi/v1/txt2img"
    AI_PHOTO_BASE_PROMPT: str = "(masterpiece, best quality, very aesthetic, line art, educational illustration:1.2), flat colors, simple lines, vector style, white background"
    AI_PHOTO_NEGATIVE_PROMPT: str = "(low quality, worst quality:1.4), (bad anatomy), (inaccurate limb:1.2), bad composition, inaccurate eyes, extra digit, fewer digits, (extra arms:1.2), photo, realistic, 3d render"
    AI_PHOTO_OUTPUT_DIR: str = "generated/ai-photos"
    AI_PHOTO_WIDTH: int = 512
    AI_PHOTO_HEIGHT: int = 512
    AI_PHOTO_STEPS: int = 25
    AI_PHOTO_CFG_SCALE: float = 7.0

@lru_cache()
def get_settings() -> Settings:
    return Settings()


BASE_DIR = Path(__file__).parent.parent

# Logging configuration
LOGGING_CONFIG = {
    "development": {
        "log_level": "DEBUG",
        "log_dir": BASE_DIR / "logs" / "dev",
    },
    "production": {
        "log_level": "INFO",
        "log_dir": BASE_DIR / "logs" / "prod",
    },
    "testing": {
        "log_level": "DEBUG",
        "log_dir": None,  # Console only
    },
}

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
# Ensure environment is one of the defined keys, default to development if not
if ENVIRONMENT not in LOGGING_CONFIG:
    ENVIRONMENT = "development"
CURRENT_LOGGING_CONFIG = LOGGING_CONFIG[ENVIRONMENT]
