# CRM Application - Development Setup

## Quick Start

This guide will help you get the CRM application running on your local machine using Docker.

### Prerequisites

- Docker Desktop installed and running
- Git (to clone the repository)
- At least 2GB of free RAM

### Step 1: Start the Application

```bash
# From the project root directory
docker compose up --build
```

This command will:
- Build the backend Docker image (Python/FastAPI)
- Build the frontend Docker image (Node/React)
- Start MailHog for local email testing
- Create necessary volumes for data persistence

### Step 2: Wait for Services to Start

The first build may take a few minutes. You'll see output from all services. Wait until you see:

```
crm-backend    | Starting CRM Application...
crm-backend    | Created admin user: admin@example.com
crm-backend    | Reminder scheduler started (interval: 60 minutes)
crm-frontend   | VITE ready in XXX ms
```

### Step 3: Access the Application

Once everything is running:

1. **Frontend**: http://localhost:5173
2. **Backend API**: http://localhost:8000
3. **API Documentation**: http://localhost:8000/docs
4. **MailHog (Email Testing)**: http://localhost:8025

### Step 4: Login

Use the default admin credentials:
- **Email**: admin@example.com
- **Password**: admin123

**Important**: You will be prompted to change your password on first login.

## Development Workflow

### Running Backend Only

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### Running Frontend Only

```bash
cd frontend
npm install
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

### Stopping the Application

Press `Ctrl+C` in the terminal where docker compose is running, or:

```bash
docker compose down
```

To also remove volumes (deletes database):
```bash
docker compose down -v
```

## Testing Email Notifications

1. Go to http://localhost:8025 to open MailHog
2. Create a contact with a follow-up date in the past
3. Wait for the reminder check (runs every 60 minutes by default)
4. Or manually trigger a check via the Reminders page (admin only)
5. Check MailHog to see the email notification

## Troubleshooting

### Port Already in Use

If you get port conflicts, stop other services using those ports:
- 5173 (Frontend)
- 8000 (Backend)
- 1025/8025 (MailHog)

### Database Issues

If you encounter database errors, try:
```bash
docker compose down -v
docker compose up --build
```

### Frontend Not Connecting to Backend

Check that VITE_API_URL in `frontend/.env` points to `http://localhost:8000`

### Permission Errors

On Linux/Mac, if you get permission errors with volumes:
```bash
sudo chown -R $USER:$USER backend/data
```

## Project Structure

```
/chatnav-crm
  /backend          - FastAPI application
    /app
      /api          - API endpoints
      /core         - Configuration
      /db           - Database setup
      /models       - SQLAlchemy models
      /schemas      - Pydantic schemas
      /services     - Business logic
      /jobs         - Background tasks
    /alembic        - Database migrations
  /frontend         - React application
    /src
      /api          - API client
      /components   - React components
      /contexts     - React contexts
      /layouts      - Page layouts
      /pages        - Page components
      /types        - TypeScript types
  docker-compose.yml
  README.md
```

## Next Steps

1. Read the main [README.md](README.md) for full documentation
2. Configure SMTP for real email notifications (see backend/.env)
3. Create additional users via the Users page (admin only)
4. Start adding your contacts

## Need Help?

- Check the API documentation at http://localhost:8000/docs
- Review the main README.md for detailed information
- Check Docker logs: `docker compose logs backend` or `docker compose logs frontend`
