import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import sqlalchemy

from app.db.base import Base


class AIFeedback(Base):
    __tablename__ = "ai_feedbacks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    content_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    rating_score = Column(Integer, nullable=False)
    
    # We use JSON since it's compatible with both Postgres and Sqlite (fallback). 
    # But usually teams here use JSON or Dialect specific things. 
    # sqlalchemy.JSON is safe.
    feedback_tags = Column(sqlalchemy.JSON, nullable=True, default=list)
    comment_text = Column(Text, nullable=True)
    ai_version = Column(String(100), nullable=True)
    metadata_json = Column(sqlalchemy.JSON, nullable=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User")
