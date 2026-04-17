import uuid
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class UserResult(Base):
    __tablename__ = "user_results"

    result_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.exam_id", ondelete="SET NULL"), nullable=True)
    contest_id = Column(UUID(as_uuid=True), ForeignKey("contests.contest_id", ondelete="SET NULL"), nullable=True)
    score = Column(Float, nullable=True)
    total_questions = Column(Integer, nullable=True)
    correct_answers = Column(Integer, nullable=True)
    user_answers = Column(JSONB, nullable=True)
    completed_at = Column(DateTime, server_default=func.now())

    # Relationships
    exam = relationship("Exam", back_populates="results")
    competency_analysis = relationship("CompetencyAnalysis", back_populates="result", uselist=False, cascade="all, delete-orphan")

class CompetencyAnalysis(Base):
    __tablename__ = "competency_analysis"

    analysis_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    result_id = Column(UUID(as_uuid=True), ForeignKey("user_results.result_id", ondelete="CASCADE"), nullable=False, unique=True)
    overview = Column(Text, nullable=True) # Text overview
    strengths = Column(JSONB, nullable=True) # Array of strings
    weaknesses_analysis = Column(Text, nullable=True) # Deep analysis
    actionable_advice = Column(JSONB, nullable=True) # Array of strings
    skill_metrics = Column(JSONB, nullable=True) # Dict mapping skill to percentage
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    result = relationship("UserResult", back_populates="competency_analysis")
