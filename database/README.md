# LGED GIS — Database container

PostgreSQL 16 + PostGIS 3.4 image used by the LGED Rural Infrastructure GIS
Management System. Built from `postgis/postgis:16-3.4` with the project's init
scripts copied in.

## Layout

```
database/
├── init/
│   ├── 01_extensions.sql   # CREATE EXTENSION postgis (and topology) in lged_gis
│   └── 02_seed.sql         # documented no-op; seed lives in backend
├── Dockerfile              # postgis/postgis:16-3.4 + init scripts
└── README.md               # this file
```

## Initialization order on a fresh stack

The PostGIS image runs every file in `/docker-entrypoint-initdb.d/` in
lexicographic order **only on first initialization** (i.e. when the
`db_data` volume is empty).

1. PostgreSQL creates the `lged_gis` database (env vars from
   `docker-compose.yml`).
2. The PostGIS image's own scripts enable PostGIS in the new DB.
3. `01_extensions.sql` ensures `postgis` and `postgis_topology` exist
   (idempotent safety net).
4. `02_seed.sql` is a no-op marker — see comments inside the file.
5. The backend container (after the DB is healthy) runs
   `alembic upgrade head` and then `python -m app.db.seed`, which
   creates all tables and inserts the admin user, sample locations
   and sample projects.

## Why does the schema not live in raw SQL here?

Single source of truth. The SQLAlchemy models in `backend/app/models/`
drive both runtime ORM behaviour and Alembic migrations, so schema
changes don't have to be replicated in three places.

## Resetting the database

```bash
docker compose down -v   # drops the db_data volume
docker compose up -d
```

Because init scripts only run on first initialization, you must drop
the volume to re-trigger them.

## Connecting from psql

```bash
docker exec -it lged_db psql -U lged -d lged_gis
```

## Useful sanity queries

```sql
SELECT PostGIS_Full_Version();
\dt
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM project_details;
```
