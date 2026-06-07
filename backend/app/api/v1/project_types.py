"""Project type management (Admin / Super Admin)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.project_type import ProjectType
from app.models.user import User
from app.schemas.project_type import ProjectTypeCreate, ProjectTypeRead, ProjectTypeUpdate

router = APIRouter()
ADMIN_ROLES = ("Super Admin", "Admin")


@router.get("/", response_model=list[ProjectTypeRead])
async def list_project_types(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[ProjectTypeRead]:
    stmt = select(ProjectType).order_by(ProjectType.sort_order, ProjectType.name_en)
    if active_only:
        stmt = stmt.where(ProjectType.is_active.is_(True))
    rows = (await db.execute(stmt)).scalars().all()
    return [ProjectTypeRead.model_validate(r) for r in rows]


@router.post("/", response_model=ProjectTypeRead, status_code=status.HTTP_201_CREATED)
async def create_project_type(
    payload: ProjectTypeCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(ADMIN_ROLES)),
) -> ProjectTypeRead:
    existing = (
        await db.execute(select(ProjectType).where(ProjectType.code == payload.code))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Project type code already exists")
    row = ProjectType(**payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return ProjectTypeRead.model_validate(row)


@router.patch("/{type_id}", response_model=ProjectTypeRead)
async def update_project_type(
    type_id: int,
    payload: ProjectTypeUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(ADMIN_ROLES)),
) -> ProjectTypeRead:
    row = (await db.execute(select(ProjectType).where(ProjectType.id == type_id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Project type not found")
    data = payload.model_dump(exclude_unset=True)
    if "code" in data:
        clash = (
            await db.execute(
                select(ProjectType).where(
                    ProjectType.code == data["code"], ProjectType.id != type_id
                )
            )
        ).scalar_one_or_none()
        if clash:
            raise HTTPException(status_code=409, detail="Project type code already exists")
    for k, v in data.items():
        setattr(row, k, v)
    await db.commit()
    await db.refresh(row)
    return ProjectTypeRead.model_validate(row)


@router.delete("/{type_id}", status_code=status.HTTP_200_OK)
async def delete_project_type(
    type_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(ADMIN_ROLES)),
) -> dict[str, str]:
    row = (await db.execute(select(ProjectType).where(ProjectType.id == type_id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Project type not found")
    row.is_active = False
    await db.commit()
    return {"message": f"Project type {type_id} deactivated"}
