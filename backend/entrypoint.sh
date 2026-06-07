#!/usr/bin/env bash
# Container entrypoint: wait for DB → run migrations → seed → start uvicorn.

set -euo pipefail

log() { echo "[entrypoint] $*"; }

# Parse host/port out of DATABASE_URL of form
# postgresql+asyncpg://user:pass@host:port/db
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
if [[ -n "${DATABASE_URL:-}" ]]; then
  proto_stripped="${DATABASE_URL#*://}"
  host_port_db="${proto_stripped#*@}"
  host_port="${host_port_db%%/*}"
  if [[ "$host_port" == *:* ]]; then
    DB_HOST="${host_port%:*}"
    DB_PORT="${host_port##*:}"
  else
    DB_HOST="$host_port"
  fi
fi

log "Waiting for database at ${DB_HOST}:${DB_PORT}…"
for attempt in $(seq 1 60); do
  if (echo > "/dev/tcp/${DB_HOST}/${DB_PORT}") >/dev/null 2>&1; then
    log "Database TCP reachable on attempt ${attempt}."
    break
  fi
  if [[ "$attempt" -eq 60 ]]; then
    log "ERROR: database not reachable after 60 attempts." >&2
    exit 1
  fi
  sleep 1
done

log "Running Alembic migrations…"
alembic upgrade head

if [[ "${SEED_ON_STARTUP:-true}" == "true" ]]; then
  log "Running seed script…"
  python -m app.db.seed
else
  log "SEED_ON_STARTUP=false → skipping seed."
fi

log "Starting uvicorn…"
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --proxy-headers \
  --forwarded-allow-ips='*' \
  ${UVICORN_RELOAD:+--reload} \
  ${UVICORN_WORKERS:+--workers "$UVICORN_WORKERS"}
