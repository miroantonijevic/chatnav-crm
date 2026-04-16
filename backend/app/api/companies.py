"""
Companies management endpoints
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.company import (
    CompanyCreate, CompanyUpdate, CompanyResponse,
    CompanyHistoryCreate, CompanyHistoryResponse, CompanyListItem,
)
from app.schemas.history import MarkContactedRequest
from app.services.company_service import CompanyService
from app.services.company_history_service import CompanyHistoryService
from app.api.dependencies import get_current_active_user
from app.models.user import User, UserRole

router = APIRouter(prefix="/companies", tags=["Companies"])


@router.get("/list/simple", response_model=List[CompanyListItem])
async def list_companies_simple(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a simple list of all companies (id + name) for dropdowns.
    """
    companies = await CompanyService.get_all_simple(db)
    return companies


@router.get("", response_model=List[CompanyResponse])
async def list_companies(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = Query(None, description="Search in name or industry"),
    due_only: bool = False,
    upcoming_only: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all companies with optional search and pagination.
    """
    companies = await CompanyService.get_all(
        db,
        user=current_user,
        skip=skip,
        limit=limit,
        search=search,
        due_only=due_only,
        upcoming_only=upcoming_only,
    )
    return companies


@router.post("", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    company_create: CompanyCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new company.
    """
    company = await CompanyService.create(db, company_create, current_user)
    return company


@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get company by ID.
    """
    company = await CompanyService.get_by_id(db, company_id, current_user)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    return company


@router.put("/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: int,
    company_update: CompanyUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a company.
    """
    company = await CompanyService.get_by_id(db, company_id, current_user)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )

    updated_company = await CompanyService.update(db, company, company_update, current_user)
    return updated_company


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company(
    company_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a company. Only the owner or an admin can delete.
    """
    company = await CompanyService.get_by_id(db, company_id, current_user)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )

    # Check ownership: only owner or admin can delete
    if current_user.role != UserRole.ADMIN and company.owner_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own companies"
        )

    await CompanyService.delete(db, company)
    return None


@router.get("/{company_id}/history", response_model=List[CompanyHistoryResponse])
async def get_company_history(
    company_id: int,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get history for a company.
    """
    company = await CompanyService.get_by_id(db, company_id, current_user)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )

    history = await CompanyHistoryService.get_by_company(db, company_id, skip=skip, limit=limit)
    return history


@router.post("/{company_id}/history", response_model=CompanyHistoryResponse, status_code=status.HTTP_201_CREATED)
async def create_company_history_entry(
    company_id: int,
    history_create: CompanyHistoryCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new history entry for a company.
    """
    company = await CompanyService.get_by_id(db, company_id, current_user)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )

    history = await CompanyHistoryService.create(db, company_id, history_create, current_user)
    return history


@router.post("/{company_id}/mark-contacted", response_model=CompanyHistoryResponse, status_code=status.HTTP_201_CREATED)
async def mark_company_contacted(
    company_id: int,
    body: MarkContactedRequest = MarkContactedRequest(),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Quick action: log an interaction now and clear the next follow-up date.
    """
    company = await CompanyService.get_by_id(db, company_id, current_user)
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )

    history = await CompanyHistoryService.mark_contacted(
        db, company_id, current_user,
        note=body.note,
        status=body.status,
        interaction_at=body.interaction_at,
        next_contact_due_at=body.next_contact_due_at,
    )
    return history
