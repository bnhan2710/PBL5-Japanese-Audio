from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import EmailStr

from app.db.session import get_db
from app.modules.users.models import User
from app.modules.auth.schemas import Token, UserCreate, LoginRequest
from app.modules.users.schemas import UserResponse
from app.modules.auth.service import AuthService
from app.core.security import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

def get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    """Dependency to get auth service instance."""
    return AuthService(db)

@router.post("/register", response_model=UserResponse)
async def register(
    user_data: UserCreate,
    service: AuthService = Depends(get_auth_service)
):
    """
    Register a new user account.
    """
    return await service.register_user(user_data)

@router.post("/login", response_model=Token)
async def login(
    login_data: LoginRequest,
    service: AuthService = Depends(get_auth_service)
):
    """
    Login and receive JWT access token.
    """
    return await service.authenticate_user(login_data)

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user information.
    """
    return current_user

@router.post("/request-password-reset")
async def request_password_reset(
    email: EmailStr,
    service: AuthService = Depends(get_auth_service)
):
    """
    Request password reset.
    """
    return await service.request_password_reset(email)

@router.post("/reset-password")
async def reset_password(
    token: str,
    new_password: str,
    service: AuthService = Depends(get_auth_service)
):
    """
    Reset password using verification code.
    """
    return await service.reset_password(token, new_password)
