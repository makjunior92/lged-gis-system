"""Assessment engine and multi-phase project fields.

Revision ID: 0002_assessment
Revises: 0001_initial
Create Date: 2026-06-06
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_assessment"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_RULE_KEYS = (
    "duplicate_nearby",
    "geo_outside_union",
    "budget_over_cap",
    "budget_vs_median",
    "pending_same_type",
    "description_complete",
)
_RULE_TYPES = ("veto", "weighted")


def _quote_list(values):
    return ", ".join(f"'{v}'" for v in values)


def upgrade() -> None:
    op.add_column("project_details", sa.Column("parent_project_id", sa.Integer(), nullable=True))
    op.add_column("project_details", sa.Column("phase_number", sa.Integer(), nullable=True, server_default="1"))
    op.add_column(
        "project_details",
        sa.Column("project_group_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_project_details_parent_project_id",
        "project_details",
        "project_details",
        ["parent_project_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_project_details_parent_project_id", "project_details", ["parent_project_id"])
    op.create_index("ix_project_details_project_group_id", "project_details", ["project_group_id"])
    op.create_check_constraint(
        "project_details_phase_number_check",
        "project_details",
        "phase_number IS NULL OR phase_number >= 1",
    )

    op.create_table(
        "assessment_config",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pass_threshold", sa.Integer(), nullable=False, server_default="80"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )

    op.create_table(
        "assessment_rules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("rule_key", sa.String(length=40), nullable=False, unique=True),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("rule_type", sa.String(length=20), nullable=False),
        sa.Column("weight", sa.Integer(), nullable=True),
        sa.Column("params", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("failure_message", sa.String(length=500), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.CheckConstraint(
            f"rule_type IN ({_quote_list(_RULE_TYPES)})",
            name="assessment_rules_rule_type_check",
        ),
        sa.CheckConstraint(
            f"rule_key IN ({_quote_list(_RULE_KEYS)})",
            name="assessment_rules_rule_key_check",
        ),
    )

    op.create_table(
        "project_assessments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "project_id",
            sa.Integer(),
            sa.ForeignKey("project_details.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("total_score", sa.Integer(), nullable=False),
        sa.Column("passed", sa.Boolean(), nullable=False),
        sa.Column("breakdown", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("config_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_project_assessments_project_id", "project_assessments", ["project_id"])

    op.execute(
        "INSERT INTO assessment_config (pass_threshold, version) VALUES (80, 1)"
    )

    rules_table = sa.table(
        "assessment_rules",
        sa.column("rule_key", sa.String),
        sa.column("display_name", sa.String),
        sa.column("rule_type", sa.String),
        sa.column("weight", sa.Integer),
        sa.column("params", postgresql.JSONB),
        sa.column("failure_message", sa.String),
        sa.column("is_active", sa.Boolean),
        sa.column("sort_order", sa.Integer),
    )
    op.bulk_insert(
        rules_table,
        [
            {
                "rule_key": "duplicate_nearby",
                "display_name": "Duplicate nearby project",
                "rule_type": "veto",
                "weight": None,
                "params": {"radius_meters": 50},
                "failure_message": "Potential duplicate project detected nearby",
                "is_active": True,
                "sort_order": 1,
            },
            {
                "rule_key": "geo_outside_union",
                "display_name": "Coordinates outside union",
                "rule_type": "veto",
                "weight": None,
                "params": {},
                "failure_message": "Project coordinates are outside the union boundary",
                "is_active": True,
                "sort_order": 2,
            },
            {
                "rule_key": "budget_over_cap",
                "display_name": "Budget over cap",
                "rule_type": "weighted",
                "weight": 30,
                "params": {"max_cost": 50000000},
                "failure_message": "Estimated cost exceeds the configured cap",
                "is_active": True,
                "sort_order": 3,
            },
            {
                "rule_key": "budget_vs_median",
                "display_name": "Budget vs union median",
                "rule_type": "weighted",
                "weight": 25,
                "params": {"max_ratio": 2.0},
                "failure_message": "Estimated cost is high compared to approved projects",
                "is_active": True,
                "sort_order": 4,
            },
            {
                "rule_key": "pending_same_type",
                "display_name": "Pending same-type density",
                "rule_type": "weighted",
                "weight": 20,
                "params": {"max_pending": 3},
                "failure_message": "Too many pending applications of this type in the union",
                "is_active": True,
                "sort_order": 5,
            },
            {
                "rule_key": "description_complete",
                "display_name": "Description completeness",
                "rule_type": "weighted",
                "weight": 25,
                "params": {"required_fields": ["current_situation", "development_status"]},
                "failure_message": "Required narrative fields are incomplete",
                "is_active": True,
                "sort_order": 6,
            },
        ],
    )


def downgrade() -> None:
    op.drop_index("ix_project_assessments_project_id", table_name="project_assessments")
    op.drop_table("project_assessments")
    op.drop_table("assessment_rules")
    op.drop_table("assessment_config")

    op.drop_constraint("project_details_phase_number_check", "project_details", type_="check")
    op.drop_index("ix_project_details_project_group_id", table_name="project_details")
    op.drop_index("ix_project_details_parent_project_id", table_name="project_details")
    op.drop_constraint("fk_project_details_parent_project_id", "project_details", type_="foreignkey")
    op.drop_column("project_details", "project_group_id")
    op.drop_column("project_details", "phase_number")
    op.drop_column("project_details", "parent_project_id")
