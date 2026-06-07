# LGED GIS — Backend API

FastAPI service with workflow, dynamic forms, and PostGIS duplicate detection.

## Run

```bash
docker compose up -d --build
docker compose logs -f backend
```

## Roles

`Super Admin`, `Admin`, `Chairman`, `PIO`, `UNO`

## Key endpoints

| Method | Path | Who |
| --- | --- | --- |
| `POST` | `/api/v1/projects/` | Chairman — create/submit application |
| `GET` | `/api/v1/projects/` | Role-scoped list |
| `POST` | `/api/v1/projects/{id}/pio/forward` | PIO |
| `POST` | `/api/v1/projects/{id}/uno/decide` | UNO |
| `GET/PUT` | `/api/v1/settings/forms/{key}` | Admin — form schemas |
| `GET/POST` | `/api/v1/settings/project-types/` | Admin — project types |

## Seeded users

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `Admin@123` | Super Admin |
| `chairman.dharmapur` | `Flow@2026` | Chairman |
| `chairman.sharshadi` | `Flow@2026` | Chairman |
| `pio.feni` | `Flow@2026` | PIO (Feni Sadar upazila) |
| `uno.feni` | `Flow@2026` | UNO (Feni Sadar upazila) |
