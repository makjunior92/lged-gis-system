# LGED GIS — Frontend

React SPA with role-based navigation and admin-configurable dynamic forms.

## Pages by role

| Role | Routes |
| --- | --- |
| Chairman | `/applications`, `/applications/new` |
| PIO | `/pio/review`, `/pio/projects/:id` |
| UNO | `/uno/approvals`, `/uno/projects/:id` |
| Admin | `/admin/projects`, `/users`, `/settings/*` |

## Docker

```bash
docker compose up -d --build
```

Frontend: http://localhost:3000

## Local dev

```bash
cd frontend && npm install && npm run dev
```

Vite dev server: http://localhost:5173 (proxies `/api` to backend)

## Demo logins

See root README for `admin`, `chairman.dharmapur`, `pio.feni`, `uno.feni`.
