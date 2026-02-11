from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import EmailStr

from app.db.session import get_db
from app.modules.users.models import User
from app.modules.users.schemas import Token, UserCreate, UserResponse, LoginRequest
from app.modules.users.service import UserService
from app.core.security import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    """Dependency to get user service instance."""
    return UserService(db)


@router.post("/register", response_model=UserResponse)
async def register(
    user_data: UserCreate,
    service: UserService = Depends(get_user_service)
):
    """
    Register a new user account.
    
    - **email**: User email (required, must be valid email)
    - **password**: Password (required, minimum 8 characters)
    - **username**: Username
    """
    return await service.register_user(user_data)


@router.post("/login", response_model=Token)
async def login(
    login_data: LoginRequest,
    service: UserService = Depends(get_user_service)
):
    """
    Login and receive JWT access token.
    
    - **email**: Registered email
    - **password**: Password
    
    The received token is used for endpoints requiring authentication (click the Authorize button in the top right corner).
    """
    return await service.authenticate_user(login_data)


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user information.
    
    🔒 **Authentication required**: JWT token needed (click Authorize and enter token from /login)
    """
    return current_user


@router.post("/request-password-reset")
async def request_password_reset(
    email: EmailStr,
    service: UserService = Depends(get_user_service)
):
    """
    Request password reset.
    
    Sends password reset code to the registered email.
    """
    return await service.request_password_reset(email)


@router.post("/reset-password")
async def reset_password(
    token: str,
    new_password: str,
    service: UserService = Depends(get_user_service)
):
    """
    Reset password using verification code.
    
    - **token**: Reset code received from email
    - **new_password**: New password (minimum 8 characters)
    """
    return await service.reset_password(token, new_password)
