"""
Hot leads schemas - a unified view over companies and contacts
"""
from typing import List, Literal, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from app.models.contact import DealPeriod, DealStage, RelationshipStatus, WaitingOn

EntityType = Literal["company", "contact"]


class PipelineItem(BaseModel):
    entity_type: EntityType
    id: int
    name: str
    # Contacts only
    company_id: Optional[int] = None
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    # Companies only
    industry: Optional[str] = None

    is_hot: bool = False
    next_action: Optional[str] = None
    deal_value: Optional[float] = None
    deal_value_period: Optional[DealPeriod] = None
    deal_stage: Optional[DealStage] = None
    waiting_on: Optional[WaitingOn] = None

    status: RelationshipStatus
    last_contacted_at: Optional[datetime] = None
    next_contact_due_at: Optional[datetime] = None
    reminders_enabled: bool = True

    owner_user_id: int
    owner_full_name: str = ""

    emails: List[str] = []
    phones: List[str] = []
    updated_at: datetime


class PipelineListResponse(BaseModel):
    items: List[PipelineItem]
    total: int


class PipelineSummary(BaseModel):
    total: int = 0
    overdue: int = 0
    companies: int = 0
    contacts: int = 0
    # Monthly-equivalent recurring value (EUR); yearly deals are divided by 12
    mrr: float = 0
    one_time: float = 0


class PipelineUpdate(BaseModel):
    """Partial update: only fields present in the request body are applied."""
    is_hot: Optional[bool] = None
    next_action: Optional[str] = Field(None, max_length=500)
    next_contact_due_at: Optional[datetime] = None
    deal_value: Optional[float] = Field(None, ge=0, le=1_000_000_000)
    deal_value_period: Optional[DealPeriod] = None
    deal_stage: Optional[DealStage] = None
    waiting_on: Optional[WaitingOn] = None
