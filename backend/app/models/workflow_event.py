"""Project workflow audit events."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class WorkflowAction(str, Enum):
    SUBMIT = "submit"
    PIO_PICKUP = "pio_pickup"
    PIO_FORWARD = "pio_forward"
    PIO_FLAG_DUPLICATE = "flag_duplicate"
    PIO_FLAG_IMPRACTICAL_BUDGET = "flag_impractical_budget"
    UNO_APPROVE = "uno_approve"
    UNO_REJECT = "uno_reject"
    UPDATE = "update"


class ProjectWorkflowEvent(Base):
    __tablename__ = "project_workflow_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("project_details.id", ondelete="CASCADE"), nullable=False, index=True
    )
    actor_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    from_status: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    to_status: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    action: Mapped[str] = mapped_column(String(40), nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    field_changes: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    project = relationship("ProjectDetails", back_populates="workflow_events")
    actor = relationship("User")
