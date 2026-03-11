"""
Email service for sending notifications
"""
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List

from app.core.config import settings


class EmailService:
    """Service for sending emails via SMTP"""

    @staticmethod
    async def send_email(
        to_emails: List[str],
        subject: str,
        body: str,
        html_body: str = None
    ) -> bool:
        """
        Send an email to one or more recipients

        Args:
            to_emails: List of recipient email addresses
            subject: Email subject
            body: Plain text email body
            html_body: Optional HTML email body

        Returns:
            True if email was sent successfully, False otherwise
        """
        try:
            # Create message
            message = MIMEMultipart("alternative")
            message["From"] = settings.SMTP_FROM_EMAIL
            message["To"] = ", ".join(to_emails)
            message["Subject"] = subject

            # Attach plain text body
            text_part = MIMEText(body, "plain")
            message.attach(text_part)

            # Attach HTML body if provided
            if html_body:
                html_part = MIMEText(html_body, "html")
                message.attach(html_part)

            # Send email
            if settings.SMTP_HOST and settings.SMTP_PORT:
                await aiosmtplib.send(
                    message,
                    hostname=settings.SMTP_HOST,
                    port=settings.SMTP_PORT,
                    username=settings.SMTP_USERNAME if settings.SMTP_USERNAME else None,
                    password=settings.SMTP_PASSWORD if settings.SMTP_PASSWORD else None,
                    use_tls=settings.SMTP_USE_TLS,
                )
                print(f"Email sent to: {', '.join(to_emails)}")
                return True
            else:
                print(f"SMTP not configured. Would send email to: {', '.join(to_emails)}")
                print(f"Subject: {subject}")
                print(f"Body: {body}")
                return False

        except Exception as e:
            print(f"Error sending email: {e}")
            return False

    @staticmethod
    def format_reminder_email(
        contact_name: str,
        company: str,
        status: str,
        due_date: str,
        owner_name: str,
        contact_id: int
    ) -> tuple[str, str]:
        """
        Format a follow-up reminder email

        Returns:
            Tuple of (plain_text_body, html_body)
        """
        subject = f"Follow-up Reminder: {contact_name}"

        # Plain text version
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

        # HTML version
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

            <div class="field">
                <span class="label">Contact:</span> {contact_name}
            </div>
            <div class="field">
                <span class="label">Company:</span> {company or 'N/A'}
            </div>
            <div class="field">
                <span class="label">Status:</span> {status}
            </div>
            <div class="field">
                <span class="label">Due Date:</span> {due_date}
            </div>
            <div class="field">
                <span class="label">Owner:</span> {owner_name}
            </div>
            <div class="field">
                <span class="label">Contact ID:</span> {contact_id}
            </div>

            <p style="margin-top: 20px;">
                Please log into the CRM to review and update this contact.
            </p>
        </div>
        <div class="footer">
            <p>This is an automated message from your CRM system.</p>
        </div>
    </div>
</body>
</html>
"""

        return subject, plain_body, html_body
