import re
import secrets
from datetime import datetime, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException
from jose import JWTError, jwt as jose_jwt
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import EmailStr

from app.core.config import get_settings
from app.modules.users.models import User
from app.modules.auth.schemas import (
    UserCreate,
    LoginRequest,
    ChangePasswordRequest,
    ResetPasswordRequest,
)
from app.shared.email import (
    send_password_reset_link_email,
    send_password_changed_notification_email,
)
from app.modules.users.repository import UserRepository
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
)
from app.shared.exceptions import (
    UserAlreadyExistsException,
    InvalidCredentialsException,
    InvalidResetTokenException,
)


GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


class AuthService:
    """Service layer for authentication business logic."""

    def __init__(self, db: AsyncSession):
        self.repository = UserRepository(db)
        self.db = db
        self.settings = get_settings()

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
            avatar_url=user_data.avatar_url,
        )

        return await self.repository.create(user)

    async def authenticate_user(self, login_data: LoginRequest) -> dict:
        """Authenticate user and return access token."""
        user = await self.repository.get_by_email(login_data.email)

        if not user or not verify_password(login_data.password, user.hashed_password):
            raise InvalidCredentialsException()

        if not user.is_active or user.is_locked():
            raise HTTPException(
                status_code=403,
                detail="Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên để biết thêm chi tiết.",
            )

        return self._build_token_pair(user)

    async def request_password_reset(self, email: EmailStr) -> dict:
        """Generate password reset token for user."""
        user = await self.repository.get_by_email(email)
        if user:
            user.generate_reset_token()
            await self.repository.update(user)

            # Send email
            frontend_url = self.settings.FRONTEND_URL.rstrip("/")
            reset_link = f"{frontend_url}/reset-password?token={user.reset_token}"
            send_password_reset_link_email(user, reset_link)

        # Always return same message for security
        return {
            "message": "If an account exists with this email, a password reset link will be sent"
        }

    async def reset_password(self, data: ResetPasswordRequest) -> dict:
        """Reset user password using reset token."""
        user = await self.repository.get_by_reset_token(data.token)
        if not user:
            raise InvalidResetTokenException(detail="Liên kết đã hết hạn hoặc không hợp lệ")

        # Validate token expiration
        token_parts = data.token.split(":")
        if len(token_parts) == 2:
            try:
                expires_at = int(token_parts[1])
                if int(datetime.utcnow().timestamp()) > expires_at:
                    user.clear_reset_token()
                    await self.repository.update(user)
                    raise InvalidResetTokenException(detail="Liên kết đã hết hạn hoặc không hợp lệ")
            except ValueError:
                pass

        user.hashed_password = get_password_hash(data.new_password)
        user.clear_reset_token()
        await self.repository.update(user)

        return {"message": "Password has been reset successfully"}

    async def refresh_access_token(self, refresh_token: str) -> dict:
        """Validate refresh token and issue a new token pair."""
        try:
            payload = jose_jwt.decode(
                refresh_token,
                self.settings.SECRET_KEY,
                algorithms=[self.settings.ALGORITHM],
            )
            email: str = payload.get("sub")
            token_type: str = payload.get("type")
            if email is None or token_type != "refresh":
                raise InvalidCredentialsException(detail="Invalid refresh token")
        except JWTError:
            raise InvalidCredentialsException(detail="Invalid or expired refresh token")

        user = await self.repository.get_by_email(email)
        if not user:
            raise InvalidCredentialsException(detail="User not found")

        if not user.is_active or user.is_locked():
            raise HTTPException(
                status_code=403,
                detail="Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên để biết thêm chi tiết.",
            )

        return self._build_token_pair(user)

    async def change_password(self, user: User, password_data: ChangePasswordRequest) -> dict:
        """Change user password."""
        # Verify old password
        if not verify_password(password_data.old_password, user.hashed_password):
            raise InvalidCredentialsException(detail="Mật khẩu hiện tại không chính xác")

        # Update password
        user.hashed_password = get_password_hash(password_data.new_password)
        await self.repository.update(user)

        # Send notification
        send_password_changed_notification_email(user)

        return {"message": "Password changed successfully"}

    def get_google_authorization_url(self, redirect_uri: str, next_path: str = "/dashboard") -> str:
        """Build Google OAuth authorization URL."""
        if not self.settings.GOOGLE_CLIENT_ID or not self.settings.GOOGLE_CLIENT_SECRET:
            raise HTTPException(status_code=503, detail="Google OAuth is not configured")

        resolved_redirect_uri = self.get_google_redirect_uri(redirect_uri)
        params = {
            "client_id": self.settings.GOOGLE_CLIENT_ID,
            "redirect_uri": resolved_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "include_granted_scopes": "true",
            "prompt": "select_account",
            "state": self._create_google_state_token(next_path),
        }
        return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    async def authenticate_google_callback(self, code: str, state: str, redirect_uri: str) -> str:
        """Exchange Google OAuth callback data and return frontend redirect URL."""
        if not self.settings.GOOGLE_CLIENT_ID or not self.settings.GOOGLE_CLIENT_SECRET:
            raise HTTPException(status_code=503, detail="Google OAuth is not configured")

        next_path = self._decode_google_state_token(state)
        resolved_redirect_uri = self.get_google_redirect_uri(redirect_uri)

        async with httpx.AsyncClient(timeout=15.0) as client:
            token_response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": self.settings.GOOGLE_CLIENT_ID,
                    "client_secret": self.settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": resolved_redirect_uri,
                    "grant_type": "authorization_code",
                },
                headers={"Accept": "application/json"},
            )

            if token_response.status_code >= 400:
                raise InvalidCredentialsException(detail="Google token exchange failed")

            token_payload = token_response.json()
            access_token = token_payload.get("access_token")
            if not access_token:
                raise InvalidCredentialsException(detail="Google access token is missing")

            profile_response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )

            if profile_response.status_code >= 400:
                raise InvalidCredentialsException(detail="Unable to read Google profile")

        google_profile = profile_response.json()
        user = await self._upsert_google_user(google_profile)
        tokens = self._build_token_pair(user)
        return self.build_frontend_oauth_redirect(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            next_path=next_path,
        )

    def get_google_redirect_uri(self, request_redirect_uri: str) -> str:
        """Resolve Google redirect URI from config first, then request."""
        return (self.settings.GOOGLE_REDIRECT_URI or request_redirect_uri).strip()

    def build_frontend_oauth_redirect(
        self,
        *,
        access_token: str | None = None,
        refresh_token: str | None = None,
        next_path: str = "/dashboard",
        error: str | None = None,
    ) -> str:
        """Build frontend callback URL with OAuth result in the URL fragment."""
        fragment_payload = {"next": self._normalize_next_path(next_path)}
        if error:
            fragment_payload["error"] = error
        else:
            fragment_payload["access_token"] = access_token or ""
            fragment_payload["refresh_token"] = refresh_token or ""
            fragment_payload["token_type"] = "bearer"

        base_url = self.settings.FRONTEND_URL.rstrip("/")
        return f"{base_url}/auth/google/callback#{urlencode(fragment_payload)}"

    def _build_token_pair(self, user: User) -> dict:
        access_token = create_access_token(data={"sub": user.email})
        refresh_token = create_refresh_token(data={"sub": user.email})
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }

    def _create_google_state_token(self, next_path: str) -> str:
        payload = {
            "type": "google_oauth_state",
            "next": self._normalize_next_path(next_path),
            "nonce": secrets.token_urlsafe(12),
            "exp": datetime.utcnow() + timedelta(minutes=10),
        }
        return jose_jwt.encode(payload, self.settings.SECRET_KEY, algorithm=self.settings.ALGORITHM)

    def _decode_google_state_token(self, state: str) -> str:
        try:
            payload = jose_jwt.decode(
                state,
                self.settings.SECRET_KEY,
                algorithms=[self.settings.ALGORITHM],
            )
        except JWTError as exc:
            raise InvalidCredentialsException(detail="Invalid Google OAuth state") from exc

        if payload.get("type") != "google_oauth_state":
            raise InvalidCredentialsException(detail="Invalid Google OAuth state")

        return self._normalize_next_path(payload.get("next"))

    async def _upsert_google_user(self, google_profile: dict) -> User:
        email = (google_profile.get("email") or "").strip().lower()
        if not email:
            raise InvalidCredentialsException(detail="Google account email is missing")

        if not google_profile.get("email_verified"):
            raise InvalidCredentialsException(detail="Google account email is not verified")

        user = await self.repository.get_by_email(email)
        if user is None:
            user = User(
                email=email,
                username=await self._generate_unique_username(google_profile),
                hashed_password=get_password_hash(secrets.token_urlsafe(32)),
                first_name=google_profile.get("given_name") or None,
                last_name=google_profile.get("family_name") or None,
                avatar_url=google_profile.get("picture") or None,
                email_verified=True,
            )
            return await self.repository.create(user)

        updated = False
        if not user.email_verified:
            user.email_verified = True
            updated = True
        if not user.first_name and google_profile.get("given_name"):
            user.first_name = google_profile["given_name"]
            updated = True
        if not user.last_name and google_profile.get("family_name"):
            user.last_name = google_profile["family_name"]
            updated = True
        if not user.avatar_url and google_profile.get("picture"):
            user.avatar_url = google_profile["picture"]
            updated = True

        if updated:
            user = await self.repository.update(user)
        return user

    async def _generate_unique_username(self, google_profile: dict) -> str:
        raw_candidate = (
            google_profile.get("preferred_username")
            or google_profile.get("given_name")
            or google_profile.get("name")
            or google_profile.get("email", "").split("@")[0]
            or "google-user"
        )
        base = self._slugify_username(raw_candidate)
        candidate = base
        suffix = 1

        while await self.repository.get_by_username(candidate):
            suffix += 1
            trimmed = base[: max(3, 50 - len(str(suffix)) - 1)].rstrip("-")
            candidate = f"{trimmed or 'google-user'}-{suffix}"

        return candidate

    @staticmethod
    def _slugify_username(value: str) -> str:
        normalized = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
        normalized = normalized[:50]
        if len(normalized) >= 3:
            return normalized
        return f"google-user-{secrets.token_hex(3)}"

    @staticmethod
    def _normalize_next_path(next_path: str | None) -> str:
        if not next_path or not next_path.startswith("/") or next_path.startswith("//"):
            return "/dashboard"
        return next_path
