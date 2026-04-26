import re
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator, ValidationInfo


def check_password_strength(v: str) -> str:
    if not re.search(r"[A-Z]", v):
        raise ValueError("Mật khẩu phải chứa ít nhất một chữ viết hoa")
    if not re.search(r"\d", v):
        raise ValueError("Mật khẩu phải chứa ít nhất một chữ số")
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', v):
        raise ValueError("Mật khẩu phải chứa ít nhất một ký tự đặc biệt")
    return v


class Token(BaseModel):
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    token_type: str = Field(default="bearer", description="Token type")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer",
            }
        }
    )


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., description="JWT refresh token")


class TokenData(BaseModel):
    email: Optional[str] = None


class UserCreate(BaseModel):
    email: EmailStr = Field(..., description="User email")
    username: str = Field(
        ..., min_length=3, max_length=50, description="Username (3-50 characters)"
    )
    password: str = Field(..., min_length=8, description="Password (minimum 8 characters)")
    first_name: Optional[str] = Field(None, description="First name")
    last_name: Optional[str] = Field(None, description="Last name")
    avatar_url: Optional[str] = Field(None, description="Avatar URL")

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return check_password_strength(v)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "user@example.com",
                "username": "username123",
                "password": "password123456!",
            }
        }
    )


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Registered email")
    password: str = Field(..., description="Password")

    model_config = ConfigDict(
        json_schema_extra={"example": {"email": "user@example.com", "password": "password123456"}}
    )


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password (min 8 chars)")
    confirm_new_password: str = Field(..., description="Confirm new password")

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return check_password_strength(v)

    @field_validator("confirm_new_password")
    @classmethod
    def validate_confirm_password(cls, v: str, info: ValidationInfo) -> str:
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Xác nhận mật khẩu không khớp")
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "old_password": "oldpassword123",
                "new_password": "Newpassword123!",
                "confirm_new_password": "Newpassword123!",
            }
        }
    )


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., description="Reset token from email")
    new_password: str = Field(..., min_length=8, description="New password (min 8 chars)")
    confirm_password: str = Field(..., description="Confirm new password")

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        return check_password_strength(v)

    @field_validator("confirm_password")
    @classmethod
    def validate_confirm_password(cls, v: str, info: ValidationInfo) -> str:
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Xác nhận mật khẩu không khớp")
        return v


class RequestPasswordResetRequest(BaseModel):
    email: EmailStr = Field(..., description="Registered email")

    model_config = ConfigDict(json_schema_extra={"example": {"email": "user@example.com"}})
