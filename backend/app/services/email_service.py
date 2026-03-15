"""
Email service for sending notifications
"""
import logging
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails via Zoho SMTP"""

    @staticmethod
    async def send_email(
        to_emails: List[str],
        subject: str,
        body: str,
        html_body: str = None,
    ) -> bool:
        """
        Send an email to recipients.

        Args:
            to_emails: List of recipient email addresses
            subject: Email subject
            body: Plain text email body
            html_body: Optional HTML email body

        Returns:
            True if email was sent successfully, False otherwise
        """
        if not settings.SMTP_HOST or not settings.SMTP_PORT:
            logger.warning("SMTP not configured. Skipping email send.")
            logger.debug("Subject: %s | To: %s", subject, ", ".join(to_emails))
            return False

        try:
            msg = MIMEMultipart("alternative")
            msg["From"] = settings.SMTP_FROM_EMAIL
            msg["To"] = ", ".join(to_emails)
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain"))
            if html_body:
                msg.attach(MIMEText(html_body, "html"))

            await aiosmtplib.send(
                msg,
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                username=settings.SMTP_USERNAME,
                password=settings.SMTP_PASSWORD,
                start_tls=settings.SMTP_START_TLS,
            )
            logger.info("Email sent successfully to %s", ", ".join(to_emails))
            return True

        except Exception as e:
            logger.error("Failed to send email: %s", e)
            return False

    @staticmethod
    def format_reminder_email(
        contact_name: str,
        company: str,
        status: str,
        due_date: str,
        owner_name: str,
        contact_id: int
    ) -> tuple[str, str, str]:
        """
        Format a follow-up reminder email.

        Returns:
            Tuple of (subject, plain_text_body, html_body)
        """
        subject = f"Follow-up Reminder: {contact_name}"

        plain_body = f"""
Follow-up Reminder

A contact requires follow-up attention:

Contact: {contact_name}
Company: {company or 'N/A'}
Status: {status}
Due Date: {due_date}
Owner: {owner_name}
Contact ID: {contact_id}

Please log into the CRM to review and update this contact.
"""

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #4CAF50; color: white; padding: 20px; text-align: center; }}
        .content {{ background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }}
        .field {{ margin: 10px 0; }}
        .label {{ font-weight: bold; }}
        .footer {{ text-align: center; padding: 20px; color: #777; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Follow-up Reminder</h2>
        </div>
        <div class="content">
            <p>A contact requires follow-up attention:</p>
            <div class="field"><span class="label">Contact:</span> {contact_name}</div>
            <div class="field"><span class="label">Company:</span> {company or 'N/A'}</div>
            <div class="field"><span class="label">Status:</span> {status}</div>
            <div class="field"><span class="label">Due Date:</span> {due_date}</div>
            <div class="field"><span class="label">Owner:</span> {owner_name}</div>
            <div class="field"><span class="label">Contact ID:</span> {contact_id}</div>
            <p style="margin-top: 20px;">Please log into the CRM to review and update this contact.</p>
        </div>
        <div class="footer">
            <p>This is an automated message from {settings.PROJECT_NAME}.</p>
        </div>
    </div>
</body>
</html>
"""

        return subject, plain_body, html_body

    @staticmethod
    def format_company_reminder_email(
        company_name: str,
        industry: str,
        status: str,
        due_date: str,
        owner_name: str,
        company_id: int
    ) -> tuple[str, str, str]:
        """
        Format a follow-up reminder email for a company.

        Returns:
            Tuple of (subject, plain_text_body, html_body)
        """
        subject = f"Follow-up Reminder: {company_name}"

        plain_body = f"""
Follow-up Reminder

A company requires follow-up attention:

Company: {company_name}
Industry: {industry or 'N/A'}
Status: {status}
Due Date: {due_date}
Owner: {owner_name}
Company ID: {company_id}

Please log into the CRM to review and update this company.
"""

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background-color: #2980b9; color: white; padding: 20px; text-align: center; }}
        .content {{ background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }}
        .field {{ margin: 10px 0; }}
        .label {{ font-weight: bold; }}
        .footer {{ text-align: center; padding: 20px; color: #777; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Follow-up Reminder</h2>
        </div>
        <div class="content">
            <p>A company requires follow-up attention:</p>
            <div class="field"><span class="label">Company:</span> {company_name}</div>
            <div class="field"><span class="label">Industry:</span> {industry or 'N/A'}</div>
            <div class="field"><span class="label">Status:</span> {status}</div>
            <div class="field"><span class="label">Due Date:</span> {due_date}</div>
            <div class="field"><span class="label">Owner:</span> {owner_name}</div>
            <div class="field"><span class="label">Company ID:</span> {company_id}</div>
            <p style="margin-top: 20px;">Please log into the CRM to review and update this company.</p>
        </div>
        <div class="footer">
            <p>This is an automated message from {settings.PROJECT_NAME}.</p>
        </div>
    </div>
</body>
</html>
"""

        return subject, plain_body, html_body
