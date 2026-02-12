from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import EmailStr

from app.db.session import get_db
from app.modules.users.models import User
from app.modules.auth.schemas import Token, UserCreate, LoginRequest, ChangePasswordRequest
from app.modules.users.schemas import UserResponse, UserMeUpdate
from app.modules.auth.service import AuthService
from app.modules.users.service import UserService
from app.core.security import get_current_user
from app.shared.upload import upload_image

router = APIRouter(prefix="/auth", tags=["auth"])

def get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    """Dependency to get auth service instance."""
    return AuthService(db)

def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    """Dependency to get user service instance."""
    return UserService(db)

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

@router.put("/me", response_model=UserResponse)
async def update_users_me(
    update_data: UserMeUpdate,
    current_user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service)
):
    """
    Update profile information for the current user.
    """
    return await service.update_me(current_user, update_data)

@router.post("/me/avatar", response_model=dict)
async def upload_user_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service)
):
    """
    Upload and update avatar for the current user.
    """
    avatar_url = await upload_image(file, folder="avatars")
    
    # Update user's avatar_url in database
    await service.update_me(current_user, UserMeUpdate(avatar_url=avatar_url))
    
    return {"avatar_url": avatar_url}

@router.post("/me/change-password")
async def change_password(
    password_data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service)
):
    """
    Change current user's password.
    """
    return await service.change_password(current_user, password_data)

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

