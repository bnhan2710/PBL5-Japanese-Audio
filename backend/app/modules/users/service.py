from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.users.repository import UserRepository
from app.modules.users.models import User
from app.core.security import get_password_hash
from app.shared.exceptions import (
    InvalidResetTokenException,
    UserNotFoundException,
    UserAlreadyExistsException
)
import secrets
import string
from math import ceil
from datetime import datetime, timedelta
from typing import Dict, Any, List
from app.shared.email import (
    send_verification_email,
    send_update_notification,
    send_password_reset_by_admin
)
from app.shared.webhook import trigger_n8n_webhook
from app.shared.utils import setup_logger
from app.modules.users.schemas import (
    UserCreateByAdmin,
    UserUpdate,
    UserListResponse,
    UserResponse,
    AdminResetPasswordResponse
)

logger = setup_logger(__name__)

def generate_random_password(length: int = 12) -> str:
    """Generate a secure random password."""
    characters = string.ascii_letters + string.digits + string.punctuation
    return ''.join(secrets.choice(characters) for _ in range(length))


class UserService:
    """Service layer for user business logic."""

    def __init__(self, db: AsyncSession):
        self.repository = UserRepository(db)
        self.db = db

    async def list_users(
        self,
        filters: Dict[str, Any],
        page: int = 1,
        page_size: int = 10
    ) -> UserListResponse:
        """
        List users with filters and pagination.
        
        Args:
            filters: Filter criteria (email, username, role, is_active)
            page: Page number (1-indexed)
            page_size: Number of users per page
        
        Returns:
            UserListResponse with paginated users
        """
        skip = (page - 1) * page_size
        
        users = await self.repository.get_all_with_filters(filters, skip, page_size)
        total = await self.repository.count_all(filters)
        total_pages = ceil(total / page_size) if total > 0 else 0

        return UserListResponse(
            users=[UserResponse.model_validate(user) for user in users],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )

    async def get_user_by_id(self, user_id: int) -> User:
        """Get user by ID."""
        user = await self.repository.get_by_id(user_id)
        if not user:
            raise UserNotFoundException(f"User with ID {user_id} not found")
        return user

    async def create_user_by_admin(
        self,
        user_data: UserCreateByAdmin,
        base_url: str = "http://localhost:3000"
    ) -> User:
        """
        Create a new user as admin and send verification email.
        
        Args:
            user_data: User creation data
            base_url: Frontend base URL for verification link
        
        Returns:
            Created User object
        """
        # Check if email already exists
        existing_user = await self.repository.get_by_email(user_data.email)
        if existing_user:
            raise UserAlreadyExistsException("Email already registered")

        # Check if username already exists
        existing_user = await self.repository.get_by_username(user_data.username)
        if existing_user:
            raise UserAlreadyExistsException("Username already taken")

        # Generate password if not provided
        password = user_data.password if user_data.password else generate_random_password()

        # Create new user
        user = User(
            email=user_data.email,
            username=user_data.username,
            hashed_password=get_password_hash(password),
            role=user_data.role,
            email_verified=False,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            avatar_url=user_data.avatar_url
        )

        # Generate verification token
        user.generate_verification_token()

        # Save user
        user = await self.repository.create(user)

        # Send verification email
        try:
            send_verification_email(user, user.verification_token, base_url)
            logger.info(f"Verification email sent to {user.email}")
        except Exception as e:
            logger.error(f"Failed to send verification email: {str(e)}")

        # Trigger n8n automation
        await trigger_n8n_webhook("user.created", {
            "user_id": user.id,
            "email": user.email,
            "username": user.username,
            "role": user.role,
            "created_by": "admin"
        })

        return user

    async def update_user(
        self,
        user_id: int,
        update_data: UserUpdate
    ) -> User:
        """
        Update user information and send notification email.
        
        Args:
            user_id: User ID to update
            update_data: Update data
        
        Returns:
            Updated User object
        """
        user = await self.get_user_by_id(user_id)

        # Track changes for email notification
        changes = {}

        # Update fields
        if update_data.email and update_data.email != user.email:
            # Check if new email already exists
            existing = await self.repository.get_by_email(update_data.email)
            if existing and existing.id != user_id:
                raise UserAlreadyExistsException("Email already in use")
            changes["email"] = update_data.email
            user.email = update_data.email
            user.email_verified = False  # Require re-verification

        if update_data.username and update_data.username != user.username:
            # Check if new username already exists
            existing = await self.repository.get_by_username(update_data.username)
            if existing and existing.id != user_id:
                raise UserAlreadyExistsException("Username already taken")
            changes["username"] = update_data.username
            user.username = update_data.username

        if update_data.role and update_data.role != user.role:
            changes["role"] = update_data.role
            user.role = update_data.role

        if update_data.is_active is not None and update_data.is_active != user.is_active:
            changes["is_active"] = "Active" if update_data.is_active else "Inactive"
            user.is_active = update_data.is_active

        if update_data.first_name and update_data.first_name != user.first_name:
            changes["first_name"] = update_data.first_name
            user.first_name = update_data.first_name

        if update_data.last_name and update_data.last_name != user.last_name:
            changes["last_name"] = update_data.last_name
            user.last_name = update_data.last_name

        if update_data.avatar_url and update_data.avatar_url != user.avatar_url:
            changes["avatar_url"] = update_data.avatar_url
            user.avatar_url = update_data.avatar_url

        # Save changes
        user = await self.repository.update(user)

        # Send notification email if there are changes
        if changes:
            try:
                send_update_notification(user, changes)
                logger.info(f"Update notification sent to {user.email}")
            except Exception as e:
                logger.error(f"Failed to send update notification: {str(e)}")

        # Trigger n8n automation
        await trigger_n8n_webhook("user.updated", {
            "user_id": user.id,
            "email": user.email,
            "changes": changes
        })

        return user

    async def lock_user(self, user_id: int, duration_hours: int) -> User:
        """
        Lock user account temporarily.
        
        Args:
            user_id: User ID to lock
            duration_hours: Lock duration in hours
        
        Returns:
            Updated User object
        """
        user = await self.get_user_by_id(user_id)
        
        user.locked_until = datetime.utcnow() + timedelta(hours=duration_hours)
        user = await self.repository.update(user)
        
        logger.info(f"User {user.email} locked until {user.locked_until}")

        # Trigger n8n automation
        await trigger_n8n_webhook("user.locked", {
            "user_id": user.id,
            "email": user.email,
            "locked_until": user.locked_until.isoformat() if user.locked_until else None,
            "duration_hours": duration_hours
        })

        return user

    async def unlock_user(self, user_id: int) -> User:
        """
        Unlock user account.
        
        Args:
            user_id: User ID to unlock
        
        Returns:
            Updated User object
        """
        user = await self.get_user_by_id(user_id)
        
        user.locked_until = None
        user = await self.repository.update(user)
        
        logger.info(f"User {user.email} unlocked")

        # Trigger n8n automation
        await trigger_n8n_webhook("user.unlocked", {
            "user_id": user.id,
            "email": user.email
        })

        return user

    async def admin_reset_password(self, user_id: int) -> AdminResetPasswordResponse:
        """
        Reset user password as admin and send temporary password.
        
        Args:
            user_id: User ID to reset password
        
        Returns:
            AdminResetPasswordResponse with temporary password
        """
        user = await self.get_user_by_id(user_id)
        
        # Generate temporary password
        temp_password = generate_random_password()
        
        # Update password
        user.hashed_password = get_password_hash(temp_password)
        user = await self.repository.update(user)
        
        # Send email with temporary password
        try:
            send_password_reset_by_admin(user, temp_password)
            logger.info(f"Password reset email sent to {user.email}")
        except Exception as e:
            logger.error(f"Failed to send password reset email: {str(e)}")
        
        # Trigger n8n automation
        await trigger_n8n_webhook("user.password_reset", {
            "user_id": user.id,
            "email": user.email,
            "reset_by": "admin"
        })
        
        return AdminResetPasswordResponse(
            message="Password has been reset successfully. Temporary password sent to user's email.",
            temporary_password=temp_password
        )


