"""
Reminder service for checking and notifying about due contacts and companies
"""
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.models.company import Company
from app.models.reminder_log import ReminderLog
from app.models.user import User, UserRole
from app.services.email_service import EmailService
from app.services.contact_service import ContactService
from app.services.company_service import CompanyService
from app.core.config import settings

logger = logging.getLogger(__name__)


class ReminderService:
    """Service for processing follow-up reminders"""

    @staticmethod
    async def check_and_send_reminders(db: AsyncSession) -> dict:
        """
        Check for due contacts and companies and send reminder emails.

        Returns:
            Dictionary with statistics about reminders sent
        """
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        logger.info("Reminder check started at %s", now_str)

        if not settings.REMINDERS_ENABLED:
            logger.info("Reminders are disabled, skipping check")
            return {"message": "Reminders are disabled", "sent": 0}

        due_contacts = await ContactService.get_due_contacts(db)
        due_companies = await CompanyService.get_due_companies(db)

        logger.info("Found %d due contact(s) and %d due company/companies", len(due_contacts), len(due_companies))

        if not due_contacts and not due_companies:
            logger.info("No due contacts or companies found")
            return {"message": "No due contacts or companies found", "sent": 0}

        sent_count = 0
        errors = []

        # Process contacts
        for contact in due_contacts:
            try:
                existing_log = await db.execute(
                    select(ReminderLog).where(
                        and_(
                            ReminderLog.contact_id == contact.id,
                            ReminderLog.due_at == contact.next_contact_due_at
                        )
                    )
                )
                if existing_log.scalar_one_or_none():
                    continue

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

                success = await EmailService.send_email(
                    to_emails=[contact.owner.email],
                    subject=subject,
                    body=plain_body,
                    html_body=html_body
                )

                if success or not settings.SMTP_HOST:
                    db.add(ReminderLog(
                        contact_id=contact.id,
                        due_at=contact.next_contact_due_at,
                        sent_to=contact.owner.email
                    ))
                    sent_count += 1
                    logger.info("Sent reminder for contact %d (%s) to %s", contact.id, contact_name, contact.owner.email)
                else:
                    logger.warning("Failed to send reminder for contact %d (%s)", contact.id, contact_name)
                    errors.append(f"Failed to send reminder for contact {contact.id}")

            except Exception as e:
                logger.error("Error processing contact %d: %s", contact.id, e, exc_info=True)
                errors.append(f"Error processing contact {contact.id}: {str(e)}")

        # Process companies
        for company in due_companies:
            try:
                existing_log = await db.execute(
                    select(ReminderLog).where(
                        and_(
                            ReminderLog.company_id == company.id,
                            ReminderLog.due_at == company.next_contact_due_at
                        )
                    )
                )
                if existing_log.scalar_one_or_none():
                    continue

                due_date_str = company.next_contact_due_at.strftime("%Y-%m-%d %H:%M")

                subject, plain_body, html_body = EmailService.format_company_reminder_email(
                    company_name=company.name,
                    industry=company.industry,
                    status=company.current_relationship_status.value,
                    due_date=due_date_str,
                    owner_name=company.owner.full_name,
                    company_id=company.id
                )

                success = await EmailService.send_email(
                    to_emails=[company.owner.email],
                    subject=subject,
                    body=plain_body,
                    html_body=html_body
                )

                if success or not settings.SMTP_HOST:
                    db.add(ReminderLog(
                        company_id=company.id,
                        due_at=company.next_contact_due_at,
                        sent_to=company.owner.email
                    ))
                    sent_count += 1
                    logger.info("Sent reminder for company %d (%s) to %s", company.id, company.name, company.owner.email)
                else:
                    logger.warning("Failed to send reminder for company %d (%s)", company.id, company.name)
                    errors.append(f"Failed to send reminder for company {company.id}")

            except Exception as e:
                logger.error("Error processing company %d: %s", company.id, e, exc_info=True)
                errors.append(f"Error processing company {company.id}: {str(e)}")

        await db.commit()

        result = {
            "message": f"Processed {len(due_contacts)} due contacts and {len(due_companies)} due companies",
            "sent": sent_count,
            "skipped": (len(due_contacts) + len(due_companies)) - sent_count,
        }

        if errors:
            result["errors"] = errors

        logger.info("Reminder check complete: sent=%d, skipped=%d, errors=%d", sent_count, result["skipped"], len(errors))
        return result

    @staticmethod
    async def get_reminder_stats(db: AsyncSession, user: User) -> dict:
        """
        Get statistics about reminders for the current user
        """
        now = datetime.now(timezone.utc)
        upcoming_date = now + timedelta(days=7)

        if user.role == UserRole.ADMIN:
            contact_base = select(Contact)
            company_base = select(Company)
        else:
            contact_base = select(Contact).where(Contact.owner_user_id == user.id)
            company_base = select(Company).where(Company.owner_user_id == user.id)

        due_result = await db.execute(contact_base.where(
            and_(
                Contact.next_contact_due_at.isnot(None),
                Contact.next_contact_due_at <= now,
                Contact.reminders_enabled == True
            )
        ))
        due_count = len(list(due_result.scalars().all()))

        upcoming_result = await db.execute(contact_base.where(
            and_(
                Contact.next_contact_due_at.isnot(None),
                Contact.next_contact_due_at > now,
                Contact.next_contact_due_at <= upcoming_date,
                Contact.reminders_enabled == True
            )
        ))
        upcoming_count = len(list(upcoming_result.scalars().all()))

        due_companies_result = await db.execute(company_base.where(
            and_(
                Company.next_contact_due_at.isnot(None),
                Company.next_contact_due_at <= now,
                Company.reminders_enabled == True
            )
        ))
        due_companies_count = len(list(due_companies_result.scalars().all()))

        upcoming_companies_result = await db.execute(company_base.where(
            and_(
                Company.next_contact_due_at.isnot(None),
                Company.next_contact_due_at > now,
                Company.next_contact_due_at <= upcoming_date,
                Company.reminders_enabled == True
            )
        ))
        upcoming_companies_count = len(list(upcoming_companies_result.scalars().all()))

        return {
            "due_now": due_count,
            "upcoming_7_days": upcoming_count,
            "companies_due_now": due_companies_count,
            "companies_upcoming_7_days": upcoming_companies_count,
            "reminders_enabled": settings.REMINDERS_ENABLED,
            "check_interval_minutes": settings.REMINDER_CHECK_INTERVAL_MINUTES,
        }
