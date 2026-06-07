"""User management endpoints."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import require_roles
from app.core.security import generate_temporary_password, hash_password
from app.db.session import get_db
from app.models.location import LocationHierarchy
from app.models.user import ALLOWED_ROLES, User, UserRole, make_upazila_key, normalize_nid
from app.schemas.common import PaginatedResponse
from app.schemas.user import (
    TemporaryPasswordResponse,
    UserCreate,
    UserRead,
    UserUpdate,
)
from app.services.form_schema import (
    validate_chairman_user_payload,
    validate_pio_user_payload,
    validate_uno_user_payload,
)

router = APIRouter()
ADMIN_ROLES = (UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value)


async def _validate_upazila_assignment(
    db: AsyncSession, role: str, assigned_upazila_key: str | None, exclude_user_id: int | None = None,
) -> None:
    if role not in (UserRole.PIO.value, UserRole.UNO.value):
        return
    if not assigned_upazila_key:
        raise HTTPException(status_code=400, detail="PIO/UNO require assigned_upazila_key")

    stmt = select(User).where(
        User.role == role,
        User.assigned_upazila_key == assigned_upazila_key,
        User.is_active.is_(True),
    )
    if exclude_user_id:
        stmt = stmt.where(User.id != exclude_user_id)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"An active {role} already exists for this upazila",
        )


async def _find_nid_owner(
    db: AsyncSession, nid_number: str | None, *, exclude_user_id: int | None = None,
) -> User | None:
    normalized = normalize_nid(nid_number)
    if not normalized:
        return None
    rows = (await db.execute(select(User).where(User.nid_number.isnot(None)))).scalars().all()
    for row in rows:
        if exclude_user_id and row.id == exclude_user_id:
            continue
        if normalize_nid(row.nid_number) == normalized:
            return row
    return None


async def _resolve_upazila_key(
    db: AsyncSession, assigned_region: int | None, assigned_upazila_key: str | None,
) -> str | None:
    if assigned_upazila_key:
        return assigned_upazila_key
    if assigned_region:
        loc = (
            await db.execute(
                select(LocationHierarchy).where(LocationHierarchy.id == assigned_region)
            )
        ).scalar_one_or_none()
        if loc:
            return make_upazila_key(loc.district, loc.upazila)
    return None


@router.get("/", response_model=PaginatedResponse[UserRead])
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(ADMIN_ROLES)),
) -> PaginatedResponse[UserRead]:
    if role is not None and role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail=f"role must be one of: {', '.join(ALLOWED_ROLES)}")

    stmt = select(User).options(selectinload(User.region))
    count_stmt = select(func.count(User.id))

    if search:
        like = f"%{search}%"
        clause = or_(
            User.username.ilike(like),
            User.full_name.ilike(like),
            User.nid_number.ilike(like),
            User.email.ilike(like),
        )
        stmt = stmt.where(clause)
        count_stmt = count_stmt.where(clause)
    if role is not None:
        stmt = stmt.where(User.role == role)
        count_stmt = count_stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active.is_(is_active))
        count_stmt = count_stmt.where(User.is_active.is_(is_active))

    total = (await db.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(User.id).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(stmt)).scalars().all()

    return PaginatedResponse[UserRead].build(
        items=[UserRead.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(ADMIN_ROLES)),
) -> UserRead:
    custom_data = payload.custom_data or {}
    raw = payload.model_dump()
    raw.update(custom_data)

    if payload.role == UserRole.CHAIRMAN.value:
        system_data, custom_data = await validate_chairman_user_payload(db, raw)
        raw_nid = system_data.get("nid_number")
        if raw_nid:
            system_data["nid_number"] = normalize_nid(str(raw_nid))
            nid_clash = await _find_nid_owner(db, system_data["nid_number"])
            if nid_clash:
                raise HTTPException(
                    status_code=409,
                    detail=f"NID number already registered to user '{nid_clash.username}'",
                )
    elif payload.role == UserRole.PIO.value:
        system_data, custom_data = await validate_pio_user_payload(db, raw)
    elif payload.role == UserRole.UNO.value:
        system_data, custom_data = await validate_uno_user_payload(db, raw)
    else:
        system_data = {}

    username = str(system_data.get("username") or payload.username)
    existing = (
        await db.execute(select(User).where(User.username == username))
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Username already exists")

    assigned_region = system_data.get("assigned_region", payload.assigned_region)
    assigned_upazila_key = system_data.get("assigned_upazila_key", payload.assigned_upazila_key)

    upazila_key = await _resolve_upazila_key(db, assigned_region, assigned_upazila_key)
    if payload.role in (UserRole.PIO.value, UserRole.UNO.value):
        upazila_key = assigned_upazila_key or upazila_key
    await _validate_upazila_assignment(db, payload.role, upazila_key)

    user = User(
        username=username,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        full_name_bn=payload.full_name_bn,
        email=payload.email,
        employee_id=system_data.get("employee_id", payload.employee_id),
        designation=system_data.get("designation", payload.designation),
        role=payload.role,
        nid_number=system_data.get("nid_number", payload.nid_number),
        address=system_data.get("address", payload.address),
        assigned_region=assigned_region,
        assigned_upazila_key=upazila_key if payload.role in (UserRole.PIO.value, UserRole.UNO.value) else None,
        custom_data=custom_data if custom_data else {},
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    user = (
        await db.execute(
            select(User).options(selectinload(User.region)).where(User.id == user.id)
        )
    ).scalar_one()
    return UserRead.model_validate(user)


async def _get_user_or_404(db: AsyncSession, user_id: int) -> User:
    user = (
        await db.execute(
            select(User).options(selectinload(User.region)).where(User.id == user_id)
        )
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def _check_unique_field(
    db: AsyncSession,
    field: str,
    value: str | None,
    exclude_user_id: int,
) -> None:
    if not value:
        return
    col = getattr(User, field)
    existing = (
        await db.execute(
            select(User).where(col == value, User.id != exclude_user_id)
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"{field} already in use")


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(ADMIN_ROLES)),
) -> UserRead:
    user = await _get_user_or_404(db, user_id)
    return UserRead.model_validate(user)


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(ADMIN_ROLES)),
) -> UserRead:
    user = await _get_user_or_404(db, user_id)
    data = payload.model_dump(exclude_unset=True)

    if "username" in data and data["username"] != user.username:
        await _check_unique_field(db, "username", data["username"], user_id)
    if "email" in data and data["email"] != user.email:
        await _check_unique_field(db, "email", data["email"], user_id)
    if "employee_id" in data and data["employee_id"] != user.employee_id:
        await _check_unique_field(db, "employee_id", data["employee_id"], user_id)
    if "nid_number" in data:
        data["nid_number"] = normalize_nid(data["nid_number"])
        if data["nid_number"] != normalize_nid(user.nid_number):
            nid_clash = await _find_nid_owner(db, data["nid_number"], exclude_user_id=user_id)
            if nid_clash:
                raise HTTPException(
                    status_code=409,
                    detail=f"NID number already registered to user '{nid_clash.username}'",
                )

    new_role = data.get("role", user.role)
    assigned_region = data.get("assigned_region", user.assigned_region)
    assigned_upazila_key = data.get("assigned_upazila_key", user.assigned_upazila_key)

    if new_role == UserRole.CHAIRMAN.value and not assigned_region:
        raise HTTPException(status_code=400, detail="Chairman requires assigned_region")
    if new_role in (UserRole.PIO.value, UserRole.UNO.value) and not assigned_upazila_key:
        raise HTTPException(status_code=400, detail="PIO/UNO require assigned_upazila_key")

    upazila_key = assigned_upazila_key
    if new_role in (UserRole.PIO.value, UserRole.UNO.value):
        await _validate_upazila_assignment(db, new_role, upazila_key, exclude_user_id=user_id)
    elif new_role not in (UserRole.PIO.value, UserRole.UNO.value):
        upazila_key = None

    for field, value in data.items():
        if field in ("assigned_upazila_key",):
            continue
        setattr(user, field, value)

    user.role = new_role
    user.assigned_region = assigned_region if new_role == UserRole.CHAIRMAN.value else None
    user.assigned_upazila_key = upazila_key if new_role in (UserRole.PIO.value, UserRole.UNO.value) else None

    await db.commit()
    await db.refresh(user)
    user = await _get_user_or_404(db, user.id)
    return UserRead.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES)),
) -> dict[str, str]:
    user = await _get_user_or_404(db, user_id)

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    if user.role == UserRole.SUPER_ADMIN.value and current_user.role != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Only Super Admin can delete Super Admin accounts")
    if user.role == UserRole.SUPER_ADMIN.value:
        active_super = (
            await db.execute(
                select(func.count(User.id)).where(
                    User.role == UserRole.SUPER_ADMIN.value,
                    User.is_active.is_(True),
                )
            )
        ).scalar_one()
        if active_super <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last active Super Admin")

    await db.delete(user)
    await db.commit()
    return {"message": "User deleted"}


@router.post("/{user_id}/reset-password", response_model=TemporaryPasswordResponse)
async def reset_password(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(ADMIN_ROLES)),
) -> TemporaryPasswordResponse:
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    temp_pw = generate_temporary_password()
    user.password_hash = hash_password(temp_pw)
    await db.commit()

    return TemporaryPasswordResponse(
        user_id=user.id,
        username=user.username,
        temporary_password=temp_pw,
    )
