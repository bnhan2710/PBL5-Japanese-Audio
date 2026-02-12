from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from datetime import datetime
import secrets

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user")  # Roles: "admin", "user", "guest"
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    is_superuser = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    reset_token = Column(String, unique=True, nullable=True)
    locked_until = Column(DateTime, nullable=True)
    verification_token = Column(String, unique=True, nullable=True, index=True)

    def generate_reset_token(self):
        """Generate a secure reset token."""
        self.reset_token = secrets.token_urlsafe(32)

    def clear_reset_token(self):
        """Clear password reset token after use."""
        self.reset_token = None

    def generate_verification_token(self):
        """Generate a secure email verification token."""
        self.verification_token = secrets.token_urlsafe(32)

    def clear_verification_token(self):
        """Clear verification token after email is verified."""
        self.verification_token = None
        self.email_verified = True

    def is_locked(self) -> bool:
        """Check if account is currently locked."""
        if self.locked_until is None:
            return False
        return datetime.utcnow() < self.locked_until
