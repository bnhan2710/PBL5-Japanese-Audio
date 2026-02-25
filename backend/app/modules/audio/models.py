import uuid
from sqlalchemy import Column, String, Integer, Float, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class Audio(Base):
    __tablename__ = "audios"

    audio_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    file_name = Column(String(255), nullable=True)
    file_url = Column(Text, nullable=False)
    duration = Column(Integer, nullable=True)  # seconds
    ai_status = Column(String(20), nullable=True, default="pending")  # pending | processing | completed | failed
    ai_model = Column(String(50), nullable=True)
    raw_transcript = Column(Text, nullable=True)

    # Relationships
    segments = relationship("TranscriptSegment", back_populates="audio", cascade="all, delete-orphan")
    exams = relationship("Exam", back_populates="audio")


class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"

    segment_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    audio_id = Column(UUID(as_uuid=True), ForeignKey("audios.audio_id", ondelete="CASCADE"), nullable=False)
    speaker_name = Column(String(50), nullable=True)   # e.g. "Speaker A"
    speaker_gender = Column(String(10), nullable=True)  # Male / Female
    start_time = Column(Float, nullable=True)
    end_time = Column(Float, nullable=True)
    content = Column(Text, nullable=False)
    sort_order = Column(Integer, nullable=True)

    # Relationships
    audio = relationship("Audio", back_populates="segments")
