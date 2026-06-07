"""Location hierarchy schemas."""

from __future__ import annotations

from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict


class DistrictItem(BaseModel):
    division: str
    district: str


class UpazilaItem(BaseModel):
    upazila: str


class LocationBounds(BaseModel):
    south: float
    west: float
    north: float
    east: float


class LocationNode(BaseModel):
    id: int
    division: str
    district: str
    upazila: str
    union_name: str
    centroid_lat: Optional[float] = None
    centroid_lng: Optional[float] = None
    bounds: Optional[LocationBounds] = None
    boundary_geojson: Optional[dict[str, Any]] = None


class HierarchyDistrict(BaseModel):
    district: str
    upazilas: List[str]


class HierarchyDivision(BaseModel):
    division: str
    districts: List[HierarchyDistrict]


class HierarchyResponse(BaseModel):
    divisions: List[HierarchyDivision]
