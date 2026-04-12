import uuid
from sqlalchemy import Column, String, Integer, Text, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class Question(Base):
    __tablename__ = "questions"

    question_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.exam_id", ondelete="CASCADE"), nullable=False)
    mondai_group = Column(String(50), nullable=True)    # e.g. "Mondai 1"
    question_number = Column(Integer, nullable=True)    # Question number within the group
    audio_clip_url = Column(Text, nullable=True)        # Optional clipped audio for this question
    question_text = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)             # Image-based question
    script_text = Column(Text, nullable=True)           # Dialogue script shown to learners
    explanation = Column(Text, nullable=True)           # Answer explanation
    raw_transcript = Column(Text, nullable=True)        # Original segment transcription
    hide_question_text = Column(Boolean, default=False, nullable=False)  # Hide prompt in test UI
    difficulty = Column(Integer, default=None, nullable=True) # IRT difficulty (1-5 stars)

    # Relationships
    exam = relationship("Exam", back_populates="questions")
    answers = relationship("Answer", back_populates="question", cascade="all, delete-orphan", order_by="Answer.order_index")


class Answer(Base):
    __tablename__ = "answers"

    answer_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.question_id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=True)       # Text answer option
    image_url = Column(Text, nullable=True)     # Image answer option
    is_correct = Column(Boolean, default=False)
    order_index = Column(Integer, nullable=True)  # 0=A, 1=B, 2=C, 3=D

    # Relationships
    question = relationship("Question", back_populates="answers")
