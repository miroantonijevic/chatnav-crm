You are a senior full-stack engineer working inside my repository in agent mode.

Your task is to BUILD a complete working CRM application, not just describe it.

Important working style:
- Work iteratively in phases.
- After each phase, make sure the project remains internally consistent and runnable.
- Prefer a clean MVP that works end-to-end over unnecessary complexity.
- Make pragmatic decisions without asking me lots of questions.
- Do not stop at planning. Actually create files and implementation.
- When you make assumptions, document them briefly in README.
- Keep the code production-structured and easy to extend.
- Avoid giant monolithic files.

==================================================
HIGH-LEVEL GOAL
==================================================

Build a CRM web application with:
- Python backend
- React frontend
- SQLite database
- fully async backend
- Dockerized local setup
- user authentication with email + password
- user roles (admin, regular user)
- contact management
- relationship state tracking
- follow-up reminders / alerts
- email notifications to the responsible user and all admins when follow-up is due

This app will later be hosted on a Hetzner VPS running Ubuntu, so the structure should be deployment-friendly and simple.

==================================================
MANDATORY STACK
==================================================

Backend:
- FastAPI
- SQLAlchemy 2.0 async ORM
- sqlite+aiosqlite
- Alembic
- Pydantic
- JWT auth
- secure password hashing
- async email sending
- async reminder checking job

Frontend:
- React
- Vite
- TypeScript
- React Router

Infra:
- Docker
- docker-compose
- .env configuration
- persistent SQLite storage

==================================================
ARCHITECTURE REQUIREMENTS
==================================================

Use this structure or something very close to it:

/crm-app
  /backend
    /app
      /api
      /core
      /db
      /models
      /schemas
      /services
      /jobs
      /utils
      main.py
    /alembic
    /tests
    requirements.txt
    Dockerfile
    .env.example
  /frontend
    /src
      /api
      /components
      /contexts
      /hooks
      /layouts
      /pages
      /routes
      /types
      /utils
    package.json
    Dockerfile
    .env.example
  docker-compose.yml
  README.md

==================================================
BUSINESS REQUIREMENTS
==================================================

1. USERS AND AUTH

Users must have:
- id
- email
- full_name
- hashed_password
- role: admin or user
- is_active
- must_change_password
- created_at
- updated_at

Rules:
- login is by email + password
- password must be securely hashed in DB
- never store plain text passwords
- newly created users must be forced to change password on first login
- admins can create users
- admins can edit users
- admins can activate/deactivate users
- regular users cannot manage other users
- bootstrap first admin user from environment variables or startup script

2. ROLES

Admin:
- can view all users
- can create/edit/deactivate users
- can view and edit all contacts
- can view all reminders/settings

Regular user:
- can only see contacts assigned to them
- can only create contacts assigned to themselves
- can only edit their own contacts
- cannot access admin pages or admin API endpoints

3. CONTACTS

Contacts should have:
- id
- first_name
- last_name
- company
- job_title
- email
- phone
- notes
- owner_user_id
- current_relationship_status
- last_contacted_at
- next_contact_due_at
- reminders_enabled
- created_at
- updated_at

Features:
- create contact
- edit contact
- list contacts
- search by name/company/email
- filter by relationship state
- filter by due follow-up
- view contact details

4. RELATIONSHIP STATUS / HISTORY

Track the latest relationship state and also keep history.

Recommended statuses:
- new
- contacted
- follow-up-needed
- interested
- not-interested
- customer
- inactive

Add a history model with fields like:
- id
- contact_id
- changed_by_user_id
- status
- note
- interaction_at
- next_contact_due_at
- created_at

Each time a contact is meaningfully updated, support logging a history entry.

5. REMINDERS / ALERTS

The system must support reminder logic:
- each contact may have a next_contact_due_at timestamp
- a background scheduler periodically checks due contacts
- when a contact becomes due, send email notification to:
  - the owner user of the contact
  - all admin users
- prevent duplicate spam:
  - store reminder logs/events
  - do not repeatedly send the same reminder for the same due timestamp
  - send again only if the due timestamp changes or reminder state resets

Add simple configurable settings such as:
- reminders enabled globally
- scheduler interval
- reminder lead time in minutes/hours
- per-contact reminders_enabled

6. EMAIL NOTIFICATIONS

Use SMTP env vars:
- SMTP_HOST
- SMTP_PORT
- SMTP_USERNAME
- SMTP_PASSWORD
- SMTP_FROM_EMAIL
- SMTP_USE_TLS

Requirements:
- async sending
- clean subject/body
- include contact name, company, status, due date, owner
- design email sending behind a service interface
- for local/dev, make it easy to test even if real SMTP is not configured

==================================================
SECURITY REQUIREMENTS
==================================================

- hash passwords securely with Argon2 or bcrypt
- never expose password hashes in responses
- enforce JWT expiration
- enforce must_change_password before normal app access
- validate ownership on backend, not only frontend
- regular users must never access others’ contacts through URL tampering
- protect admin endpoints with role checks
- validate email fields
- enforce unique user email
- sanitize and validate inputs with Pydantic schemas

==================================================
BACKEND API
==================================================

Implement REST endpoints like these:

Auth:
- POST /auth/login
- POST /auth/change-password
- GET /auth/me

Users:
- GET /users
- POST /users
- GET /users/{id}
- PUT /users/{id}
- PATCH /users/{id}/activate
- PATCH /users/{id}/deactivate

Contacts:
- GET /contacts
- POST /contacts
- GET /contacts/{id}
- PUT /contacts/{id}
- DELETE /contacts/{id}   (soft delete optional)
- GET /contacts/{id}/history
- POST /contacts/{id}/history

Reminders / Settings:
- GET /reminders/due
- POST /reminders/run-check
- GET /settings/reminders
- PUT /settings/reminders

Implementation expectations:
- async SQLAlchemy session
- dependency-based auth
- dependency-based role checks
- ownership checks
- service layer for business logic
- scheduler starts on app startup

==================================================
FRONTEND REQUIREMENTS
==================================================

Build these pages:
- Login page
- Force password change page
- Dashboard
- Contacts list page
- Contact detail page
- Create/edit contact page
- User management page (admin only)
- Reminder/settings page (admin only)

Dashboard should show:
- due follow-ups
- upcoming follow-ups
- basic counts
- user-specific data for regular users
- system-wide overview for admins

Contacts list:
- search
- relationship state filter
- due follow-up filter
- clean table layout

Contact detail:
- full contact info
- owner
- current status
- notes
- last interaction
- next due date
- history timeline

Frontend auth behavior:
- login with JWT
- store token in a practical MVP-friendly way
- redirect based on auth state
- force password change when must_change_password = true
- hide admin navigation for non-admins
- still rely on backend for true authorization

==================================================
DOCKER / DEPLOYMENT REQUIREMENTS
==================================================

Create:
- backend/Dockerfile
- frontend/Dockerfile
- docker-compose.yml
- .env.example files
- README.md

docker-compose should run:
- backend
- frontend

Backend should:
- expose API
- persist SQLite db file in a mounted volume
- read env vars
- apply migrations on startup if reasonable

Frontend should:
- run via Docker
- talk to backend via env var
- be simple to reconfigure for VPS deployment

I want to be able to run:
- docker compose up --build

==================================================
DELIVERY STRATEGY
==================================================

Execute the work in these phases.

PHASE 1 — SCAFFOLDING
Create:
- full project structure
- backend FastAPI app skeleton
- frontend React/Vite skeleton
- Dockerfiles
- docker-compose.yml
- .env.example files
- README starter
- shared configuration approach

PHASE 2 — BACKEND FOUNDATION
Implement:
- async DB setup
- SQLAlchemy models
- Alembic setup
- config management
- logging
- initial migration
- bootstrap admin logic

PHASE 3 — AUTH AND USER MANAGEMENT
Implement:
- password hashing
- JWT login
- current user endpoint
- force password change flow
- admin user CRUD
- role/permission dependencies

PHASE 4 — CONTACTS AND HISTORY
Implement:
- contacts CRUD
- ownership rules
- search/filter support
- relationship state tracking
- contact history model and endpoints

PHASE 5 — REMINDERS AND EMAIL
Implement:
- reminder settings
- due contact query logic
- reminder logs
- scheduler job
- email sending service
- admin test endpoint to run reminder check manually

PHASE 6 — FRONTEND UI
Implement:
- auth flow
- protected routes
- dashboard
- contacts list/detail/form
- user management page
- reminder settings page
- force change password page

PHASE 7 — POLISH
Add:
- input validation improvements
- error handling
- seed/bootstrap improvements
- basic tests for critical backend flows
- README finalization
- deployment notes for Ubuntu/Hetzner VPS

==================================================
QUALITY RULES
==================================================

- Keep backend fully async
- Do not use synchronous SQLAlchemy session patterns
- Keep files focused and reasonably sized
- Use service classes/functions for business logic
- Use schemas for request/response separation
- Do not expose internal fields unintentionally
- Prefer maintainable code over clever code
- Do not add unnecessary frameworks
- Make the UI simple, clean, and functional

==================================================
AGENT MODE INSTRUCTIONS
==================================================

While working:
- actually create and modify files
- do not just explain what should be done
- keep the project compiling logically as you go
- when a phase is complete, move to the next phase
- where useful, add brief TODO comments for future enhancements, but complete the main requested behavior now
- avoid placeholder implementations unless absolutely necessary
- for any placeholder, clearly mark it and keep the app runnable

==================================================
MINIMUM ACCEPTANCE CRITERIA
==================================================

The result is only acceptable if:
- backend is fully async
- email/password login works
- passwords are hashed
- first login forces password change
- admins can create users
- user roles are enforced
- regular users only see their own contacts
- admins can see all contacts and users
- contacts can be created and updated
- relationship status and history are tracked
- follow-up due dates can be set
- scheduled reminder checking exists
- due reminders email owner + admins
- Docker Compose runs the stack
- SQLite persists
- code is structured properly

==================================================
NOW START
==================================================

Start by implementing PHASE 1 and PHASE 2 immediately.

Then continue through the remaining phases until the project is fully generated.

As you work, present the result file-by-file with clear filenames and full contents for important files.
Do not stop at a high-level summary.