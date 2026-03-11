"""
Reminders management endpoints
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.reminder_service import ReminderService
from app.api.dependencies import get_current_active_user, get_current_admin_user
from app.models.user import User

router = APIRouter(prefix="/reminders", tags=["Reminders"])


@router.get("/stats")
async def get_reminder_statistics(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get reminder statistics for the current user
    Shows due and upcoming contacts
    """
    stats = await ReminderService.get_reminder_stats(db, current_user)
    return stats


@router.post("/check")
async def trigger_reminder_check(
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Manually trigger a reminder check (admin only)
    Useful for testing or forcing an immediate check
    """
    result = await ReminderService.check_and_send_reminders(db)
    return result
