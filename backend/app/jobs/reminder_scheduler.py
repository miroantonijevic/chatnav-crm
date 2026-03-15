"""
Background job scheduler for reminders
"""
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.services.reminder_service import ReminderService

logger = logging.getLogger(__name__)


class ReminderScheduler:
    """Scheduler for periodic reminder checks"""

    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.is_running = False

    async def check_reminders_job(self):
        """Job that runs periodically to check for due reminders"""
        if not settings.REMINDERS_ENABLED:
            return

        async with AsyncSessionLocal() as db:
            try:
                result = await ReminderService.check_and_send_reminders(db)
                logger.info("Reminder job finished: %s", result)
            except Exception as e:
                logger.error("Unhandled error in reminder check job: %s", e, exc_info=True)

    def start(self):
        """Start the scheduler"""
        if self.is_running:
            logger.warning("Reminder scheduler is already running")
            return

        if not settings.REMINDERS_ENABLED:
            logger.info("Reminders are disabled, scheduler will not start")
            return

        # Add job to run at specified interval
        self.scheduler.add_job(
            self.check_reminders_job,
            trigger=IntervalTrigger(minutes=settings.REMINDER_CHECK_INTERVAL_MINUTES),
            id="reminder_check",
            name="Check for due contact reminders",
            replace_existing=True,
        )

        self.scheduler.start()
        self.is_running = True
        logger.info("Reminder scheduler started (interval: %d minute(s))", settings.REMINDER_CHECK_INTERVAL_MINUTES)

    def shutdown(self):
        """Shutdown the scheduler"""
        if self.is_running:
            self.scheduler.shutdown()
            self.is_running = False
            logger.info("Reminder scheduler stopped")


# Global scheduler instance
reminder_scheduler = ReminderScheduler()
