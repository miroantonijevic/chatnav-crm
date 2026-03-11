"""
Relationship history schemas
"""
from typing import Optional, Any
from datetime import datetime
from pydantic import BaseModel, model_validator

from app.models.contact import RelationshipStatus


# Schema for creating a manual interaction entry
class HistoryCreate(BaseModel):
    status: RelationshipStatus
    note: Optional[str] = None
    interaction_at: datetime
    next_contact_due_at: Optional[datetime] = None


# Schema for history response
class HistoryResponse(BaseModel):
    id: int
    contact_id: int
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
