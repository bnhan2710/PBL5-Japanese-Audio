from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.users.models import User
from app.modules.users.schemas import (
    UserResponse,
    UserListResponse,
    UserCreateByAdmin,
    UserUpdate,
    LockUserRequest,
    AdminResetPasswordResponse
)
from app.modules.users.admin_service import AdminUserService
from app.core.security import get_current_user

router = APIRouter(prefix="/admin/users", tags=["admin"])


def get_admin_service(db: AsyncSession = Depends(get_db)) -> AdminUserService:
    """Dependency to get admin user service instance."""
    return AdminUserService(db)


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency to require admin role."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


@router.get("", response_model=UserListResponse)
async def list_users(
    email: str = Query(None, description="Filter by email (partial match)"),
    username: str = Query(None, description="Filter by username (partial match)"),
    role: str = Query(None, description="Filter by role (admin/user/guest)"),
    is_active: bool = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    service: AdminUserService = Depends(get_admin_service),
    admin: User = Depends(require_admin)
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
    service: AdminUserService = Depends(get_admin_service),
    admin: User = Depends(require_admin)
):
    """
    Create a new user (Admin).
    
    - Sends verification email to the new user
    - If password not provided, generates random password
    
    🔒 **Requires**: Admin role
    """
    return await service.create_user_by_admin(user_data)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    service: AdminUserService = Depends(get_admin_service),
    admin: User = Depends(require_admin)
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
    service: AdminUserService = Depends(get_admin_service),
    admin: User = Depends(require_admin)
):
    """
    Update user information.
    
    - Sends notification email to user when changes are made
    - If email is changed, requires re-verification
    
    🔒 **Requires**: Admin role
    """
    return await service.update_user(user_id, update_data)


@router.post("/{user_id}/lock", response_model=UserResponse)
async def lock_user(
    user_id: int,
    lock_data: LockUserRequest,
    service: AdminUserService = Depends(get_admin_service),
    admin: User = Depends(require_admin)
):
    """
    Lock user account temporarily.
    
    - User cannot login until lock expires
    - Lock duration specified in hours (max 1 year)
    
    🔒 **Requires**: Admin role
    """
    return await service.lock_user(user_id, lock_data.duration_hours)


@router.post("/{user_id}/unlock", response_model=UserResponse)
async def unlock_user(
    user_id: int,
    service: AdminUserService = Depends(get_admin_service),
    admin: User = Depends(require_admin)
):
    """
    Unlock user account.
    
    - Removes account lock immediately
    
    🔒 **Requires**: Admin role
    """
    return await service.unlock_user(user_id)


@router.post("/{user_id}/reset-password", response_model=AdminResetPasswordResponse)
async def reset_password(
    user_id: int,
    service: AdminUserService = Depends(get_admin_service),
    admin: User = Depends(require_admin)
):
    """
    Reset user password (Admin).
    
    - Generates temporary password
    - Sends email to user with temporary password
    - Returns temporary password in response
    
    🔒 **Requires**: Admin role
    """
    return await service.admin_reset_password(user_id)
