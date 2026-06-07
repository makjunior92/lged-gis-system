FROM postgis/postgis:16-3.4

LABEL org.opencontainers.image.title="LGED GIS PostgreSQL+PostGIS"
LABEL org.opencontainers.image.description="PostgreSQL 16 + PostGIS 3.4 with init scripts for the LGED Rural Infrastructure GIS Management System."

# Init scripts are executed in lexicographic order on first DB initialization.
COPY init/ /docker-entrypoint-initdb.d/

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=10 \
    CMD pg_isready -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" || exit 1
