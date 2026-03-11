"""
User schemas for request/response validation
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


# Base user schema
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.USER


# Schema for creating a user
class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


# Schema for updating a user
class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


# Schema for user response (never include hashed_password)
class UserResponse(UserBase):
    id: int
    is_active: bool
    must_change_password: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Schema for password change
class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


# Schema for user activation/deactivation
class UserActivation(BaseModel):
    is_active: bool
