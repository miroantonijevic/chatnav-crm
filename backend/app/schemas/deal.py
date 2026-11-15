"""
Pipeline / deal fields shared by the contact and company schemas
"""
from typing import Optional
from pydantic import BaseModel, Field

from app.models.contact import DealPeriod, DealStage, Priority, WaitingOn


class PipelineFieldsMixin(BaseModel):
    priority: Optional[Priority] = None
    next_action: Optional[str] = Field(None, max_length=500)
    deal_value: Optional[float] = Field(None, ge=0, le=1_000_000_000)  # EUR
    deal_value_period: Optional[DealPeriod] = None
    deal_stage: Optional[DealStage] = None
    waiting_on: Optional[WaitingOn] = None
