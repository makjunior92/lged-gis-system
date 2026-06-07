"""User account model."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.location import LocationHierarchy
    from app.models.project import ProjectDetails


class UserRole(str, Enum):
    SUPER_ADMIN = "Super Admin"
    ADMIN = "Admin"
    CHAIRMAN = "Chairman"
    PIO = "PIO"
    UNO = "UNO"


ALLOWED_ROLES = tuple(r.value for r in UserRole)
_ROLE_LIST_SQL = ", ".join(f"'{r}'" for r in ALLOWED_ROLES)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            f"role IN ({_ROLE_LIST_SQL})",
            name="users_role_check",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    full_name_bn: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True, unique=True, index=True)
    employee_id: Mapped[Optional[str]] = mapped_column(String(40), nullable=True, unique=True, index=True)
    designation: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    role: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    nid_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, unique=True, index=True)
    address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    assigned_region: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("location_hierarchy.id", ondelete="SET NULL"),
        nullable=True,
    )
    assigned_upazila_key: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)
    custom_data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    region: Mapped[Optional["LocationHierarchy"]] = relationship(
        back_populates="users", foreign_keys=[assigned_region]
    )
    created_projects: Mapped[list["ProjectDetails"]] = relationship(
        back_populates="creator", foreign_keys="ProjectDetails.created_by"
    )


def make_upazila_key(district: str, upazila: str) -> str:
    return f"{district}|{upazila}"


def normalize_nid(value: str | None) -> str | None:
    """Strip spaces/dashes so NID comparisons use digits only."""
    if not value:
        return None
    digits = "".join(ch for ch in value if ch.isdigit())
    return digits or None
