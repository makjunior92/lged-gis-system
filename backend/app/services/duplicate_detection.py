"""Simple duplicate project detection."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import and_, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.project import ProjectDetails, WorkflowStatus


@dataclass
class DuplicateMatch:
    project_id: int
    project_code: str
    project_name: str
    reason: str


def _is_phase_related(
    *,
    project_group_id: uuid.UUID | None,
    parent_project_id: int | None,
    candidate: ProjectDetails,
) -> bool:
    if project_group_id and candidate.project_group_id == project_group_id:
        return True
    if parent_project_id and candidate.id == parent_project_id:
        return True
    if candidate.parent_project_id == parent_project_id and parent_project_id is not None:
        return True
    return False


async def find_duplicates(
    db: AsyncSession,
    *,
    location_id: int,
    project_type_id: int,
    created_by: int | None,
    latitude: Decimal,
    longitude: Decimal,
    exclude_project_id: int | None = None,
    radius_meters: int = 50,
    project_group_id: uuid.UUID | None = None,
    parent_project_id: int | None = None,
) -> list[DuplicateMatch]:
    """Flag duplicates by union + type + (same chairman OR coords within radius)."""
    geom_wkt = f"SRID=4326;POINT({longitude} {latitude})"

    base_filters = [
        ProjectDetails.location_id == location_id,
        ProjectDetails.project_type_id == project_type_id,
        ProjectDetails.workflow_status != WorkflowStatus.REJECTED.value,
    ]
    if exclude_project_id is not None:
        base_filters.append(ProjectDetails.id != exclude_project_id)

    proximity_clause = text(
        "ST_DWithin(project_details.geom_point::geography, "
        "ST_GeomFromText(:wkt, 4326)::geography, :radius)"
    ).bindparams(wkt=geom_wkt, radius=radius_meters)

    match_clauses = []
    if created_by is not None:
        match_clauses.append(ProjectDetails.created_by == created_by)
    match_clauses.append(proximity_clause)

    stmt = (
        select(ProjectDetails)
        .options(selectinload(ProjectDetails.location))
        .where(and_(*base_filters, or_(*match_clauses)))
        .order_by(ProjectDetails.id.desc())
        .limit(10)
    )
    rows = (await db.execute(stmt)).scalars().all()

    matches: list[DuplicateMatch] = []
    for row in rows:
        if _is_phase_related(
            project_group_id=project_group_id,
            parent_project_id=parent_project_id,
            candidate=row,
        ):
            continue
        if parent_project_id and row.parent_project_id == parent_project_id:
            continue
        reasons = []
        if created_by is not None and row.created_by == created_by:
            reasons.append("same chairman")
        reasons.append(f"coordinates within {radius_meters}m")
        matches.append(
            DuplicateMatch(
                project_id=row.id,
                project_code=row.project_code,
                project_name=row.project_name,
                reason=" and ".join(reasons),
            )
        )
    return matches


async def check_and_flag(
    db: AsyncSession,
    project: ProjectDetails,
) -> list[DuplicateMatch]:
    """Legacy wrapper — prefer assessment_engine.evaluate_and_persist."""
    from app.services.assessment_engine import evaluate_and_persist

    result = await evaluate_and_persist(db, project)
    dup = next((b for b in result.breakdown if b.rule_key == "duplicate_nearby"), None)
    if dup and dup.matches:
        return [
            DuplicateMatch(
                project_id=m["project_id"],
                project_code=m["project_code"],
                project_name=m["project_name"],
                reason=m["reason"],
            )
            for m in dup.matches
        ]
    return []
