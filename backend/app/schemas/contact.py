"""
Contact schemas for request/response validation
"""
from typing import Optional, Any, List
from datetime import datetime
from pydantic import BaseModel, EmailStr, model_validator

from app.models.contact import RelationshipStatus


class ContactContactDetailCreate(BaseModel):
    type: str  # 'email' | 'phone'
    value: str
    label: Optional[str] = None


class ContactContactDetailResponse(BaseModel):
    id: int
    type: str
    value: str
    label: Optional[str] = None

    class Config:
        from_attributes = True


# Base contact schema
class ContactBase(BaseModel):
    first_name: str
    last_name: str
    company_id: Optional[int] = None
    job_title: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    current_relationship_status: RelationshipStatus = RelationshipStatus.NEW
    reminders_enabled: bool = True


# Schema for creating a contact
class ContactCreate(ContactBase):
    owner_user_id: Optional[int] = None
    last_contacted_at: Optional[datetime] = None
    next_contact_due_at: Optional[datetime] = None
    contact_details: List[ContactContactDetailCreate] = []


# Schema for updating a contact
class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company_id: Optional[int] = None
    job_title: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    current_relationship_status: Optional[RelationshipStatus] = None
    last_contacted_at: Optional[datetime] = None
    next_contact_due_at: Optional[datetime] = None
    reminders_enabled: Optional[bool] = None
    owner_user_id: Optional[int] = None
    contact_details: Optional[List[ContactContactDetailCreate]] = None


# Schema for contact response
class ContactResponse(ContactBase):
    id: int
    owner_user_id: int
    owner_email: str = ""
    owner_full_name: str = ""
    created_by_user_id: int = 0
    created_by_email: str = ""
    created_by_full_name: str = ""
    company_name: Optional[str] = None
    last_contacted_at: Optional[datetime] = None
    next_contact_due_at: Optional[datetime] = None
    contact_details: List[ContactContactDetailResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @model_validator(mode='before')
    @classmethod
    def extract_owner_info(cls, data: Any) -> Any:
        if hasattr(data, 'owner') and data.owner:
            data.owner_email = data.owner.email
            data.owner_full_name = data.owner.full_name

        if hasattr(data, 'created_by') and data.created_by:
            data.created_by_email = data.created_by.email
            data.created_by_full_name = data.created_by.full_name

        if hasattr(data, 'company') and data.company:
            data.company_name = data.company.name

        return data


class ContactWithOwner(ContactResponse):
    owner_email: str
    owner_full_name: str
