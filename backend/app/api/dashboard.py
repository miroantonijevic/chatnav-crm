"""
Dashboard aggregate endpoints
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.dashboard import ActivityStatsResponse
from app.services.dashboard_service import DashboardService
from app.api.dependencies import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/activity", response_model=ActivityStatsResponse)
async def get_activity_stats(
    days: int = Query(30, ge=1, le=90, description="Number of days to look back"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get activity stats (created/edited/interactions) by user and by day
    across contacts and companies.
    """
    return await DashboardService.get_activity_stats(db, days=days)
