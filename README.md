# CRM Application

A full-stack CRM web application with Python FastAPI backend, React frontend, and SQLite database.

## Features

- **User Authentication**: Email/password login with JWT tokens
- **Role-Based Access Control**: Admin and regular user roles
- **Contact Management**: Full CRUD operations for contacts
- **Relationship Tracking**: Track contact status and interaction history
- **Follow-up Reminders**: Automated email notifications for due follow-ups
- **Email Notifications**: SMTP-based notifications to contact owners and admins
- **Dockerized Setup**: Easy local development with Docker Compose

## Tech Stack

### Backend
- FastAPI (async Python web framework)
- SQLAlchemy 2.0 (async ORM)
- SQLite with aiosqlite
- Alembic (database migrations)
- JWT authentication
- Argon2 password hashing
- APScheduler (background tasks)
- aiosmtplib (async email sending)

### Frontend
- React 18
- TypeScript
- React Router
- Vite

### Infrastructure
- Docker & Docker Compose
- MailHog (local email testing)

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Git

### 1. Clone the Repository

```bash
git clone <repository-url>
cd chatnav-crm
```

### 2. Configure Environment

Backend:
```bash
cd backend
cp .env.example .env
# Edit .env and set SECRET_KEY and other settings
```

Frontend:
```bash
cd frontend
cp .env.example .env
# Edit .env if needed
```

### 3. Start the Application

```bash
docker compose up --build
```

This will start:
- Backend API: http://localhost:8000
- Frontend UI: http://localhost:5173
- MailHog UI: http://localhost:8025 (for viewing test emails)

### 4. Access the Application

- Open http://localhost:5173 in your browser
- Default admin credentials:
  - Email: `admin@example.com`
  - Password: `admin123` (or as configured in .env)

You will be prompted to change the password on first login.

## API Documentation

Once the backend is running, access the interactive API docs at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Project Structure

```
/crm-app
  /backend
    /app
      /api          - API endpoints
      /core         - Core configuration
      /db           - Database setup
      /models       - SQLAlchemy models
      /schemas      - Pydantic schemas
      /services     - Business logic
      /jobs         - Background tasks
      /utils        - Utilities
      main.py       - FastAPI application
    /alembic        - Database migrations
    /tests          - Backend tests
    requirements.txt
    Dockerfile
    .env.example
  /frontend
    /src
      /api          - API client
      /components   - React components
      /contexts     - React contexts
      /hooks        - Custom hooks
      /layouts      - Page layouts
      /pages        - Page components
      /routes       - Routing configuration
      /types        - TypeScript types
      /utils        - Utilities
    package.json
    Dockerfile
    .env.example
  docker-compose.yml
  README.md
```

## Development

### Backend Development

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env
uvicorn app.main:app --reload
```

### Frontend Development

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env
npm run dev
```

### Database Migrations

Create a new migration:
```bash
cd backend
alembic revision --autogenerate -m "description"
```

Apply migrations:
```bash
alembic upgrade head
```

## User Roles

### Admin
- View and manage all users
- View and edit all contacts
- Access system settings and reminders
- Receive notifications for all due follow-ups

### Regular User
- View only their own contacts
- Create contacts assigned to themselves
- Edit only their own contacts
- Receive notifications for their own due follow-ups

## Reminders System

The application includes an automated reminder system that:
- Runs periodically (configurable interval)
- Checks for contacts with due follow-ups
- Sends email notifications to contact owners and all admins
- Prevents duplicate notifications for the same due date

Configure reminders in backend/.env:
- `REMINDERS_ENABLED`: Enable/disable the reminder system
- `REMINDER_CHECK_INTERVAL_MINUTES`: How often to check for due contacts
- `REMINDER_LEAD_TIME_MINUTES`: How far in advance to send reminders

## Email Configuration

For production, configure SMTP settings in backend/.env:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_USE_TLS=true
```

For local development, MailHog is included in Docker Compose and accessible at http://localhost:8025.

## Deployment

### Hetzner VPS / Ubuntu Server

1. Install Docker and Docker Compose on your VPS
2. Clone the repository
3. Configure .env files with production settings
4. Update CORS_ORIGINS to include your domain
5. Generate a secure SECRET_KEY:
   ```bash
   openssl rand -hex 32
   ```
6. Configure a reverse proxy (nginx/caddy) to handle SSL
7. Run with Docker Compose:
   ```bash
   docker compose up -d
   ```

### Production Checklist
- [ ] Set strong SECRET_KEY
- [ ] Configure production SMTP
- [ ] Update CORS_ORIGINS
- [ ] Change default admin credentials
- [ ] Set up SSL/TLS with reverse proxy
- [ ] Configure backup for SQLite database
- [ ] Set up monitoring and logging
- [ ] Review and harden security settings

## Security Notes

- Passwords are hashed with Argon2
- JWT tokens expire after 24 hours (configurable)
- New users must change password on first login
- Role-based access control on all endpoints
- Input validation with Pydantic
- CORS protection configured

## License

[Your License Here]

## Support

For issues and questions, please open an issue on GitHub.
