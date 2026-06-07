"""Assessment scoring models."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.project import ProjectDetails
    from app.models.user import User


class AssessmentRuleType(str, Enum):
    VETO = "veto"
    WEIGHTED = "weighted"


class AssessmentRuleKey(str, Enum):
    DUPLICATE_NEARBY = "duplicate_nearby"
    GEO_OUTSIDE_UNION = "geo_outside_union"
    BUDGET_OVER_CAP = "budget_over_cap"
    BUDGET_VS_MEDIAN = "budget_vs_median"
    PENDING_SAME_TYPE = "pending_same_type"
    DESCRIPTION_COMPLETE = "description_complete"


_RULE_KEYS_SQL = ", ".join(f"'{k.value}'" for k in AssessmentRuleKey)
_RULE_TYPES_SQL = ", ".join(f"'{t.value}'" for t in AssessmentRuleType)


class AssessmentConfig(Base):
    __tablename__ = "assessment_config"

    id: Mapped[int] = mapped_column(primary_key=True)
    pass_threshold: Mapped[int] = mapped_column(Integer, nullable=False, server_default="80")
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    updated_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class AssessmentRule(Base):
    __tablename__ = "assessment_rules"
    __table_args__ = (
        CheckConstraint(
            f"rule_type IN ({_RULE_TYPES_SQL})",
            name="assessment_rules_rule_type_check",
        ),
        CheckConstraint(
            f"rule_key IN ({_RULE_KEYS_SQL})",
            name="assessment_rules_rule_key_check",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    rule_key: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    rule_type: Mapped[str] = mapped_column(String(20), nullable=False)
    weight: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    params: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default="{}")
    failure_message: Mapped[str] = mapped_column(String(500), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")


class ProjectAssessment(Base):
    __tablename__ = "project_assessments"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("project_details.id", ondelete="CASCADE"), nullable=False, index=True
    )
    total_score: Mapped[int] = mapped_column(Integer, nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    breakdown: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, server_default="[]")
    config_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    evaluated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    project: Mapped["ProjectDetails"] = relationship(back_populates="assessments")
