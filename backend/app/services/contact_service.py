"""
Contact service for business logic
"""
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy import select, or_, and_, exists, func, asc, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, aliased

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
        ).where(Contact.id == contact_id, Contact.is_deleted == False)

        result = await db.execute(query)
        return result.unique().scalar_one_or_none()

    @staticmethod
    def _filter_conditions(
        search: Optional[str] = None,
        status: Optional[RelationshipStatus] = None,
        due_only: bool = False,
        upcoming_only: bool = False,
    ) -> list:
        """Build the list of WHERE conditions shared by get_all and count_all"""
        conditions = [Contact.is_deleted == False]

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
            conditions.append(
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
            conditions.append(Contact.current_relationship_status == status)

        now = datetime.now(timezone.utc)

        if due_only:
            conditions.append(
                and_(
                    Contact.next_contact_due_at.isnot(None),
                    Contact.next_contact_due_at <= now
                )
            )

        if upcoming_only:
            conditions.append(
                and_(
                    Contact.next_contact_due_at.isnot(None),
                    Contact.next_contact_due_at > now
                )
            )

        return conditions

    @staticmethod
    def _apply_sort(query, sort_by: str, sort_order: str):
        """Apply a whitelisted sort column to the query. Returns None if sort_by is unrecognized."""
        direction = desc if sort_order == "desc" else asc

        if sort_by == "name":
            return query.order_by(direction(Contact.first_name), direction(Contact.last_name))
        if sort_by == "company":
            company_alias = aliased(Company)
            return query.outerjoin(company_alias, Contact.company_id == company_alias.id).order_by(
                direction(func.lower(company_alias.name))
            )
        if sort_by == "owner":
            owner_alias = aliased(User)
            return query.outerjoin(owner_alias, Contact.owner_user_id == owner_alias.id).order_by(
                direction(func.lower(owner_alias.full_name))
            )
        if sort_by == "created_by":
            created_by_alias = aliased(User)
            return query.outerjoin(created_by_alias, Contact.created_by_user_id == created_by_alias.id).order_by(
                direction(func.lower(created_by_alias.full_name))
            )
        if sort_by == "status":
            return query.order_by(direction(Contact.current_relationship_status))
        if sort_by == "next_contact_due_at":
            return query.order_by(direction(Contact.next_contact_due_at))
        if sort_by == "created_at":
            return query.order_by(direction(Contact.created_at))
        return None

    @staticmethod
    async def get_all(
        db: AsyncSession,
        user: User,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        status: Optional[RelationshipStatus] = None,
        due_only: bool = False,
        upcoming_only: bool = False,
        sort_by: Optional[str] = None,
        sort_order: str = "asc",
    ) -> List[Contact]:
        """Get all contacts with filtering and pagination - all users can see all contacts"""
        conditions = ContactService._filter_conditions(search, status, due_only, upcoming_only)

        query = select(Contact).options(
            joinedload(Contact.owner),
            joinedload(Contact.created_by),
            joinedload(Contact.contact_details),
            joinedload(Contact.company)
        ).where(*conditions)

        sorted_query = ContactService._apply_sort(query, sort_by, sort_order) if sort_by else None
        if sorted_query is not None:
            query = sorted_query
        elif upcoming_only:
            query = query.order_by(Contact.next_contact_due_at.asc())
        else:
            query = query.order_by(Contact.created_at.desc())

        query = query.offset(skip).limit(limit)

        result = await db.execute(query)
        return list(result.unique().scalars().all())

    @staticmethod
    async def get_stats(db: AsyncSession, user: User) -> dict:
        """Get overall contact counts: total, due now, and breakdown by status"""
        now = datetime.now(timezone.utc)
        base_condition = Contact.is_deleted == False

        total_result = await db.execute(select(func.count(Contact.id)).where(base_condition))
        total = total_result.scalar_one()

        due_result = await db.execute(select(func.count(Contact.id)).where(
            base_condition,
            Contact.next_contact_due_at.isnot(None),
            Contact.next_contact_due_at <= now,
        ))
        due_now = due_result.scalar_one()

        status_result = await db.execute(
            select(Contact.current_relationship_status, func.count(Contact.id))
            .where(base_condition)
            .group_by(Contact.current_relationship_status)
        )
        by_status = {status.value: count for status, count in status_result.all()}

        return {"total": total, "due_now": due_now, "by_status": by_status}

    @staticmethod
    async def count_all(
        db: AsyncSession,
        user: User,
        search: Optional[str] = None,
        status: Optional[RelationshipStatus] = None,
        due_only: bool = False,
        upcoming_only: bool = False
    ) -> int:
        """Count contacts matching the same filters as get_all, ignoring skip/limit"""
        conditions = ContactService._filter_conditions(search, status, due_only, upcoming_only)
        query = select(func.count(Contact.id)).where(*conditions)
        result = await db.execute(query)
        return result.scalar_one()

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
        """Soft-delete a contact (keeps history/records, just hides it from normal views)"""
        contact.is_deleted = True
        contact.deleted_at = datetime.utcnow()
        await db.commit()

    @staticmethod
    async def get_due_contacts(db: AsyncSession) -> List[Contact]:
        """Get all contacts with due follow-ups (reminders enabled)"""
        query = select(Contact).where(
            and_(
                Contact.next_contact_due_at.isnot(None),
                Contact.next_contact_due_at <= datetime.now(timezone.utc),
                Contact.reminders_enabled == True,
                Contact.is_deleted == False
            )
        ).options(
            joinedload(Contact.owner),
            joinedload(Contact.created_by),
            joinedload(Contact.company),
        )

        result = await db.execute(query)
        return list(result.unique().scalars().all())
