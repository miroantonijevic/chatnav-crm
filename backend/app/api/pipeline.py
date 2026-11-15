"""
Hot leads endpoints - one list over companies and contacts
"""
from typing import Literal, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.pipeline import (
    EntityType, PipelineItem, PipelineListResponse, PipelineSummary, PipelineUpdate,
)
from app.services.pipeline_service import PipelineFilters, PipelineService
from app.api.dependencies import get_current_active_user
from app.models.contact import DealStage, RelationshipStatus, WaitingOn
from app.models.user import User

router = APIRouter(prefix="/pipeline", tags=["Hot leads"])

DueFilter = Literal["overdue", "week", "none"]


def _filters(
    search: Optional[str],
    entity_type: Optional[str],
    status: Optional[RelationshipStatus],
    owner_id: Optional[int],
    due: Optional[str],
    stage: Optional[DealStage],
    waiting_on: Optional[WaitingOn],
) -> PipelineFilters:
    return PipelineFilters(
        search=search or None,
        entity_type=entity_type,
        status=status,
        owner_id=owner_id,
        due=due,
        stage=stage,
        waiting_on=waiting_on,
    )


@router.get("", response_model=PipelineListResponse)
async def list_hot_leads(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None, description="Search name, company, notes, owner, contact details"),
    entity_type: Optional[EntityType] = Query(None, description="Only companies or only contacts"),
    status: Optional[RelationshipStatus] = Query(None),
    owner_id: Optional[int] = Query(None),
    due: Optional[DueFilter] = Query(None, description="overdue | week | none"),
    stage: Optional[DealStage] = Query(None),
    waiting_on: Optional[WaitingOn] = Query(None),
    sort_by: Optional[str] = Query(None, description="due|name|status|owner|last_contacted|updated|value|stage"),
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Companies and contacts marked as hot leads, filtered/sorted/paginated in SQL."""
    items, total = await PipelineService.list_items(
        db,
        _filters(search, entity_type, status, owner_id, due, stage, waiting_on),
        skip=skip,
        limit=limit,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return PipelineListResponse(items=items, total=total)


@router.get("/summary", response_model=PipelineSummary)
async def hot_leads_summary(
    search: Optional[str] = Query(None),
    entity_type: Optional[EntityType] = Query(None),
    status: Optional[RelationshipStatus] = Query(None),
    owner_id: Optional[int] = Query(None),
    stage: Optional[DealStage] = Query(None),
    waiting_on: Optional[WaitingOn] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Counts and values (ignores the follow-up filter)."""
    return await PipelineService.get_summary(
        db, _filters(search, entity_type, status, owner_id, None, stage, waiting_on)
    )


@router.get("/{entity_type}/{entity_id}", response_model=PipelineItem)
async def get_hot_lead(
    entity_type: EntityType,
    entity_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Hot-lead view of one company/contact."""
    return await PipelineService.get_item(db, entity_type, entity_id, current_user)


@router.patch("/{entity_type}/{entity_id}", response_model=PipelineItem)
async def update_hot_lead(
    entity_type: EntityType,
    entity_id: int,
    body: PipelineUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Inline update of the hot flag / next action / follow-up / deal fields."""
    return await PipelineService.update_item(db, entity_type, entity_id, body, current_user)
