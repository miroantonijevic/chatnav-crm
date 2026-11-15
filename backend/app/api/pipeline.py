"""
Pipeline ("hot list") endpoints - one list over companies and contacts
"""
from typing import List, Literal, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.pipeline import (
    EntityType, PipelineItem, PipelineListResponse, PipelineSummary, PipelineUpdate,
)
from app.services.pipeline_service import PipelineFilters, PipelineService
from app.api.dependencies import get_current_active_user
from app.models.contact import DealStage, Priority, RelationshipStatus, WaitingOn
from app.models.user import User

router = APIRouter(prefix="/pipeline", tags=["Pipeline"])

DueFilter = Literal["overdue", "week", "none"]


def _filters(
    user: User,
    search: Optional[str],
    entity_type: Optional[str],
    priority: Optional[List[Priority]],
    status: Optional[RelationshipStatus],
    owner_id: Optional[int],
    due: Optional[str],
    stage: Optional[DealStage],
    waiting_on: Optional[WaitingOn],
    favorites: bool,
) -> PipelineFilters:
    return PipelineFilters(
        search=search or None,
        entity_type=entity_type,
        priorities=priority or [],
        status=status,
        owner_id=owner_id,
        due=due,
        stage=stage,
        waiting_on=waiting_on,
        favorites_only=favorites,
        user_id=user.id,
    )


@router.get("", response_model=PipelineListResponse)
async def list_pipeline(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None, description="Search name, company, notes, owner, contact details"),
    entity_type: Optional[EntityType] = Query(None, description="Only companies or only contacts"),
    priority: Optional[List[Priority]] = Query(None, description="One or more priorities"),
    status: Optional[RelationshipStatus] = Query(None),
    owner_id: Optional[int] = Query(None),
    due: Optional[DueFilter] = Query(None, description="overdue | week | none"),
    stage: Optional[DealStage] = Query(None),
    waiting_on: Optional[WaitingOn] = Query(None),
    favorites: bool = Query(False, description="Only the current user's starred items (any priority)"),
    sort_by: Optional[str] = Query(
        None, description="priority|due|last_contacted|name|status|owner|updated|value|stage"
    ),
    sort_order: str = Query("asc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Companies and contacts with a priority, filtered/sorted/paginated in SQL."""
    items, total = await PipelineService.list_items(
        db,
        _filters(current_user, search, entity_type, priority, status, owner_id, due, stage, waiting_on, favorites),
        skip=skip,
        limit=limit,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return PipelineListResponse(items=items, total=total)


@router.get("/summary", response_model=PipelineSummary)
async def pipeline_summary(
    search: Optional[str] = Query(None),
    entity_type: Optional[EntityType] = Query(None),
    status: Optional[RelationshipStatus] = Query(None),
    owner_id: Optional[int] = Query(None),
    stage: Optional[DealStage] = Query(None),
    waiting_on: Optional[WaitingOn] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Counts / values per priority, overdue and favourites (ignores the priority, due and favourites filters)."""
    return await PipelineService.get_summary(
        db, _filters(current_user, search, entity_type, None, status, owner_id, None, stage, waiting_on, False)
    )


@router.get("/{entity_type}/{entity_id}", response_model=PipelineItem)
async def get_pipeline_item(
    entity_type: EntityType,
    entity_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Pipeline view of one company/contact (priority, deal fields, favourite state)."""
    return await PipelineService.get_item(db, entity_type, entity_id, current_user)


@router.patch("/{entity_type}/{entity_id}", response_model=PipelineItem)
async def update_pipeline_item(
    entity_type: EntityType,
    entity_id: int,
    body: PipelineUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Inline update of priority / next action / follow-up / deal fields (null priority removes from pipeline)."""
    return await PipelineService.update_item(db, entity_type, entity_id, body, current_user)


@router.put("/{entity_type}/{entity_id}/favorite", response_model=PipelineItem)
async def add_favorite(
    entity_type: EntityType,
    entity_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Star an item (personal to the current user)."""
    return await PipelineService.set_favorite(db, entity_type, entity_id, current_user, True)


@router.delete("/{entity_type}/{entity_id}/favorite", response_model=PipelineItem)
async def remove_favorite(
    entity_type: EntityType,
    entity_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Un-star an item."""
    return await PipelineService.set_favorite(db, entity_type, entity_id, current_user, False)
