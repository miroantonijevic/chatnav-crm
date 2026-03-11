"""
Background job scheduler for reminders
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.services.reminder_service import ReminderService


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
                print(f"Reminder check completed: {result}")
            except Exception as e:
                print(f"Error in reminder check job: {e}")

    def start(self):
        """Start the scheduler"""
        if self.is_running:
            print("Reminder scheduler is already running")
            return

        if not settings.REMINDERS_ENABLED:
            print("Reminders are disabled, scheduler will not start")
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
        print(f"Reminder scheduler started (interval: {settings.REMINDER_CHECK_INTERVAL_MINUTES} minutes)")

    def shutdown(self):
        """Shutdown the scheduler"""
        if self.is_running:
            self.scheduler.shutdown()
            self.is_running = False
            print("Reminder scheduler stopped")


# Global scheduler instance
reminder_scheduler = ReminderScheduler()
