import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class AIExamCache(Base):
    __tablename__ = "ai_exam_cache"

    cache_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    cache_key = Column(String(128), nullable=False, unique=True, index=True)
    content_hash = Column(String(64), nullable=False, index=True)
    audio_id = Column(UUID(as_uuid=True), ForeignKey("audios.audio_id", ondelete="SET NULL"), nullable=True)
    source_filename = Column(String(255), nullable=True)
    jlpt_level = Column(String(10), nullable=False)
    mondai_config_json = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="pending")  # pending | processing | completed | failed
    job_id = Column(String(36), nullable=True)
    ai_model = Column(String(100), nullable=False)
    pipeline_version = Column(String(100), nullable=False)
    cloudinary_public_id = Column(String(255), nullable=True)
    cloudinary_format = Column(String(20), nullable=True)
    result_json = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    audio = relationship("Audio")
