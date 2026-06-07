"""Authentication endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user
from app.core.security import (
    JWTError,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse, RefreshRequest, TokenPair
from app.schemas.user import UserRead

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> LoginResponse:
    username = payload.username.strip()
    password = payload.password.strip()
    stmt = (
        select(User)
        .options(selectinload(User.region))
        .where(User.username == username)
    )
    user = (await db.execute(stmt)).scalar_one_or_none()

    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    user.last_login = datetime.now(tz=timezone.utc)
    await db.commit()
    await db.refresh(user, attribute_names=["last_login"])

    access = create_access_token(
        subject=user.id,
        extra_claims={"username": user.username, "role": user.role},
    )
    refresh = create_refresh_token(subject=user.id)

    return LoginResponse(
        access_token=access,
        refresh_token=refresh,
        token_type="bearer",
        user=UserRead.model_validate(user),
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh_tokens(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    try:
        decoded = decode_token(payload.refresh_token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    if decoded.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong token type"
        )

    user_id_raw = decoded.get("sub")
    try:
        user_id = int(user_id_raw)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer valid"
        )

    return TokenPair(
        access_token=create_access_token(
            subject=user.id,
            extra_claims={"username": user.username, "role": user.role},
        ),
        refresh_token=create_refresh_token(subject=user.id),
        token_type="bearer",
    )


@router.get("/me", response_model=UserRead)
async def me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserRead:
    stmt = (
        select(User)
        .options(selectinload(User.region))
        .where(User.id == current_user.id)
    )
    user = (await db.execute(stmt)).scalar_one()
    return UserRead.model_validate(user)
