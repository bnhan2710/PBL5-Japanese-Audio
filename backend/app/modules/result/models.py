import uuid
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class UserResult(Base):
    __tablename__ = "user_results"

    result_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.exam_id", ondelete="SET NULL"), nullable=True)
    score = Column(Float, nullable=True)
    total_questions = Column(Integer, nullable=True)
    correct_answers = Column(Integer, nullable=True)
    completed_at = Column(DateTime, server_default=func.now())

    # Relationships
    exam = relationship("Exam", back_populates="results")
