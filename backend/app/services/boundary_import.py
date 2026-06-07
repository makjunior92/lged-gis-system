"""Import union parishad polygons from geoBoundaries GeoJSON into PostGIS."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from shapely.geometry import shape
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.location import LocationHierarchy

logger = logging.getLogger("boundary_import")

_DEFAULT_ADM3 = Path(__file__).resolve().parents[2] / "data/gis/bd_adm3_feni_upazilas.geojson"
_DEFAULT_ADM4 = Path(__file__).resolve().parents[2] / "data/gis/bd_adm4_feni_unions.geojson"
_DEFAULT_ALIASES = Path(__file__).resolve().parents[2] / "data/gis/union_aliases.json"


def _load_features(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        logger.warning("Boundary GeoJSON not found: %s", path)
        return []
    with path.open(encoding="utf-8") as fh:
        data = json.load(fh)
    return data.get("features", [])


def _load_aliases(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def _normalize_name(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _upazila_index(adm3_features: list[dict[str, Any]]) -> dict[str, Any]:
    by_name: dict[str, Any] = {}
    for feat in adm3_features:
        name = feat.get("properties", {}).get("shapeName")
        if not name:
            continue
        by_name[_normalize_name(name)] = shape(feat["geometry"])
    return by_name


def _match_union_polygon(
    *,
    union_name: str,
    upazila_name: str,
    adm4_features: list[dict[str, Any]],
    upazila_shapes: dict[str, Any],
    aliases: dict[str, str],
) -> Any | None:
    up_key = _normalize_name(upazila_name)
    upazila_geom = upazila_shapes.get(up_key)
    if upazila_geom is None:
        return None

    gis_union_name = aliases.get(union_name, union_name)
    candidates = {_normalize_name(union_name), _normalize_name(gis_union_name)}

    for feat in adm4_features:
        props_name = feat.get("properties", {}).get("shapeName", "")
        if _normalize_name(props_name) not in candidates:
            continue
        union_geom = shape(feat["geometry"])
        if upazila_geom.contains(union_geom.representative_point()):
            return union_geom
    return None


def _normalize_union_geom(union_geom: Any) -> Any:
    """Store as a single Polygon — column type is POLYGON, not MULTIPOLYGON."""
    if union_geom.geom_type == "MultiPolygon":
        return max(union_geom.geoms, key=lambda g: g.area)
    return union_geom


def _to_wkt_element(union_geom: Any) -> str:
    normalized = _normalize_union_geom(union_geom)
    return f"SRID=4326;{normalized.wkt}"


async def import_boundaries_for_locations(
    db: AsyncSession,
    *,
    adm3_path: Path | None = None,
    adm4_path: Path | None = None,
    aliases_path: Path | None = None,
) -> int:
    """Match DB locations to GIS polygons and store in `bbx_polygon`. Returns count updated."""
    adm3_features = _load_features(adm3_path or _DEFAULT_ADM3)
    adm4_features = _load_features(adm4_path or _DEFAULT_ADM4)
    if not adm4_features:
        logger.info("No ADM4 boundary features loaded; skipping import.")
        return 0

    aliases = _load_aliases(aliases_path or _DEFAULT_ALIASES)
    upazila_shapes = _upazila_index(adm3_features)

    locations = (await db.execute(select(LocationHierarchy))).scalars().all()
    updated = 0
    for loc in locations:
        union_geom = _match_union_polygon(
            union_name=loc.union_name,
            upazila_name=loc.upazila,
            adm4_features=adm4_features,
            upazila_shapes=upazila_shapes,
            aliases=aliases,
        )
        if union_geom is None:
            logger.warning(
                "No GIS polygon for union %s / %s / %s",
                loc.district,
                loc.upazila,
                loc.union_name,
            )
            continue
        loc.bbx_polygon = _to_wkt_element(union_geom)
        updated += 1
        logger.info("Imported boundary: %s → %s", loc.upazila, loc.union_name)

    return updated
