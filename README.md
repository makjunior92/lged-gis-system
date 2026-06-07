# LGED Rural Infrastructure GIS Management System

Workflow-driven prototype for union parishad chairmen to apply for infrastructure funding, reviewed by PIO and approved by UNO.

## Stack

| Tier | Tech |
| --- | --- |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query, dynamic form renderer |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2.0 async, Alembic, PostGIS, JWT, argon2 |
| **Database** | PostgreSQL 16 + PostGIS 3.4 |
| **Infra** | Docker Compose (db + backend + frontend/nginx) |

## Roles & workflow

| Role | Actions |
| --- | --- |
| **Chairman** | Submit project applications for their union parishad |
| **PIO** | Review upazila applications, edit assessment fields, flag duplicates/impractical budget, forward to UNO |
| **UNO** | Approve or reject funding with remarks |
| **Admin / Super Admin** | User management, form settings, project types, view all projects |

Workflow: `Draft` → `Submitted` → `Under PIO Review` → `Forwarded to UNO` → `Approved` / `Rejected`

## Quick start

```bash
cp .env.example .env   # optional
docker compose down -v # reset DB on first run after upgrade
docker compose up -d --build
```

- **Frontend**: http://localhost:3000
- **API docs**: http://localhost:8000/docs

### Seeded credentials

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `Admin@123` | Super Admin |
| `chairman.dharmapur` | `Flow@2026` | Chairman |
| `chairman.sharshadi` | `Flow@2026` | Chairman |
| `pio.feni` | `Flow@2026` | PIO (Feni Sadar upazila) |
| `uno.feni` | `Flow@2026` | UNO (Feni Sadar upazila) |

Demo passwords are reset to these values whenever the backend starts with `SEED_RESET_DEMO_PASSWORDS=true` (default in Docker).

## Settings (Admin)

- **Project Form Settings** — add/remove/configure chairman submission fields
- **Chairman User Form** — extra fields when creating chairman accounts
- **Project Types** — manage infrastructure types (Bridge, Road, etc.)
- **PIO Field Permissions** — which fields PIO/UNO can edit

## Duplicate detection

On submit, flags projects with same union + type + (same chairman OR coordinates within 50 m).

## Per-service docs

- [`backend/README.md`](backend/README.md)
- [`frontend/README.md`](frontend/README.md)
- [`database/README.md`](database/README.md)
