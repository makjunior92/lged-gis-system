"""Initial schema: workflow, dynamic forms, projects, users.

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-05
"""
from __future__ import annotations

from typing import Sequence, Union

import geoalchemy2
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_USER_ROLES = ("Super Admin", "Admin", "Chairman", "PIO", "UNO")
_WORKFLOW_STATUSES = (
    "Draft",
    "Submitted",
    "Under PIO Review",
    "Forwarded to UNO",
    "Approved",
    "Rejected",
)
_FIELD_TYPES = ("text", "textarea", "number", "date", "select", "map_coords")


def _quote_list(values):
    return ", ".join(f"'{v}'" for v in values)


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")

    op.create_table(
        "location_hierarchy",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("division", sa.String(length=50), nullable=False),
        sa.Column("district", sa.String(length=50), nullable=False),
        sa.Column("upazila", sa.String(length=50), nullable=False),
        sa.Column("union_name", sa.String(length=50), nullable=False),
        sa.Column(
            "bbx_polygon",
            geoalchemy2.types.Geometry(
                geometry_type="POLYGON",
                srid=4326,
                spatial_index=False,
                from_text="ST_GeomFromEWKT",
                name="geometry",
            ),
            nullable=True,
        ),
        sa.UniqueConstraint(
            "division", "district", "upazila", "union_name",
            name="unique_admin_hierarchy",
        ),
    )
    op.create_index("idx_location_hierarchy_division", "location_hierarchy", ["division"])
    op.create_index("idx_location_hierarchy_district", "location_hierarchy", ["district"])
    op.create_index("idx_location_hierarchy_upazila", "location_hierarchy", ["upazila"])
    op.execute(
        "CREATE INDEX idx_location_spatial_geom ON location_hierarchy "
        "USING GIST (bbx_polygon);"
    )

    op.create_table(
        "project_types",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("code", sa.String(length=30), nullable=False, unique=True),
        sa.Column("name_en", sa.String(length=100), nullable=False),
        sa.Column("name_bn", sa.String(length=150), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_project_types_code", "project_types", ["code"])

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=50), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=100), nullable=False),
        sa.Column("full_name_bn", sa.String(length=150), nullable=True),
        sa.Column("email", sa.String(length=150), nullable=True, unique=True),
        sa.Column("employee_id", sa.String(length=40), nullable=True, unique=True),
        sa.Column("designation", sa.String(length=120), nullable=True),
        sa.Column("role", sa.String(length=30), nullable=False),
        sa.Column("nid_number", sa.String(length=20), nullable=True, unique=True),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column(
            "assigned_region", sa.Integer(),
            sa.ForeignKey("location_hierarchy.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("assigned_upazila_key", sa.String(length=120), nullable=True),
        sa.Column(
            "custom_data", postgresql.JSONB(astext_type=sa.Text()),
            nullable=False, server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            f"role IN ({_quote_list(_USER_ROLES)})",
            name="users_role_check",
        ),
    )
    op.create_index("ix_users_username", "users", ["username"])
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_employee_id", "users", ["employee_id"])
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_nid_number", "users", ["nid_number"])
    op.create_index("ix_users_assigned_upazila_key", "users", ["assigned_upazila_key"])

    op.create_table(
        "form_schemas",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(length=50), nullable=False, unique=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column(
            "updated_by", sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index("ix_form_schemas_key", "form_schemas", ["key"])

    op.create_table(
        "form_field_definitions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "schema_id", sa.Integer(),
            sa.ForeignKey("form_schemas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("field_key", sa.String(length=80), nullable=False),
        sa.Column("label_en", sa.String(length=150), nullable=False),
        sa.Column("label_bn", sa.String(length=200), nullable=True),
        sa.Column("field_type", sa.String(length=20), nullable=False),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("section", sa.String(length=80), nullable=True),
        sa.Column("options_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("validation_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("visible_to_chairman", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("editable_by_pio", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("editable_by_uno", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("visible_to_uno", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.UniqueConstraint("schema_id", "field_key", name="uq_form_field_schema_key"),
        sa.CheckConstraint(
            f"field_type IN ({_quote_list(_FIELD_TYPES)})",
            name="form_field_type_check",
        ),
    )
    op.create_index("ix_form_field_definitions_schema_id", "form_field_definitions", ["schema_id"])

    op.create_table(
        "project_details",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_code", sa.String(length=40), nullable=False, unique=True),
        sa.Column(
            "location_id", sa.Integer(),
            sa.ForeignKey("location_hierarchy.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "project_type_id", sa.Integer(),
            sa.ForeignKey("project_types.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("project_name", sa.String(length=255), nullable=False),
        sa.Column("latitude", sa.Numeric(9, 6), nullable=False),
        sa.Column("longitude", sa.Numeric(9, 6), nullable=False),
        sa.Column(
            "geom_point",
            geoalchemy2.types.Geometry(
                geometry_type="POINT",
                srid=4326,
                spatial_index=False,
                from_text="ST_GeomFromEWKT",
                name="geometry",
            ),
            nullable=True,
        ),
        sa.Column(
            "workflow_status", sa.String(length=30), nullable=False,
            server_default="Draft",
        ),
        sa.Column(
            "custom_data", postgresql.JSONB(astext_type=sa.Text()),
            nullable=False, server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("estimated_cost", sa.Numeric(15, 2), nullable=True),
        sa.Column("current_situation", sa.String(length=2000), nullable=True),
        sa.Column("development_status", sa.String(length=2000), nullable=True),
        sa.Column("pio_remarks", sa.String(length=2000), nullable=True),
        sa.Column("uno_remarks", sa.String(length=2000), nullable=True),
        sa.Column("uno_decision", sa.String(length=20), nullable=True),
        sa.Column("is_duplicate_flag", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("duplicate_reason", sa.String(length=1000), nullable=True),
        sa.Column(
            "is_impractical_budget_flag", sa.Boolean(), nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("impractical_budget_reason", sa.String(length=1000), nullable=True),
        sa.Column(
            "created_by", sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.CheckConstraint(
            "latitude BETWEEN 20.000000 AND 27.000000",
            name="project_details_lat_check",
        ),
        sa.CheckConstraint(
            "longitude BETWEEN 88.000000 AND 93.000000",
            name="project_details_lng_check",
        ),
        sa.CheckConstraint(
            f"workflow_status IN ({_quote_list(_WORKFLOW_STATUSES)})",
            name="project_details_workflow_status_check",
        ),
        sa.CheckConstraint(
            "estimated_cost IS NULL OR estimated_cost > 0",
            name="project_details_cost_check",
        ),
    )
    op.create_index("ix_project_details_project_code", "project_details", ["project_code"])
    op.create_index("ix_project_details_workflow_status", "project_details", ["workflow_status"])
    op.execute(
        "CREATE INDEX idx_project_spatial_point ON project_details "
        "USING GIST (geom_point);"
    )

    op.create_table(
        "project_workflow_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "project_id", sa.Integer(),
            sa.ForeignKey("project_details.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "actor_id", sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("from_status", sa.String(length=30), nullable=True),
        sa.Column("to_status", sa.String(length=30), nullable=True),
        sa.Column("action", sa.String(length=40), nullable=False),
        sa.Column("remarks", sa.String(length=1000), nullable=True),
        sa.Column("field_changes", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index(
        "ix_project_workflow_events_project_id",
        "project_workflow_events", ["project_id"],
    )


def downgrade() -> None:
    op.drop_table("project_workflow_events")
    op.execute("DROP INDEX IF EXISTS idx_project_spatial_point;")
    op.drop_table("project_details")
    op.drop_table("form_field_definitions")
    op.drop_table("form_schemas")
    op.drop_index("ix_users_assigned_upazila_key", table_name="users")
    op.drop_index("ix_users_nid_number", table_name="users")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_index("ix_users_employee_id", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
    op.drop_index("ix_project_types_code", table_name="project_types")
    op.drop_table("project_types")
    op.execute("DROP INDEX IF EXISTS idx_location_spatial_geom;")
    op.drop_index("idx_location_hierarchy_upazila", table_name="location_hierarchy")
    op.drop_index("idx_location_hierarchy_district", table_name="location_hierarchy")
    op.drop_index("idx_location_hierarchy_division", table_name="location_hierarchy")
    op.drop_table("location_hierarchy")
