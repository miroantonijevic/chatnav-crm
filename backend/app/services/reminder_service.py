"""
Reminder service for checking and notifying about due contacts
"""
from datetime import datetime, timedelta
from typing import List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.models.reminder_log import ReminderLog
from app.models.user import User, UserRole
from app.services.email_service import EmailService
from app.services.contact_service import ContactService
from app.core.config import settings


class ReminderService:
    """Service for processing follow-up reminders"""

    @staticmethod
    async def check_and_send_reminders(db: AsyncSession) -> dict:
        """
        Check for due contacts and send reminder emails

        Returns:
            Dictionary with statistics about reminders sent
        """
        if not settings.REMINDERS_ENABLED:
            return {"message": "Reminders are disabled", "sent": 0}

        # Get due contacts
        due_contacts = await ContactService.get_due_contacts(db)

        if not due_contacts:
            return {"message": "No due contacts found", "sent": 0}

        # Get all admin users for notifications
        admin_result = await db.execute(
            select(User).where(
                and_(
                    User.role == UserRole.ADMIN,
                    User.is_active == True
                )
            )
        )
        admin_users = list(admin_result.scalars().all())

        sent_count = 0
        errors = []

        for contact in due_contacts:
            try:
                # Check if we already sent a reminder for this due date
                existing_log = await db.execute(
                    select(ReminderLog).where(
                        and_(
                            ReminderLog.contact_id == contact.id,
                            ReminderLog.due_at == contact.next_contact_due_at
                        )
                    )
                )

                if existing_log.scalar_one_or_none():
                    # Already sent reminder for this due date
                    continue

                # Prepare email recipients
                recipients = [contact.owner.email]
                for admin in admin_users:
                    if admin.email not in recipients:
                        recipients.append(admin.email)

                # Format email
                contact_name = f"{contact.first_name} {contact.last_name}"
                due_date_str = contact.next_contact_due_at.strftime("%Y-%m-%d %H:%M")

                subject, plain_body, html_body = EmailService.format_reminder_email(
                    contact_name=contact_name,
                    company=contact.company or "N/A",
                    status=contact.current_relationship_status.value,
                    due_date=due_date_str,
                    owner_name=contact.owner.full_name,
                    contact_id=contact.id
                )

                # Send email
                success = await EmailService.send_email(
                    to_emails=recipients,
                    subject=subject,
                    body=plain_body,
                    html_body=html_body
                )

                if success or not settings.SMTP_HOST:
                    # Log the reminder (even if SMTP is not configured, for testing)
                    reminder_log = ReminderLog(
                        contact_id=contact.id,
                        due_at=contact.next_contact_due_at,
                        sent_to=", ".join(recipients)
                    )
                    db.add(reminder_log)
                    sent_count += 1
                else:
                    errors.append(f"Failed to send reminder for contact {contact.id}")

            except Exception as e:
                errors.append(f"Error processing contact {contact.id}: {str(e)}")

        # Commit all reminder logs
        await db.commit()

        result = {
            "message": f"Processed {len(due_contacts)} due contacts",
            "sent": sent_count,
            "skipped": len(due_contacts) - sent_count,
        }

        if errors:
            result["errors"] = errors

        return result

    @staticmethod
    async def get_reminder_stats(db: AsyncSession, user: User) -> dict:
        """
        Get statistics about reminders for the current user
        """
        # Build base query
        if user.role == UserRole.ADMIN:
            # Admins see all contacts
            query = select(Contact)
        else:
            # Regular users see only their contacts
            query = select(Contact).where(Contact.owner_user_id == user.id)

        # Count due contacts
        due_query = query.where(
            and_(
                Contact.next_contact_due_at.isnot(None),
                Contact.next_contact_due_at <= datetime.utcnow(),
                Contact.reminders_enabled == True
            )
        )
        due_result = await db.execute(due_query)
        due_count = len(list(due_result.scalars().all()))

        # Count upcoming contacts (next 7 days)
        upcoming_date = datetime.utcnow() + timedelta(days=7)
        upcoming_query = query.where(
            and_(
                Contact.next_contact_due_at.isnot(None),
                Contact.next_contact_due_at > datetime.utcnow(),
                Contact.next_contact_due_at <= upcoming_date,
                Contact.reminders_enabled == True
            )
        )
        upcoming_result = await db.execute(upcoming_query)
        upcoming_count = len(list(upcoming_result.scalars().all()))

        return {
            "due_now": due_count,
            "upcoming_7_days": upcoming_count,
            "reminders_enabled": settings.REMINDERS_ENABLED,
            "check_interval_minutes": settings.REMINDER_CHECK_INTERVAL_MINUTES,
        }
