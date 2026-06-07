-- NOTE: schema creation and primary seed data are handled by Alembic
-- migrations + the application's Python seed script (`app/db/seed.py`),
-- which the backend container runs at startup.
--
-- This file is intentionally a no-op for schema/data. It exists as a
-- documented hook for *additional* SQL-only fixtures (e.g. raster tile
-- references, reporting views) that should be applied during the
-- PostgreSQL container's first initialization.
--
-- Order of operations on a fresh stack:
--   1. PostgreSQL/PostGIS container creates the database.
--   2. /docker-entrypoint-initdb.d/01_extensions.sql enables PostGIS.
--   3. /docker-entrypoint-initdb.d/02_seed.sql (this file) runs.
--   4. backend container starts, runs `alembic upgrade head`,
--      then `python -m app.db.seed` to insert the admin user,
--      sample locations and sample projects.

\echo '02_seed.sql: no-op (seed handled by backend on startup).';
