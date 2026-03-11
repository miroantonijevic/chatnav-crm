"""
Contact model
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, Integer, ForeignKey, DateTime, Boolean, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.db.session import Base


class RelationshipStatus(str, enum.Enum):
    NEW = "new"
    CONTACTED = "contacted"
    FOLLOW_UP_NEEDED = "follow-up-needed"
    INTERESTED = "interested"
    NOT_INTERESTED = "not-interested"
    CUSTOMER = "customer"
    INACTIVE = "inactive"


class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    first_name: Mapped[str] = mapped_column(String(255), nullable=False)
    last_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    job_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    owner_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    current_relationship_status: Mapped[RelationshipStatus] = mapped_column(
        SQLEnum(RelationshipStatus),
        nullable=False,
        default=RelationshipStatus.NEW
    )

    last_contacted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    next_contact_due_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    # Relationships
    owner = relationship("User", foreign_keys=[owner_user_id], back_populates="contacts")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    history = relationship("RelationshipHistory", back_populates="contact", cascade="all, delete-orphan")
    reminder_logs = relationship("ReminderLog", back_populates="contact", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Contact(id={self.id}, name={self.first_name} {self.last_name}, status={self.current_relationship_status})>"
