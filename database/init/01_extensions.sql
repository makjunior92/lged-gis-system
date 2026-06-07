-- Enable PostGIS in the freshly-created database. Idempotent.
-- The official postgis/postgis image already provisions PostGIS in the
-- target DB on first init via its own entrypoint, but we include this
-- to make the setup self-contained and resilient.

\c lged_gis

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- A small sanity row so SELECT PostGIS_Version() works even before migrations.
SELECT PostGIS_Full_Version();
