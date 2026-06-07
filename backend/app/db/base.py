"""SQLAlchemy declarative base + async engine/sessionmaker.

We intentionally import all model modules here so that Alembic's
`target_metadata = Base.metadata` sees every table on autogenerate.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    """Project-wide declarative base."""


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True,
)

AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    autoflush=False,
    class_=AsyncSession,
)

# Side-effect imports so all models are registered on Base.metadata.
from app.models import location, project, user  # noqa: E402,F401
