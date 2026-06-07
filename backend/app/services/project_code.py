"""Auto-generation of human-readable project codes (e.g. APP_B0006)."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import ProjectDetails
from app.models.project_type import ProjectType


async def generate_project_code(db: AsyncSession, project_type_id: int) -> str:
    ptype = (
        await db.execute(select(ProjectType).where(ProjectType.id == project_type_id))
    ).scalar_one_or_none()
    prefix_letter = (ptype.code[:1].upper() if ptype else "X")
    count_stmt = select(func.count(ProjectDetails.id))
    total = (await db.execute(count_stmt)).scalar_one()
    next_seq = (total or 0) + 1
    return f"APP_{prefix_letter}{next_seq:04d}"
