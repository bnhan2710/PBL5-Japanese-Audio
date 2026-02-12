from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.users.models import User
from app.core.security import RoleChecker
from app.modules.users.schemas import (
    UserResponse,
    UserListResponse,
    UserCreateByAdmin,
    UserUpdate,
    LockUserRequest,
    AdminResetPasswordResponse
)
from app.modules.users.service import UserService

router = APIRouter(prefix="/users", tags=["users"])


def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    """Dependency to get user service instance."""
    return UserService(db)


@router.get("", response_model=UserListResponse)
async def list_users(
    email: str = Query(None, description="Filter by email (partial match)"),
    username: str = Query(None, description="Filter by username (partial match)"),
    role: str = Query(None, description="Filter by role (admin/user/guest)"),
    is_active: bool = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    service: UserService = Depends(get_user_service),
    admin: User = Depends(RoleChecker(["admin"]))
):
    """
    List all users with optional filters and pagination.
    
    🔒 **Requires**: Admin role
    """
    filters = {}
    if email:
        filters["email"] = email
    if username:
        filters["username"] = username
    if role:
        filters["role"] = role
    if is_active is not None:
        filters["is_active"] = is_active

    return await service.list_users(filters, page, page_size)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreateByAdmin,
    service: UserService = Depends(get_user_service),
    admin: User = Depends(RoleChecker(["admin"]))
):
    """
    Create a new user (Admin).
    
    🔒 **Requires**: Admin role
    """
    return await service.create_user_by_admin(user_data)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    service: UserService = Depends(get_user_service),
    admin: User = Depends(RoleChecker(["admin"]))
):
    """
    Get user details by ID.
    
    🔒 **Requires**: Admin role
    """
    return await service.get_user_by_id(user_id)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    update_data: UserUpdate,
    service: UserService = Depends(get_user_service),
    admin: User = Depends(RoleChecker(["admin"]))
):
    """
    Update user information.
    
    🔒 **Requires**: Admin role
    """
    return await service.update_user(user_id, update_data)


@router.post("/{user_id}/lock", response_model=UserResponse)
async def lock_user(
    user_id: int,
    lock_data: LockUserRequest,
    service: UserService = Depends(get_user_service),
    admin: User = Depends(RoleChecker(["admin"]))
):
    """
    Lock user account temporarily.
    
    🔒 **Requires**: Admin role
    """
    return await service.lock_user(user_id, lock_data.duration_hours)


@router.post("/{user_id}/unlock", response_model=UserResponse)
async def unlock_user(
    user_id: int,
    service: UserService = Depends(get_user_service),
    admin: User = Depends(RoleChecker(["admin"]))
):
    """
    Unlock user account.
    
    🔒 **Requires**: Admin role
    """
    return await service.unlock_user(user_id)


@router.post("/{user_id}/reset-password", response_model=AdminResetPasswordResponse)
async def admin_reset_password(
    user_id: int,
    service: UserService = Depends(get_user_service),
    admin: User = Depends(RoleChecker(["admin"]))
):
    """
    Reset user password (Admin).
    
    🔒 **Requires**: Admin role
    """
    return await service.admin_reset_password(user_id)
