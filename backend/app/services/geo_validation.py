"""Geographic validation for project coordinates."""

from __future__ import annotations

from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.location import LocationHierarchy


async def assert_coords_within_location(
    db: AsyncSession,
    *,
    location_id: int,
    latitude: Decimal | float,
    longitude: Decimal | float,
) -> None:
    """Ensure a point lies inside the union's bounding polygon (if defined)."""
    contains = (
        await db.execute(
            select(
                func.ST_Contains(
                    LocationHierarchy.bbx_polygon,
                    func.ST_SetSRID(
                        func.ST_MakePoint(float(longitude), float(latitude)),
                        4326,
                    ),
                )
            ).where(
                LocationHierarchy.id == location_id,
                LocationHierarchy.bbx_polygon.isnot(None),
            )
        )
    ).scalar_one_or_none()

    if contains is None:
        return

    if not contains:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Coordinates must be within the selected union parishad area",
        )
