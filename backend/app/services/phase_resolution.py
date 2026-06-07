"""Multi-phase project lineage resolution."""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import ProjectDetails, WorkflowStatus


async def resolve_phase_fields(
    db: AsyncSession,
    *,
    location_id: int,
    created_by: int,
    parent_project_id: int | None,
    phase_number: int | None,
) -> tuple[int | None, int, uuid.UUID]:
    """Return (parent_project_id, phase_number, project_group_id)."""
    if parent_project_id is None:
        return None, 1, uuid.uuid4()

    if phase_number is None or phase_number < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="phase_number must be 2 or greater when linking a parent project",
        )

    parent = (
        await db.execute(select(ProjectDetails).where(ProjectDetails.id == parent_project_id))
    ).scalar_one_or_none()
    if parent is None:
        raise HTTPException(status_code=400, detail="Parent project not found")
    if parent.created_by != created_by:
        raise HTTPException(status_code=403, detail="Parent project must belong to you")
    if parent.location_id != location_id:
        raise HTTPException(status_code=400, detail="Parent project must be in the same union")
    if parent.workflow_status == WorkflowStatus.REJECTED.value:
        raise HTTPException(status_code=400, detail="Cannot link to a rejected parent project")

    group_id = parent.project_group_id or uuid.uuid4()
    if parent.project_group_id is None:
        parent.project_group_id = group_id

    return parent_project_id, phase_number, group_id


async def list_eligible_parents(
    db: AsyncSession,
    *,
    location_id: int,
    created_by: int,
    exclude_project_id: int | None = None,
) -> list[ProjectDetails]:
    stmt = (
        select(ProjectDetails)
        .where(
            ProjectDetails.location_id == location_id,
            ProjectDetails.created_by == created_by,
            ProjectDetails.workflow_status != WorkflowStatus.REJECTED.value,
        )
        .order_by(ProjectDetails.id.desc())
        .limit(50)
    )
    if exclude_project_id is not None:
        stmt = stmt.where(ProjectDetails.id != exclude_project_id)
    return list((await db.execute(stmt)).scalars().all())
