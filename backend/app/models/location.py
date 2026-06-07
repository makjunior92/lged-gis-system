"""Administrative location hierarchy (Division → District → Upazila → Union)."""

from __future__ import annotations

from typing import TYPE_CHECKING, List, Optional

from geoalchemy2 import Geometry
from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.project import ProjectDetails
    from app.models.user import User


class LocationHierarchy(Base):
    __tablename__ = "location_hierarchy"
    __table_args__ = (
        UniqueConstraint(
            "division", "district", "upazila", "union_name",
            name="unique_admin_hierarchy",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    division: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    district: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    upazila: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    union_name: Mapped[str] = mapped_column(String(50), nullable=False)
    bbx_polygon: Mapped[Optional[object]] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326, spatial_index=True),
        nullable=True,
    )

    users: Mapped[List["User"]] = relationship(
        back_populates="region", foreign_keys="User.assigned_region"
    )
    projects: Mapped[List["ProjectDetails"]] = relationship(
        back_populates="location", foreign_keys="ProjectDetails.location_id"
    )
