"""
Company model
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, Integer, ForeignKey, DateTime, Boolean, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.contact import RelationshipStatus


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    industry: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
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
    owner = relationship("User", foreign_keys=[owner_user_id])
    created_by = relationship("User", foreign_keys=[created_by_user_id])
    contact_details = relationship("CompanyContactDetail", back_populates="company", cascade="all, delete-orphan")
    history = relationship("CompanyHistory", back_populates="company", cascade="all, delete-orphan")
    contacts = relationship("Contact", back_populates="company")
    reminder_logs = relationship("ReminderLog", back_populates="company", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Company(id={self.id}, name={self.name}, status={self.current_relationship_status})>"


class CompanyContactDetail(Base):
    __tablename__ = "company_contact_details"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    value: Mapped[str] = mapped_column(String(500), nullable=False)
    label: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    company = relationship("Company", back_populates="contact_details")

    def __repr__(self):
        return f"<CompanyContactDetail(id={self.id}, type={self.type}, value={self.value})>"


class CompanyHistory(Base):
    __tablename__ = "company_history"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    changed_by_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    entry_type: Mapped[str] = mapped_column(String(20), nullable=False, default="interaction")
    status: Mapped[RelationshipStatus] = mapped_column(SQLEnum(RelationshipStatus), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    interaction_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    next_contact_due_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    company = relationship("Company", back_populates="history")
    changed_by = relationship("User", foreign_keys=[changed_by_user_id])

    def __repr__(self):
        return f"<CompanyHistory(id={self.id}, company_id={self.company_id}, type={self.entry_type})>"
