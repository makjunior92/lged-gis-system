"""Location hierarchy lookup endpoints."""

from __future__ import annotations

import json
from collections import OrderedDict
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.location import LocationHierarchy
from app.models.user import User
from app.schemas.location import (
    DistrictItem,
    HierarchyDistrict,
    HierarchyDivision,
    HierarchyResponse,
    LocationBounds,
    LocationNode,
    UpazilaItem,
)

router = APIRouter()


def _location_node_from_row(row) -> LocationNode:
    south, west, north, east, centroid_lat, centroid_lng, boundary_raw = row[1:8]
    bounds = None
    if south is not None and west is not None and north is not None and east is not None:
        bounds = LocationBounds(
            south=float(south),
            west=float(west),
            north=float(north),
            east=float(east),
        )
    boundary_geojson = None
    if boundary_raw:
        try:
            boundary_geojson = json.loads(boundary_raw)
        except (TypeError, json.JSONDecodeError):
            boundary_geojson = None

    loc = row[0]
    return LocationNode(
        id=loc.id,
        division=loc.division,
        district=loc.district,
        upazila=loc.upazila,
        union_name=loc.union_name,
        centroid_lat=round(float(centroid_lat), 6) if centroid_lat is not None else None,
        centroid_lng=round(float(centroid_lng), 6) if centroid_lng is not None else None,
        bounds=bounds,
        boundary_geojson=boundary_geojson,
    )


@router.get("/districts", response_model=List[DistrictItem])
async def list_districts(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List[DistrictItem]:
    stmt = (
        select(LocationHierarchy.division, LocationHierarchy.district)
        .distinct()
        .order_by(LocationHierarchy.division, LocationHierarchy.district)
    )
    rows = (await db.execute(stmt)).all()
    return [DistrictItem(division=div, district=dist) for div, dist in rows]


@router.get("/upazilas", response_model=List[UpazilaItem])
async def list_upazilas(
    district: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List[UpazilaItem]:
    stmt = (
        select(LocationHierarchy.upazila)
        .distinct()
        .order_by(LocationHierarchy.upazila)
    )
    if district:
        stmt = stmt.where(LocationHierarchy.district.ilike(district))
    rows = (await db.execute(stmt)).all()
    return [UpazilaItem(upazila=u) for (u,) in rows]


@router.get("/all", response_model=List[LocationNode])
async def list_all_locations(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> List[LocationNode]:
    stmt = (
        select(
            LocationHierarchy,
            func.ST_YMin(LocationHierarchy.bbx_polygon).label("south"),
            func.ST_XMin(LocationHierarchy.bbx_polygon).label("west"),
            func.ST_YMax(LocationHierarchy.bbx_polygon).label("north"),
            func.ST_XMax(LocationHierarchy.bbx_polygon).label("east"),
            func.ST_Y(func.ST_Centroid(LocationHierarchy.bbx_polygon)).label("centroid_lat"),
            func.ST_X(func.ST_Centroid(LocationHierarchy.bbx_polygon)).label("centroid_lng"),
            func.ST_AsGeoJSON(
                func.ST_SimplifyPreserveTopology(LocationHierarchy.bbx_polygon, 0.00008)
            ).label("boundary_geojson"),
        )
        .order_by(
            LocationHierarchy.division,
            LocationHierarchy.district,
            LocationHierarchy.upazila,
            LocationHierarchy.union_name,
        )
    )
    rows = (await db.execute(stmt)).all()
    return [_location_node_from_row(r) for r in rows]


@router.get("/hierarchy", response_model=HierarchyResponse)
async def hierarchy(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> HierarchyResponse:
    stmt = select(
        LocationHierarchy.division,
        LocationHierarchy.district,
        LocationHierarchy.upazila,
    ).distinct().order_by(
        LocationHierarchy.division, LocationHierarchy.district, LocationHierarchy.upazila
    )
    rows = (await db.execute(stmt)).all()

    tree: "OrderedDict[str, OrderedDict[str, list[str]]]" = OrderedDict()
    for div, dist, upa in rows:
        tree.setdefault(div, OrderedDict()).setdefault(dist, []).append(upa)

    divisions = [
        HierarchyDivision(
            division=div,
            districts=[
                HierarchyDistrict(district=d, upazilas=ups)
                for d, ups in dists.items()
            ],
        )
        for div, dists in tree.items()
    ]
    return HierarchyResponse(divisions=divisions)
