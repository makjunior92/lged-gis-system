"""Project (infrastructure application) model."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, Any, Optional

from geoalchemy2 import Geometry
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.assessment import ProjectAssessment
    from app.models.location import LocationHierarchy
    from app.models.project_type import ProjectType
    from app.models.user import User
    from app.models.workflow_event import ProjectWorkflowEvent


class WorkflowStatus(str, Enum):
    DRAFT = "Draft"
    SUBMITTED = "Submitted"
    UNDER_PIO_REVIEW = "Under PIO Review"
    FORWARDED_TO_UNO = "Forwarded to UNO"
    APPROVED = "Approved"
    REJECTED = "Rejected"


ALLOWED_WORKFLOW_STATUSES = tuple(s.value for s in WorkflowStatus)
_STATUS_LIST_SQL = ", ".join(f"'{s}'" for s in ALLOWED_WORKFLOW_STATUSES)


class ProjectDetails(Base):
    __tablename__ = "project_details"
    __table_args__ = (
        CheckConstraint(
            "latitude BETWEEN 20.000000 AND 27.000000",
            name="project_details_lat_check",
        ),
        CheckConstraint(
            "longitude BETWEEN 88.000000 AND 93.000000",
            name="project_details_lng_check",
        ),
        CheckConstraint(
            f"workflow_status IN ({_STATUS_LIST_SQL})",
            name="project_details_workflow_status_check",
        ),
        CheckConstraint(
            "estimated_cost IS NULL OR estimated_cost > 0",
            name="project_details_cost_check",
        ),
        CheckConstraint(
            "phase_number IS NULL OR phase_number >= 1",
            name="project_details_phase_number_check",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    project_code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    location_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("location_hierarchy.id", ondelete="RESTRICT"), nullable=False
    )
    project_type_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("project_types.id", ondelete="RESTRICT"), nullable=False
    )
    project_name: Mapped[str] = mapped_column(String(255), nullable=False)
    latitude: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    longitude: Mapped[Decimal] = mapped_column(Numeric(9, 6), nullable=False)
    geom_point: Mapped[Optional[object]] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326, spatial_index=True),
        nullable=True,
    )
    workflow_status: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default="Draft", index=True
    )
    custom_data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    estimated_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2), nullable=True)
    current_situation: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    development_status: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    pio_remarks: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    uno_remarks: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    uno_decision: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_duplicate_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    duplicate_reason: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    is_impractical_budget_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    impractical_budget_reason: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    parent_project_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("project_details.id", ondelete="SET NULL"), nullable=True, index=True
    )
    phase_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, server_default="1")
    project_group_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    location: Mapped["LocationHierarchy"] = relationship(
        back_populates="projects", foreign_keys=[location_id]
    )
    project_type: Mapped["ProjectType"] = relationship(back_populates="projects")
    creator: Mapped[Optional["User"]] = relationship(
        back_populates="created_projects", foreign_keys=[created_by]
    )
    workflow_events: Mapped[list["ProjectWorkflowEvent"]] = relationship(
        back_populates="project", order_by="ProjectWorkflowEvent.created_at"
    )
    parent_project: Mapped[Optional["ProjectDetails"]] = relationship(
        "ProjectDetails",
        remote_side="ProjectDetails.id",
        foreign_keys=[parent_project_id],
    )
    assessments: Mapped[list["ProjectAssessment"]] = relationship(
        back_populates="project",
        order_by="ProjectAssessment.evaluated_at.desc()",
    )
