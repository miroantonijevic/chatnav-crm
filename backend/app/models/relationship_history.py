"""
Relationship history model
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, Integer, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.contact import RelationshipStatus


class RelationshipHistory(Base):
    __tablename__ = "relationship_history"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    contact_id: Mapped[int] = mapped_column(Integer, ForeignKey("contacts.id"), nullable=False, index=True)
    changed_by_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)

    # "created" | "edited" | "interaction"
    entry_type: Mapped[str] = mapped_column(String(20), nullable=False, default="interaction")
    status: Mapped[RelationshipStatus] = mapped_column(SQLEnum(RelationshipStatus), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    interaction_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    next_contact_due_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    contact = relationship("Contact", back_populates="history")
    changed_by = relationship("User", back_populates="history_entries")

    def __repr__(self):
        return f"<RelationshipHistory(id={self.id}, contact_id={self.contact_id}, status={self.status})>"
