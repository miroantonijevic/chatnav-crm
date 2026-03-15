"""
Company schemas for request/response validation
"""
from typing import Optional, Any, List
from datetime import datetime
from pydantic import BaseModel, model_validator

from app.models.contact import RelationshipStatus


class CompanyContactDetailCreate(BaseModel):
    type: str  # 'website' | 'phone' | 'email' | 'address'
    value: str
    label: Optional[str] = None


class CompanyContactDetailResponse(BaseModel):
    id: int
    type: str
    value: str
    label: Optional[str] = None

    class Config:
        from_attributes = True


class CompanyCreate(BaseModel):
    name: str
    industry: Optional[str] = None
    notes: Optional[str] = None
    owner_user_id: Optional[int] = None
    current_relationship_status: RelationshipStatus = RelationshipStatus.NEW
    reminders_enabled: bool = True
    next_contact_due_at: Optional[datetime] = None
    contact_details: List[CompanyContactDetailCreate] = []


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    notes: Optional[str] = None
    owner_user_id: Optional[int] = None
    current_relationship_status: Optional[RelationshipStatus] = None
    reminders_enabled: Optional[bool] = None
    next_contact_due_at: Optional[datetime] = None
    contact_details: Optional[List[CompanyContactDetailCreate]] = None  # if provided, replaces all existing details


class CompanyResponse(BaseModel):
    id: int
    name: str
    industry: Optional[str] = None
    notes: Optional[str] = None
    owner_user_id: int
    owner_email: str = ""
    owner_full_name: str = ""
    created_by_user_id: int = 0
    created_by_email: str = ""
    created_by_full_name: str = ""
    current_relationship_status: RelationshipStatus
    last_contacted_at: Optional[datetime] = None
    next_contact_due_at: Optional[datetime] = None
    reminders_enabled: bool
    contact_details: List[CompanyContactDetailResponse] = []
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
        return data


class CompanyListItem(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class CompanyHistoryCreate(BaseModel):
    status: RelationshipStatus
    note: Optional[str] = None
    interaction_at: datetime
    next_contact_due_at: Optional[datetime] = None


class CompanyHistoryResponse(BaseModel):
    id: int
    company_id: int
    changed_by_user_id: int
    changed_by_full_name: str = ""
    entry_type: str
    status: RelationshipStatus
    note: Optional[str] = None
    interaction_at: datetime
    next_contact_due_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

    @model_validator(mode='before')
    @classmethod
    def extract_user_info(cls, data: Any) -> Any:
        if hasattr(data, 'changed_by') and data.changed_by:
            data.changed_by_full_name = data.changed_by.full_name
        return data
