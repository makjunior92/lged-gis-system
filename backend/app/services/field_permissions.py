"""Resolve editable/visible fields per role and workflow stage."""

from __future__ import annotations

from app.models.form_schema import FormFieldDefinition
from app.models.project import ProjectDetails, WorkflowStatus
from app.models.user import User, UserRole
from app.services.form_schema import PROJECT_SYSTEM_FIELDS, PROJECT_WORKFLOW_COLUMNS

ADMIN_ROLES = {UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value}


def get_editable_fields(
    user: User,
    project: ProjectDetails,
    fields: list[FormFieldDefinition],
) -> set[str]:
    role = user.role
    status = project.workflow_status

    if role in ADMIN_ROLES:
        return PROJECT_SYSTEM_FIELDS | PROJECT_WORKFLOW_COLUMNS | {f.field_key for f in fields}

    if role == UserRole.CHAIRMAN.value:
        if status == WorkflowStatus.DRAFT.value:
            return PROJECT_SYSTEM_FIELDS | {
                f.field_key for f in fields
                if f.visible_to_chairman and not f.is_system
            }
        return set()

    if role == UserRole.PIO.value:
        if status in (WorkflowStatus.SUBMITTED.value, WorkflowStatus.UNDER_PIO_REVIEW.value):
            return {f.field_key for f in fields if f.editable_by_pio} | {
                k for k in PROJECT_WORKFLOW_COLUMNS
                if any(f.field_key == k and f.editable_by_pio for f in fields)
                or k in ("estimated_cost", "current_situation", "development_status", "pio_remarks")
            }
        return set()

    if role == UserRole.UNO.value:
        if status == WorkflowStatus.FORWARDED_TO_UNO.value:
            editable = {f.field_key for f in fields if f.editable_by_uno}
            editable.add("uno_remarks")
            editable.add("uno_decision")
            return editable
        return set()

    return set()


def get_visible_custom_keys(
    user: User,
    fields: list[FormFieldDefinition],
) -> set[str]:
    role = user.role
    if role in ADMIN_ROLES:
        return {f.field_key for f in fields}
    if role == UserRole.CHAIRMAN.value:
        return {f.field_key for f in fields if f.visible_to_chairman}
    if role == UserRole.UNO.value:
        return {f.field_key for f in fields if f.visible_to_uno}
    return {f.field_key for f in fields}
