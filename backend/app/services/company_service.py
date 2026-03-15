"""
Company service for business logic
"""
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy import select, or_, and_, exists
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

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
        ).where(Company.id == company_id)

        result = await db.execute(query)
        return result.unique().scalar_one_or_none()

    @staticmethod
    async def get_all(
        db: AsyncSession,
        user: User,
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        due_only: bool = False,
        upcoming_only: bool = False,
    ) -> List[Company]:
        """Get all companies with filtering and pagination"""
        query = select(Company).options(
            joinedload(Company.owner),
            joinedload(Company.created_by),
            joinedload(Company.contact_details),
        )

        if search:
            search_pattern = f"%{search}%"
            owner_matches = exists().where(
                and_(
                    User.id == Company.owner_user_id,
                    or_(User.full_name.ilike(search_pattern), User.email.ilike(search_pattern))
                )
            )
            created_by_matches = exists().where(
                and_(
                    User.id == Company.created_by_user_id,
                    or_(User.full_name.ilike(search_pattern), User.email.ilike(search_pattern))
                )
            )
            detail_matches = exists().where(
                and_(
                    CompanyContactDetail.company_id == Company.id,
                    CompanyContactDetail.value.ilike(search_pattern)
                )
            )
            query = query.where(
                or_(
                    Company.name.ilike(search_pattern),
                    Company.industry.ilike(search_pattern),
                    owner_matches,
                    created_by_matches,
                    detail_matches,
                )
            )

        now = datetime.now(timezone.utc)

        if due_only:
            query = query.where(
                and_(
                    Company.next_contact_due_at.isnot(None),
                    Company.next_contact_due_at <= now
                )
            )

        if upcoming_only:
            query = query.where(
                and_(
                    Company.next_contact_due_at.isnot(None),
                    Company.next_contact_due_at > now
                )
            )
            query = query.order_by(Company.next_contact_due_at.asc())
        else:
            query = query.order_by(Company.created_at.desc())

        query = query.offset(skip).limit(limit)

        result = await db.execute(query)
        return list(result.unique().scalars().all())

    @staticmethod
    async def get_all_simple(db: AsyncSession) -> List[Company]:
        """Get all companies ordered by name (for dropdowns)"""
        query = select(Company).order_by(Company.name.asc())
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
        """Delete a company"""
        await db.delete(company)
        await db.commit()

    @staticmethod
    async def get_due_companies(db: AsyncSession) -> List[Company]:
        """Get all companies with due follow-ups (reminders enabled)"""
        query = select(Company).where(
            and_(
                Company.next_contact_due_at.isnot(None),
                Company.next_contact_due_at <= datetime.now(timezone.utc),
                Company.reminders_enabled == True
            )
        ).options(
            joinedload(Company.owner),
            joinedload(Company.created_by),
        )

        result = await db.execute(query)
        return list(result.unique().scalars().all())
