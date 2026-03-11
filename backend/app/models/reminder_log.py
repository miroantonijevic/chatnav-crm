"""
Reminder log model to track sent reminders and prevent duplicates
"""
from datetime import datetime
from sqlalchemy import Integer, ForeignKey, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class ReminderLog(Base):
    __tablename__ = "reminder_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    contact_id: Mapped[int] = mapped_column(Integer, ForeignKey("contacts.id"), nullable=False, index=True)

    due_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    sent_to: Mapped[str] = mapped_column(String(500), nullable=False)  # Comma-separated email list

    # Relationships
    contact = relationship("Contact", back_populates="reminder_logs")

    def __repr__(self):
        return f"<ReminderLog(id={self.id}, contact_id={self.contact_id}, due_at={self.due_at})>"
