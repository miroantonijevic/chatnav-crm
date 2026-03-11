#!/usr/bin/env python3
"""
Simple script to test the CRM application setup
Run this after starting the application to verify everything is working
"""
import asyncio
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.session import AsyncSessionLocal
from app.services.user_service import UserService
from app.services.contact_service import ContactService
from app.core.config import settings


async def test_setup():
    """Test basic application setup"""
    print("CRM Application Setup Test")
    print("=" * 50)

    async with AsyncSessionLocal() as db:
        # Test 1: Check admin user exists
        print("\n1. Testing admin user...")
        admin = await UserService.get_by_email(db, settings.ADMIN_EMAIL)
        if admin:
            print(f"   ✓ Admin user found: {admin.email}")
            print(f"   ✓ Admin ID: {admin.id}")
            print(f"   ✓ Admin role: {admin.role}")
        else:
            print("   ✗ Admin user not found!")
            return False

        # Test 2: Check database connection
        print("\n2. Testing database connection...")
        try:
            users = await UserService.get_all(db, limit=5)
            print(f"   ✓ Database connected, found {len(users)} user(s)")
        except Exception as e:
            print(f"   ✗ Database error: {e}")
            return False

        # Test 3: Check settings
        print("\n3. Checking configuration...")
        print(f"   ✓ Project: {settings.PROJECT_NAME}")
        print(f"   ✓ API Prefix: {settings.API_V1_PREFIX}")
        print(f"   ✓ Database: {settings.DATABASE_URL}")
        print(f"   ✓ Reminders enabled: {settings.REMINDERS_ENABLED}")
        print(f"   ✓ SMTP host: {settings.SMTP_HOST}")

        print("\n" + "=" * 50)
        print("All tests passed! ✓")
        print("\nYou can now:")
        print("1. Access the frontend: http://localhost:5173")
        print("2. Access the API docs: http://localhost:8000/docs")
        print(f"3. Login with: {settings.ADMIN_EMAIL}")
        print("\n")
        return True


if __name__ == "__main__":
    success = asyncio.run(test_setup())
    sys.exit(0 if success else 1)
