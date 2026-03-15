"""
Contact service for business logic
"""
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy import select, or_, and_, exists
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.contact import Contact, ContactContactDetail, RelationshipStatus
from app.models.company import Company
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
            joinedload(Contact.created_by),
            joinedload(Contact.contact_details),
            joinedload(Contact.company)
        ).where(Contact.id == contact_id)

        result = await db.execute(query)
        return result.unique().scalar_one_or_none()

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
            joinedload(Contact.created_by),
            joinedload(Contact.contact_details),
            joinedload(Contact.company)
        )

        if search:
            search_pattern = f"%{search}%"
            owner_matches = exists().where(
                and_(
                    User.id == Contact.owner_user_id,
                    or_(User.full_name.ilike(search_pattern), User.email.ilike(search_pattern))
                )
            )
            created_by_matches = exists().where(
                and_(
                    User.id == Contact.created_by_user_id,
                    or_(User.full_name.ilike(search_pattern), User.email.ilike(search_pattern))
                )
            )
            company_matches = exists().where(
                and_(
                    Company.id == Contact.company_id,
                    Company.name.ilike(search_pattern)
                )
            )
            detail_matches = exists().where(
                and_(
                    ContactContactDetail.contact_id == Contact.id,
                    ContactContactDetail.value.ilike(search_pattern)
                )
            )
            query = query.where(
                or_(
                    Contact.first_name.ilike(search_pattern),
                    Contact.last_name.ilike(search_pattern),
                    owner_matches,
                    created_by_matches,
                    company_matches,
                    detail_matches,
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
            company_id=contact_create.company_id,
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
        await db.flush()

        for detail in contact_create.contact_details:
            db.add(ContactContactDetail(
                contact_id=db_contact.id,
                type=detail.type,
                value=detail.value,
                label=detail.label,
            ))

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
                joinedload(Contact.created_by),
                joinedload(Contact.contact_details),
                joinedload(Contact.company)
            ).where(Contact.id == db_contact.id)
        )
        return result.unique().scalar_one()

    @staticmethod
    async def update(
        db: AsyncSession,
        contact: Contact,
        contact_update: ContactUpdate,
        user: User
    ) -> Contact:
        """Update a contact and auto-log an 'edited' history entry"""
        update_data = contact_update.model_dump(exclude_unset=True)
        contact_details = update_data.pop('contact_details', None)

        for field, value in update_data.items():
            setattr(contact, field, value)

        if contact_details is not None:
            for existing in list(contact.contact_details):
                await db.delete(existing)
            for detail in contact_details:
                db.add(ContactContactDetail(
                    contact_id=contact.id,
                    type=detail['type'],
                    value=detail['value'],
                    label=detail.get('label'),
                ))

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
                joinedload(Contact.created_by),
                joinedload(Contact.contact_details),
                joinedload(Contact.company)
            ).where(Contact.id == contact.id)
        )
        return result.unique().scalar_one()

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
            joinedload(Contact.created_by),
            joinedload(Contact.company),
        )

        result = await db.execute(query)
        return list(result.unique().scalars().all())
