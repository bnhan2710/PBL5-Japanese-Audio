from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.modules.users.models import User


class UserRepository:
    """Repository for User database operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: int) -> Optional[User]:
        """Get user by ID."""
        result = await self.db.execute(select(User).filter(User.id == user_id))
        return result.scalar_one_or_none()

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

    async def get_by_verification_token(self, token: str) -> Optional[User]:
        """Get user by verification token."""
        result = await self.db.execute(select(User).filter(User.verification_token == token))
        return result.scalar_one_or_none()

    async def get_all_with_filters(
        self, filters: Dict[str, Any], skip: int = 0, limit: int = 10
    ) -> List[User]:
        """
        Get all users with optional filters and pagination.

        Args:
            filters: Dictionary of filter criteria
                - email: str (LIKE search)
                - username: str (LIKE search)
                - role: str (exact match)
                - is_active: bool (exact match)
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of User objects
        """
        query = select(User)

        # Apply filters
        if filters.get("email"):
            query = query.filter(User.email.ilike(f"%{filters['email']}%"))

        if filters.get("username"):
            query = query.filter(User.username.ilike(f"%{filters['username']}%"))

        if filters.get("role"):
            query = query.filter(User.role == filters["role"])

        if filters.get("exclude_guest"):
            query = query.filter(User.role != "guest")

        if filters.get("is_active") is not None:
            query = query.filter(User.is_active == filters["is_active"])

        # Apply pagination
        query = query.offset(skip).limit(limit).order_by(User.created_at.desc())

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_all(self, filters: Dict[str, Any]) -> int:
        """
        Count total users matching filters.

        Args:
            filters: Same filter criteria as get_all_with_filters

        Returns:
            Total count of matching users
        """
        query = select(func.count(User.id))

        # Apply same filters as get_all_with_filters
        if filters.get("email"):
            query = query.filter(User.email.ilike(f"%{filters['email']}%"))

        if filters.get("username"):
            query = query.filter(User.username.ilike(f"%{filters['username']}%"))

        if filters.get("role"):
            query = query.filter(User.role == filters["role"])

        if filters.get("exclude_guest"):
            query = query.filter(User.role != "guest")

        if filters.get("is_active") is not None:
            query = query.filter(User.is_active == filters["is_active"])

        result = await self.db.execute(query)
        return result.scalar_one()

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
