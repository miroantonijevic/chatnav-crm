"""
Contact service for business logic
"""
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.contact import Contact, RelationshipStatus
from app.models.user import User, UserRole
from app.schemas.contact import ContactCreate, ContactUpdate
from app.services.history_service import HistoryService


class ContactService:
    """Service class for contact-related operations"""

    @staticmethod
    async def get_by_id(db: AsyncSession, contact_id: int, user: User) -> Optional[Contact]:
        """Get contact by ID - all users can view all contacts"""
        query = select(Contact).options(
            joinedload(Contact.owner),
            joinedload(Contact.created_by)
        ).where(Contact.id == contact_id)

        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_all(
        db: AsyncSession,
        user: User,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        status: Optional[RelationshipStatus] = None,
        due_only: bool = False,
        upcoming_only: bool = False
    ) -> List[Contact]:
        """Get all contacts with filtering and pagination - all users can see all contacts"""
        query = select(Contact).options(
            joinedload(Contact.owner),
            joinedload(Contact.created_by)
        )

        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    Contact.first_name.ilike(search_pattern),
                    Contact.last_name.ilike(search_pattern),
                    Contact.company.ilike(search_pattern),
                    Contact.email.ilike(search_pattern)
                )
            )

        if status:
            query = query.where(Contact.current_relationship_status == status)

        now = datetime.now(timezone.utc)

        if due_only:
            query = query.where(
                and_(
                    Contact.next_contact_due_at.isnot(None),
                    Contact.next_contact_due_at <= now
                )
            )

        if upcoming_only:
            query = query.where(
                and_(
                    Contact.next_contact_due_at.isnot(None),
                    Contact.next_contact_due_at > now
                )
            )
            query = query.order_by(Contact.next_contact_due_at.asc())
        else:
            query = query.order_by(Contact.created_at.desc())

        query = query.offset(skip).limit(limit)

        result = await db.execute(query)
        return list(result.unique().scalars().all())

    @staticmethod
    async def create(db: AsyncSession, contact_create: ContactCreate, user: User) -> Contact:
        """Create a new contact and auto-log a 'created' history entry"""
        owner_id = contact_create.owner_user_id if contact_create.owner_user_id else user.id

        db_contact = Contact(
            first_name=contact_create.first_name,
            last_name=contact_create.last_name,
            company=contact_create.company,
            job_title=contact_create.job_title,
            email=contact_create.email,
            phone=contact_create.phone,
            notes=contact_create.notes,
            owner_user_id=owner_id,
            created_by_user_id=user.id,
            current_relationship_status=contact_create.current_relationship_status,
            last_contacted_at=contact_create.last_contacted_at,
            next_contact_due_at=contact_create.next_contact_due_at,
            reminders_enabled=contact_create.reminders_enabled,
        )

        db.add(db_contact)
        await db.flush()  # Get the ID without committing

        HistoryService.add_system_event(
            db,
            contact_id=db_contact.id,
            entry_type="created",
            status=db_contact.current_relationship_status,
            user_id=user.id,
            note="Contact created",
        )

        await db.commit()
        await db.refresh(db_contact)

        result = await db.execute(
            select(Contact).options(
                joinedload(Contact.owner),
                joinedload(Contact.created_by)
            ).where(Contact.id == db_contact.id)
        )
        return result.scalar_one()

    @staticmethod
    async def update(
        db: AsyncSession,
        contact: Contact,
        contact_update: ContactUpdate,
        user: User
    ) -> Contact:
        """Update a contact and auto-log an 'edited' history entry"""
        update_data = contact_update.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(contact, field, value)

        HistoryService.add_system_event(
            db,
            contact_id=contact.id,
            entry_type="edited",
            status=contact.current_relationship_status,
            user_id=user.id,
            note="Contact details updated",
        )

        await db.commit()
        await db.refresh(contact)

        result = await db.execute(
            select(Contact).options(
                joinedload(Contact.owner),
                joinedload(Contact.created_by)
            ).where(Contact.id == contact.id)
        )
        return result.scalar_one()

    @staticmethod
    async def delete(db: AsyncSession, contact: Contact) -> None:
        """Delete a contact"""
        await db.delete(contact)
        await db.commit()

    @staticmethod
    async def get_due_contacts(db: AsyncSession) -> List[Contact]:
        """Get all contacts with due follow-ups (reminders enabled)"""
        query = select(Contact).where(
            and_(
                Contact.next_contact_due_at.isnot(None),
                Contact.next_contact_due_at <= datetime.now(timezone.utc),
                Contact.reminders_enabled == True
            )
        ).options(
            joinedload(Contact.owner),
            joinedload(Contact.created_by)
        )

        result = await db.execute(query)
        return list(result.unique().scalars().all())
