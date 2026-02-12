from typing import Optional
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
    first_name: Optional[str] = Field(None, description="First name")
    last_name: Optional[str] = Field(None, description="Last name")
    avatar_url: Optional[str] = Field(None, description="Avatar URL")
    
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

class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password (min 8 chars)")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "old_password": "oldpassword123",
                "new_password": "newpassword123"
            }
        }
    )
