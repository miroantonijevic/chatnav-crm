"""
Company service for business logic
"""
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy import select, or_, and_, exists, func, asc, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, aliased

from app.models.company import Company, CompanyContactDetail, CompanyHistory
from app.models.contact import RelationshipStatus
from app.models.user import User
from app.schemas.company import CompanyCreate, CompanyUpdate
from app.services.company_history_service import CompanyHistoryService


class CompanyService:
    """Service class for company-related operations"""

    @staticmethod
    async def get_by_id(db: AsyncSession, company_id: int, user: User) -> Optional[Company]:
        """Get company by ID - all users can view all companies"""
        query = select(Company).options(
            joinedload(Company.owner),
            joinedload(Company.created_by),
            joinedload(Company.contact_details),
        ).where(Company.id == company_id, Company.is_deleted == False)

        result = await db.execute(query)
        return result.unique().scalar_one_or_none()

    @staticmethod
    def _filter_conditions(
        search: Optional[str] = None,
        due_only: bool = False,
        upcoming_only: bool = False,
    ) -> list:
        """Build the list of WHERE conditions shared by get_all and count_all"""
        conditions = [Company.is_deleted == False]

        if search:
            # Each whitespace-separated word must match somewhere (any field) -
            # this lets multi-word queries hit different columns (e.g. name + industry).
            words = [w for w in search.split() if w]
            word_conditions = []
            for word in words:
                pattern = f"%{word}%"
                owner_matches = exists().where(
                    and_(
                        User.id == Company.owner_user_id,
                        or_(User.full_name.ilike(pattern), User.email.ilike(pattern))
                    )
                )
                created_by_matches = exists().where(
                    and_(
                        User.id == Company.created_by_user_id,
                        or_(User.full_name.ilike(pattern), User.email.ilike(pattern))
                    )
                )
                detail_matches = exists().where(
                    and_(
                        CompanyContactDetail.company_id == Company.id,
                        or_(
                            CompanyContactDetail.value.ilike(pattern),
                            CompanyContactDetail.label.ilike(pattern),
                        )
                    )
                )
                word_conditions.append(
                    or_(
                        Company.name.ilike(pattern),
                        Company.industry.ilike(pattern),
                        Company.notes.ilike(pattern),
                        owner_matches,
                        created_by_matches,
                        detail_matches,
                    )
                )
            if word_conditions:
                conditions.append(and_(*word_conditions))

        now = datetime.now(timezone.utc)

        if due_only:
            conditions.append(
                and_(
                    Company.next_contact_due_at.isnot(None),
                    Company.next_contact_due_at <= now
                )
            )

        if upcoming_only:
            conditions.append(
                and_(
                    Company.next_contact_due_at.isnot(None),
                    Company.next_contact_due_at > now
                )
            )

        return conditions

    @staticmethod
    def _apply_sort(query, sort_by: str, sort_order: str):
        """Apply a whitelisted sort column to the query. Returns None if sort_by is unrecognized."""
        direction = desc if sort_order == "desc" else asc

        if sort_by == "name":
            return query.order_by(direction(func.lower(Company.name)))
        if sort_by == "industry":
            return query.order_by(direction(func.lower(Company.industry)))
        if sort_by == "owner":
            owner_alias = aliased(User)
            return query.outerjoin(owner_alias, Company.owner_user_id == owner_alias.id).order_by(
                direction(func.lower(owner_alias.full_name))
            )
        if sort_by == "created_by":
            created_by_alias = aliased(User)
            return query.outerjoin(created_by_alias, Company.created_by_user_id == created_by_alias.id).order_by(
                direction(func.lower(created_by_alias.full_name))
            )
        if sort_by == "status":
            return query.order_by(direction(Company.current_relationship_status))
        if sort_by == "next_contact_due_at":
            return query.order_by(direction(Company.next_contact_due_at))
        if sort_by == "created_at":
            return query.order_by(direction(Company.created_at))
        return None

    @staticmethod
    async def get_all(
        db: AsyncSession,
        user: User,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        due_only: bool = False,
        upcoming_only: bool = False,
        sort_by: Optional[str] = None,
        sort_order: str = "asc",
    ) -> List[Company]:
        """Get all companies with filtering and pagination"""
        conditions = CompanyService._filter_conditions(search, due_only, upcoming_only)

        query = select(Company).options(
            joinedload(Company.owner),
            joinedload(Company.created_by),
            joinedload(Company.contact_details),
        ).where(*conditions)

        sorted_query = CompanyService._apply_sort(query, sort_by, sort_order) if sort_by else None
        if sorted_query is not None:
            query = sorted_query
        elif upcoming_only:
            query = query.order_by(Company.next_contact_due_at.asc())
        else:
            query = query.order_by(Company.created_at.desc())

        query = query.offset(skip).limit(limit)

        result = await db.execute(query)
        return list(result.unique().scalars().all())

    @staticmethod
    async def get_stats(db: AsyncSession, user: User) -> dict:
        """Get overall company counts: total, due now, and breakdown by status"""
        now = datetime.now(timezone.utc)
        base_condition = Company.is_deleted == False

        total_result = await db.execute(select(func.count(Company.id)).where(base_condition))
        total = total_result.scalar_one()

        due_result = await db.execute(select(func.count(Company.id)).where(
            base_condition,
            Company.next_contact_due_at.isnot(None),
            Company.next_contact_due_at <= now,
        ))
        due_now = due_result.scalar_one()

        status_result = await db.execute(
            select(Company.current_relationship_status, func.count(Company.id))
            .where(base_condition)
            .group_by(Company.current_relationship_status)
        )
        by_status = {status.value: count for status, count in status_result.all()}

        return {"total": total, "due_now": due_now, "by_status": by_status}

    @staticmethod
    async def count_all(
        db: AsyncSession,
        user: User,
        search: Optional[str] = None,
        due_only: bool = False,
        upcoming_only: bool = False,
    ) -> int:
        """Count companies matching the same filters as get_all, ignoring skip/limit"""
        conditions = CompanyService._filter_conditions(search, due_only, upcoming_only)
        query = select(func.count(Company.id)).where(*conditions)
        result = await db.execute(query)
        return result.scalar_one()

    @staticmethod
    async def get_all_simple(db: AsyncSession) -> List[Company]:
        """Get all companies ordered by name (for dropdowns)"""
        query = select(Company).where(Company.is_deleted == False).order_by(Company.name.asc())
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def create(db: AsyncSession, company_create: CompanyCreate, user: User) -> Company:
        """Create a new company and auto-log a 'created' history entry"""
        owner_id = company_create.owner_user_id if company_create.owner_user_id else user.id

        db_company = Company(
            name=company_create.name,
            industry=company_create.industry,
            notes=company_create.notes,
            owner_user_id=owner_id,
            created_by_user_id=user.id,
            current_relationship_status=company_create.current_relationship_status,
            reminders_enabled=company_create.reminders_enabled,
            next_contact_due_at=company_create.next_contact_due_at,
        )

        db.add(db_company)
        await db.flush()  # Get the ID without committing

        # Create contact detail rows
        for detail in company_create.contact_details:
            db_detail = CompanyContactDetail(
                company_id=db_company.id,
                type=detail.type,
                value=detail.value,
                label=detail.label,
            )
            db.add(db_detail)

        CompanyHistoryService.add_system_event(
            db,
            company_id=db_company.id,
            entry_type="created",
            status=db_company.current_relationship_status,
            user_id=user.id,
            note="Company created",
        )

        await db.commit()
        await db.refresh(db_company)

        result = await db.execute(
            select(Company).options(
                joinedload(Company.owner),
                joinedload(Company.created_by),
                joinedload(Company.contact_details),
            ).where(Company.id == db_company.id)
        )
        return result.unique().scalar_one()

    @staticmethod
    async def update(
        db: AsyncSession,
        company: Company,
        company_update: CompanyUpdate,
        user: User
    ) -> Company:
        """Update a company and auto-log an 'edited' history entry"""
        # Apply scalar fields
        scalar_fields = [
            'name', 'industry', 'notes', 'owner_user_id',
            'current_relationship_status', 'reminders_enabled', 'next_contact_due_at',
        ]
        update_data = company_update.model_dump(exclude_unset=True)
        for field in scalar_fields:
            if field in update_data:
                setattr(company, field, update_data[field])

        # If contact_details provided, replace all existing
        if company_update.contact_details is not None:
            # Delete existing details
            existing_result = await db.execute(
                select(CompanyContactDetail).where(CompanyContactDetail.company_id == company.id)
            )
            for detail in existing_result.scalars().all():
                await db.delete(detail)
            await db.flush()

            # Insert new details
            for detail in company_update.contact_details:
                db_detail = CompanyContactDetail(
                    company_id=company.id,
                    type=detail.type,
                    value=detail.value,
                    label=detail.label,
                )
                db.add(db_detail)

        CompanyHistoryService.add_system_event(
            db,
            company_id=company.id,
            entry_type="edited",
            status=company.current_relationship_status,
            user_id=user.id,
            note="Company details updated",
        )

        await db.commit()
        await db.refresh(company)

        result = await db.execute(
            select(Company).options(
                joinedload(Company.owner),
                joinedload(Company.created_by),
                joinedload(Company.contact_details),
            ).where(Company.id == company.id)
        )
        return result.unique().scalar_one()

    @staticmethod
    async def delete(db: AsyncSession, company: Company) -> None:
        """Soft-delete a company (keeps history/records, just hides it from normal views)"""
        company.is_deleted = True
        company.deleted_at = datetime.utcnow()
        await db.commit()

    @staticmethod
    async def get_due_companies(db: AsyncSession) -> List[Company]:
        """Get all companies with due follow-ups (reminders enabled)"""
        query = select(Company).where(
            and_(
                Company.next_contact_due_at.isnot(None),
                Company.next_contact_due_at <= datetime.now(timezone.utc),
                Company.reminders_enabled == True,
                Company.is_deleted == False
            )
        ).options(
            joinedload(Company.owner),
            joinedload(Company.created_by),
        )

        result = await db.execute(query)
        return list(result.unique().scalars().all())
