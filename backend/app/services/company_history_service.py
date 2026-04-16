"""
Company history service
"""
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.company import Company, CompanyHistory
from app.models.contact import RelationshipStatus
from app.models.user import User
from app.schemas.company import CompanyHistoryCreate


class CompanyHistoryService:
    """Service class for company history operations"""

    @staticmethod
    async def get_by_company(
        db: AsyncSession,
        company_id: int,
        skip: int = 0,
        limit: int = 100
    ) -> List[CompanyHistory]:
        """Get all history entries for a company, newest first"""
        query = select(CompanyHistory).where(
            CompanyHistory.company_id == company_id
        ).options(
            joinedload(CompanyHistory.changed_by)
        ).offset(skip).limit(limit).order_by(
            CompanyHistory.created_at.desc()
        )

        result = await db.execute(query)
        return list(result.scalars().unique().all())

    @staticmethod
    def add_system_event(
        db: AsyncSession,
        company_id: int,
        entry_type: str,
        status: RelationshipStatus,
        user_id: int,
        note: Optional[str] = None,
    ) -> CompanyHistory:
        """
        Add a system-generated event to the session without committing.
        entry_type should be 'created' or 'edited'.
        The caller is responsible for committing.
        """
        db_history = CompanyHistory(
            company_id=company_id,
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
        company_id: int,
        history_create: CompanyHistoryCreate,
        user: User
    ) -> CompanyHistory:
        """
        Create a manual interaction entry.
        Also updates the company's status, last_contacted_at, and next follow-up date.
        """
        db_history = CompanyHistory(
            company_id=company_id,
            changed_by_user_id=user.id,
            entry_type="interaction",
            status=history_create.status,
            note=history_create.note,
            interaction_at=history_create.interaction_at,
            next_contact_due_at=history_create.next_contact_due_at,
        )
        db.add(db_history)

        # Sync company fields so the company card stays up to date
        result = await db.execute(select(Company).where(Company.id == company_id))
        company = result.scalar_one()
        company.current_relationship_status = history_create.status
        company.last_contacted_at = history_create.interaction_at
        if history_create.next_contact_due_at is not None:
            company.next_contact_due_at = history_create.next_contact_due_at

        await db.commit()
        await db.refresh(db_history)

        # Reload with user relationship for the response
        result = await db.execute(
            select(CompanyHistory).options(
                joinedload(CompanyHistory.changed_by)
            ).where(CompanyHistory.id == db_history.id)
        )
        return result.scalar_one()

    @staticmethod
    async def mark_contacted(
        db: AsyncSession,
        company_id: int,
        user: User
    ) -> CompanyHistory:
        """
        Quick-action: log an interaction now, clear next_contact_due_at,
        and update last_contacted_at. Does NOT change the relationship status.
        """
        now = datetime.now(timezone.utc)

        result = await db.execute(select(Company).where(Company.id == company_id))
        company = result.scalar_one()

        db_history = CompanyHistory(
            company_id=company_id,
            changed_by_user_id=user.id,
            entry_type="interaction",
            status=company.current_relationship_status,
            note="Marked as contacted",
            interaction_at=now,
            next_contact_due_at=None,
        )
        db.add(db_history)

        company.last_contacted_at = now
        company.next_contact_due_at = None

        await db.commit()
        await db.refresh(db_history)

        result = await db.execute(
            select(CompanyHistory).options(
                joinedload(CompanyHistory.changed_by)
            ).where(CompanyHistory.id == db_history.id)
        )
        return result.scalar_one()
