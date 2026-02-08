from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.modules.users.models import User


class UserRepository:
    """Repository for User database operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        result = await self.db.execute(select(User).filter(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> Optional[User]:
        """Get user by username."""
        result = await self.db.execute(select(User).filter(User.username == username))
        return result.scalar_one_or_none()

    async def get_by_reset_token(self, token: str) -> Optional[User]:
        """Get user by reset token."""
        result = await self.db.execute(select(User).filter(User.reset_token == token))
        return result.scalar_one_or_none()

    async def create(self, user: User) -> User:
        """Create a new user."""
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update(self, user: User) -> User:
        """Update an existing user."""
        await self.db.commit()
        await self.db.refresh(user)
        return user
