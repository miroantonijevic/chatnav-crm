"""
Relationship history service
"""
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.contact import Contact, RelationshipStatus
from app.models.relationship_history import RelationshipHistory
from app.models.user import User
from app.schemas.history import HistoryCreate


class HistoryService:
    """Service class for relationship history operations"""

    @staticmethod
    async def get_by_contact(
        db: AsyncSession,
        contact_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> List[RelationshipHistory]:
        """Get all history entries for a contact, newest first"""
        query = select(RelationshipHistory).where(
            RelationshipHistory.contact_id == contact_id
        ).options(
            joinedload(RelationshipHistory.changed_by)
        ).offset(skip).limit(limit).order_by(
            RelationshipHistory.created_at.desc()
        )

        result = await db.execute(query)
        return list(result.scalars().unique().all())

    @staticmethod
    def add_system_event(
        db: AsyncSession,
        contact_id: int,
        entry_type: str,
        status: RelationshipStatus,
        user_id: int,
        note: Optional[str] = None,
    ) -> RelationshipHistory:
        """
        Add a system-generated event to the session without committing.
        entry_type should be 'created' or 'edited'.
        The caller is responsible for committing.
        """
        db_history = RelationshipHistory(
            contact_id=contact_id,
            changed_by_user_id=user_id,
            entry_type=entry_type,
            status=status,
            note=note,
            interaction_at=datetime.now(timezone.utc),
        )
        db.add(db_history)
        return db_history

    @staticmethod
    async def create(
        db: AsyncSession,
        contact_id: int,
        history_create: HistoryCreate,
        user: User
    ) -> RelationshipHistory:
        """
        Create a manual interaction entry.
        Also updates the contact's status, last_contacted_at, and next follow-up date.
        """
        db_history = RelationshipHistory(
            contact_id=contact_id,
            changed_by_user_id=user.id,
            entry_type="interaction",
            status=history_create.status,
            note=history_create.note,
            interaction_at=history_create.interaction_at,
            next_contact_due_at=history_create.next_contact_due_at,
        )
        db.add(db_history)

        # Sync contact fields so the contact card stays up to date
        result = await db.execute(select(Contact).where(Contact.id == contact_id))
        contact = result.scalar_one()
        contact.current_relationship_status = history_create.status
        contact.last_contacted_at = history_create.interaction_at
        if history_create.next_contact_due_at is not None:
            contact.next_contact_due_at = history_create.next_contact_due_at

        await db.commit()
        await db.refresh(db_history)

        # Reload with user relationship for the response
        result = await db.execute(
            select(RelationshipHistory).options(
                joinedload(RelationshipHistory.changed_by)
            ).where(RelationshipHistory.id == db_history.id)
        )
        return result.scalar_one()

    @staticmethod
    async def mark_contacted(
        db: AsyncSession,
        contact_id: int,
        user: User
    ) -> RelationshipHistory:
        """
        Quick-action: log an interaction now, clear next_contact_due_at,
        and update last_contacted_at. Does NOT change the relationship status.
        """
        now = datetime.now(timezone.utc)

        result = await db.execute(select(Contact).where(Contact.id == contact_id))
        contact = result.scalar_one()

        db_history = RelationshipHistory(
            contact_id=contact_id,
            changed_by_user_id=user.id,
            entry_type="interaction",
            status=contact.current_relationship_status,
            note="Marked as contacted",
            interaction_at=now,
            next_contact_due_at=None,
        )
        db.add(db_history)

        contact.last_contacted_at = now
        contact.next_contact_due_at = None

        await db.commit()
        await db.refresh(db_history)

        result = await db.execute(
            select(RelationshipHistory).options(
                joinedload(RelationshipHistory.changed_by)
            ).where(RelationshipHistory.id == db_history.id)
        )
        return result.scalar_one()
