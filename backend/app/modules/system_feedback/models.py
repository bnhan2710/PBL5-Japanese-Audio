import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import sqlalchemy

from app.db.base import Base


class SystemFeedback(Base):
    __tablename__ = "system_feedbacks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    rating_score = Column(Integer, nullable=False)
    feedback_tags = Column(sqlalchemy.JSON, nullable=True, default=list)
    comment_text = Column(Text, nullable=True)
    source_page = Column(String(255), nullable=True)
    metadata_json = Column(sqlalchemy.JSON, nullable=True)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User")
