"""
Contact schemas for request/response validation
"""
from typing import Optional, Any
from datetime import datetime
from pydantic import BaseModel, EmailStr, model_validator

from app.models.contact import RelationshipStatus


# Base contact schema
class ContactBase(BaseModel):
    first_name: str
    last_name: str
    company: Optional[str] = None
    job_title: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    current_relationship_status: RelationshipStatus = RelationshipStatus.NEW
    reminders_enabled: bool = True


# Schema for creating a contact
class ContactCreate(ContactBase):
    owner_user_id: Optional[int] = None  # Admins can set this, regular users cannot
    last_contacted_at: Optional[datetime] = None
    next_contact_due_at: Optional[datetime] = None


# Schema for updating a contact
class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    current_relationship_status: Optional[RelationshipStatus] = None
    last_contacted_at: Optional[datetime] = None
    next_contact_due_at: Optional[datetime] = None
    reminders_enabled: Optional[bool] = None
    owner_user_id: Optional[int] = None  # Only admins can change ownership


# Schema for contact response
class ContactResponse(ContactBase):
    id: int
    owner_user_id: int
    owner_email: str = ""
    owner_full_name: str = ""
    created_by_user_id: int = 0
    created_by_email: str = ""
    created_by_full_name: str = ""
    last_contacted_at: Optional[datetime] = None
    next_contact_due_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @model_validator(mode='before')
    @classmethod
    def extract_owner_info(cls, data: Any) -> Any:
        """Extract owner and created_by email and full_name from relationships"""
        # If data is an ORM object (Contact model)
        if hasattr(data, 'owner') and data.owner:
            # Add owner fields as attributes so Pydantic can read them
            data.owner_email = data.owner.email
            data.owner_full_name = data.owner.full_name

        if hasattr(data, 'created_by') and data.created_by:
            # Add created_by fields as attributes so Pydantic can read them
            data.created_by_email = data.created_by.email
            data.created_by_full_name = data.created_by.full_name

        return data
class ContactWithOwner(ContactResponse):
    owner_email: str
    owner_full_name: str
