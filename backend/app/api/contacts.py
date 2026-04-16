"""
Contacts management endpoints
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.contact import ContactCreate, ContactUpdate, ContactResponse
from app.schemas.history import HistoryCreate, HistoryResponse, MarkContactedRequest
from app.services.contact_service import ContactService
from app.services.history_service import HistoryService
from app.api.dependencies import get_current_active_user
from app.models.user import User, UserRole
from app.models.contact import RelationshipStatus

router = APIRouter(prefix="/contacts", tags=["Contacts"])


@router.get("", response_model=List[ContactResponse])
async def list_contacts(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = Query(None, description="Search in name, company, or email"),
    status: Optional[RelationshipStatus] = Query(None, description="Filter by relationship status"),
    due_only: bool = Query(False, description="Show only contacts with overdue/due follow-ups"),
    upcoming_only: bool = Query(False, description="Show only contacts with upcoming follow-ups"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all contacts (filtered by ownership for regular users)
    """
    contacts = await ContactService.get_all(
        db,
        user=current_user,
        skip=skip,
        limit=limit,
        search=search,
        status=status,
        due_only=due_only,
        upcoming_only=upcoming_only
    )
    return contacts


@router.post("", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    contact_create: ContactCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new contact
    Regular users can only create contacts for themselves
    Admins can create contacts for any user
    """
    contact = await ContactService.create(db, contact_create, current_user)
    return contact


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get contact by ID
    Regular users can only access their own contacts
    """
    contact = await ContactService.get_by_id(db, contact_id, current_user)
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )
    return contact


@router.put("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: int,
    contact_update: ContactUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update contact
    Regular users can only update their own contacts
    """
    contact = await ContactService.get_by_id(db, contact_id, current_user)
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )

    updated_contact = await ContactService.update(db, contact, contact_update, current_user)
    return updated_contact


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete contact
    Only the owner or an admin can delete contacts
    """
    contact = await ContactService.get_by_id(db, contact_id, current_user)
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )

    # Check ownership: only owner or admin can delete
    if current_user.role != UserRole.ADMIN and contact.owner_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own contacts"
        )

    await ContactService.delete(db, contact)
    return None


@router.get("/{contact_id}/history", response_model=List[HistoryResponse])
async def get_contact_history(
    contact_id: int,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get relationship history for a contact
    """
    # Verify access to contact
    contact = await ContactService.get_by_id(db, contact_id, current_user)
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )

    history = await HistoryService.get_by_contact(db, contact_id, skip=skip, limit=limit)
    return history


@router.post("/{contact_id}/history", response_model=HistoryResponse, status_code=status.HTTP_201_CREATED)
async def create_history_entry(
    contact_id: int,
    history_create: HistoryCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new history entry for a contact
    """
    # Verify access to contact
    contact = await ContactService.get_by_id(db, contact_id, current_user)
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )

    history = await HistoryService.create(db, contact_id, history_create, current_user)
    return history


@router.post("/{contact_id}/mark-contacted", response_model=HistoryResponse, status_code=status.HTTP_201_CREATED)
async def mark_contact_contacted(
    contact_id: int,
    body: MarkContactedRequest = MarkContactedRequest(),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Quick action: log an interaction now and clear the next follow-up date.
    """
    contact = await ContactService.get_by_id(db, contact_id, current_user)
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )

    history = await HistoryService.mark_contacted(
        db, contact_id, current_user,
        note=body.note,
        status=body.status,
        interaction_at=body.interaction_at,
        next_contact_due_at=body.next_contact_due_at,
    )
    return history
