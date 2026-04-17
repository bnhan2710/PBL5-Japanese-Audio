import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Contest(Base):
    __tablename__ = "contests"

    contest_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    min_jlpt_level = Column(String(10), nullable=False, default="N5")
    max_participants = Column(Integer, nullable=True)
    time_limit = Column(Integer, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.exam_id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    exam = relationship("Exam", back_populates="contests")
    participants = relationship(
        "ContestParticipant",
        back_populates="contest",
        cascade="all, delete-orphan",
    )


class ContestParticipant(Base):
    __tablename__ = "contest_participants"

    contest_id = Column(
        UUID(as_uuid=True),
        ForeignKey("contests.contest_id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    result_id = Column(UUID(as_uuid=True), ForeignKey("user_results.result_id", ondelete="SET NULL"), nullable=True)
    joined_at = Column(DateTime, server_default=func.now(), nullable=False)

    contest = relationship("Contest", back_populates="participants")
    result = relationship("UserResult", foreign_keys=[result_id])
    user = relationship("User", foreign_keys=[user_id])
