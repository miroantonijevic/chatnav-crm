"""
Bootstrap utilities for initial setup
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.core.config import settings
from app.core.security import get_password_hash


async def create_admin_user(db: AsyncSession) -> User:
    """
    Create the bootstrap admin user if it doesn't exist
    """
    # Check if admin already exists
    result = await db.execute(
        select(User).where(User.email == settings.ADMIN_EMAIL)
    )
    existing_user = result.scalar_one_or_none()

    if existing_user:
        print(f"Admin user {settings.ADMIN_EMAIL} already exists")
        return existing_user

    # Create admin user
    admin_user = User(
        email=settings.ADMIN_EMAIL,
        full_name=settings.ADMIN_FULL_NAME,
        hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
        role=UserRole.ADMIN,
        is_active=True,
        must_change_password=True,
    )

    db.add(admin_user)
    await db.commit()
    await db.refresh(admin_user)

    print(f"Created admin user: {admin_user.email}")
    return admin_user
