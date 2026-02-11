from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class Token(BaseModel):
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field(default="bearer", description="Token type")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer"
            }
        }
    )


class TokenData(BaseModel):
    email: Optional[str] = None


class UserCreate(BaseModel):
    email: EmailStr = Field(..., description="User email")
    username: str = Field(..., min_length=3, max_length=50, description="Username (3-50 characters)")
    password: str = Field(..., min_length=8, description="Password (minimum 8 characters)")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "user@example.com",
                "username": "username123",
                "password": "password123456"
            }
        }
    )


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Registered email")
    password: str = Field(..., description="Password")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "user@example.com",
                "password": "password123456"
            }
        }
    )


class UserResponse(BaseModel):
    id: int = Field(..., description="User ID")
    email: str = Field(..., description="Email")
    username: str = Field(..., description="Username")
    is_active: bool = Field(..., description="Active status")
    email_verified: bool = Field(..., description="Email verified status")
    role: str = Field(..., description="Role (admin/user/guest)")
    created_at: datetime = Field(..., description="Account creation date")
    updated_at: datetime = Field(..., description="Last update date")
    locked_until: Optional[datetime] = Field(None, description="Locked until date (if locked)")

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": 1,
                "email": "user@example.com",
                "username": "username123",
                "is_active": True,
                "email_verified": True,
                "role": "user",
                "created_at": "2024-01-01T00:00:00",
                "updated_at": "2024-01-01T00:00:00",
                "locked_until": None
            }
        }
    )


# Admin-specific schemas

class UserListFilters(BaseModel):
    """Filters for listing users."""
    email: Optional[str] = None
    username: Optional[str] = None
    role: Optional[str] = Field(None, pattern="^(admin|user|guest)$")
    is_active: Optional[bool] = None


class UserListResponse(BaseModel):
    """Paginated user list response."""
    users: List[UserResponse]
    total: int = Field(..., description="Total number of users")
    page: int = Field(..., description="Current page")
    page_size: int = Field(..., description="Items per page")
    total_pages: int = Field(..., description="Total pages")


class UserCreateByAdmin(BaseModel):
    """Schema for admin creating a new user."""
    email: EmailStr = Field(..., description="New user email")
    username: str = Field(..., min_length=3, max_length=50, description="Username")
    role: str = Field("user", pattern="^(admin|user|guest)$", description="Role")
    password: Optional[str] = Field(None, min_length=8, description="Password (leave empty to auto-generate)")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "newuser@example.com",
                "username": "newuser123",
                "role": "user",
                "password": "password123456"
            }
        }
    )


class UserUpdate(BaseModel):
    """Schema for updating user information."""
    email: Optional[EmailStr] = Field(None, description="New email")
    username: Optional[str] = Field(None, min_length=3, max_length=50, description="New username")
    role: Optional[str] = Field(None, pattern="^(admin|user|guest)$", description="New role")
    is_active: Optional[bool] = Field(None, description="Active status")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "username": "updated_username",
                "role": "admin",
                "is_active": True
            }
        }
    )


class LockUserRequest(BaseModel):
    """Schema for locking a user account."""
    duration_hours: int = Field(24, gt=0, le=8760, description="Lock duration (hours), max 1 year")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "duration_hours": 48
            }
        }
    )


class AdminResetPasswordResponse(BaseModel):
    """Response when admin resets user password."""
    message: str = Field(..., description="Message")
    temporary_password: str = Field(..., description="Temporary password")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "message": "Password reset successfully",
                "temporary_password": "TempPass123!"
            }
        }
    )
