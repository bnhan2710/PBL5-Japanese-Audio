from datetime import timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import EmailStr

from app.modules.users.models import User
from app.modules.auth.schemas import UserCreate, LoginRequest, ChangePasswordRequest
from app.modules.users.repository import UserRepository
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token
from app.shared.exceptions import (
    UserAlreadyExistsException,
    InvalidCredentialsException,
    InvalidResetTokenException
)

class AuthService:
    """Service layer for authentication business logic."""

    def __init__(self, db: AsyncSession):
        self.repository = UserRepository(db)
        self.db = db

    async def register_user(self, user_data: UserCreate) -> User:
        """Register a new user."""
        # Check if email already exists
        existing_user = await self.repository.get_by_email(user_data.email)
        if existing_user:
            raise UserAlreadyExistsException("Email already registered")

        # Check if username already exists
        existing_user = await self.repository.get_by_username(user_data.username)
        if existing_user:
            raise UserAlreadyExistsException("Username already taken")

        # Create new user
        user = User(
            email=user_data.email,
            username=user_data.username,
            hashed_password=get_password_hash(user_data.password),
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            avatar_url=user_data.avatar_url
        )

        return await self.repository.create(user)

    async def authenticate_user(self, login_data: LoginRequest) -> dict:
        """Authenticate user and return access token."""
        user = await self.repository.get_by_email(login_data.email)

        if not user or not verify_password(login_data.password, user.hashed_password):
            raise InvalidCredentialsException()

        access_token = create_access_token(data={"sub": user.email})
        refresh_token = create_refresh_token(data={"sub": user.email})
        return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

    async def request_password_reset(self, email: EmailStr) -> dict:
        """Generate password reset token for user."""
        user = await self.repository.get_by_email(email)
        if user:
            user.generate_reset_token()
            await self.repository.update(user)

        # Always return same message for security
        return {
            "message": "If an account exists with this email, a password reset link will be sent"
        }

    async def reset_password(self, token: str, new_password: str) -> dict:
        """Reset user password using reset token."""
        user = await self.repository.get_by_reset_token(token)
        if not user:
            raise InvalidResetTokenException()

        user.hashed_password = get_password_hash(new_password)
        user.clear_reset_token()
        await self.repository.update(user)

        return {"message": "Password has been reset successfully"}

    async def refresh_access_token(self, refresh_token: str) -> dict:
        """Validate refresh token and issue a new token pair."""
        from jose import JWTError, jwt as jose_jwt
        from app.core.config import get_settings
        settings = get_settings()

        try:
            payload = jose_jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            email: str = payload.get("sub")
            token_type: str = payload.get("type")
            if email is None or token_type != "refresh":
                raise InvalidCredentialsException(detail="Invalid refresh token")
        except JWTError:
            raise InvalidCredentialsException(detail="Invalid or expired refresh token")

        user = await self.repository.get_by_email(email)
        if not user:
            raise InvalidCredentialsException(detail="User not found")

        new_access_token = create_access_token(data={"sub": user.email})
        new_refresh_token = create_refresh_token(data={"sub": user.email})
        return {"access_token": new_access_token, "refresh_token": new_refresh_token, "token_type": "bearer"}

    async def change_password(self, user: User, password_data: ChangePasswordRequest) -> dict:
        """Change user password."""
        # Verify old password
        if not verify_password(password_data.old_password, user.hashed_password):
            raise InvalidCredentialsException(detail="Incorrect old password")

        # Update password
        user.hashed_password = get_password_hash(password_data.new_password)
        await self.repository.update(user)

        return {"message": "Password changed successfully"}
