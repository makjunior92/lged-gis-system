"""Project workflow state machine."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import ProjectDetails, WorkflowStatus
from app.models.user import User, UserRole
from app.models.workflow_event import ProjectWorkflowEvent, WorkflowAction

ADMIN_ROLES = {UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value}


def _log_event(
    db: AsyncSession,
    project: ProjectDetails,
    actor: User,
    action: str,
    from_status: str | None,
    to_status: str | None,
    remarks: str | None = None,
    field_changes: dict[str, Any] | None = None,
) -> None:
    event = ProjectWorkflowEvent(
        project_id=project.id,
        actor_id=actor.id,
        from_status=from_status,
        to_status=to_status,
        action=action,
        remarks=remarks,
        field_changes=field_changes,
    )
    db.add(event)


async def submit_project(db: AsyncSession, project: ProjectDetails, actor: User) -> None:
    if actor.role != UserRole.CHAIRMAN.value and actor.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Only Chairman can submit applications")
    if project.workflow_status != WorkflowStatus.DRAFT.value:
        raise HTTPException(status_code=400, detail="Only draft applications can be submitted")
    if project.created_by != actor.id and actor.role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Not your application")

    old = project.workflow_status
    project.workflow_status = WorkflowStatus.SUBMITTED.value
    _log_event(db, project, actor, WorkflowAction.SUBMIT.value, old, project.workflow_status)


async def pio_pickup(db: AsyncSession, project: ProjectDetails, actor: User) -> None:
    if actor.role != UserRole.PIO.value:
        raise HTTPException(status_code=403, detail="PIO only")
    if project.workflow_status not in (
        WorkflowStatus.SUBMITTED.value,
        WorkflowStatus.UNDER_PIO_REVIEW.value,
    ):
        raise HTTPException(status_code=400, detail="Project not in PIO queue")

    if project.workflow_status == WorkflowStatus.SUBMITTED.value:
        old = project.workflow_status
        project.workflow_status = WorkflowStatus.UNDER_PIO_REVIEW.value
        _log_event(db, project, actor, WorkflowAction.PIO_PICKUP.value, old, project.workflow_status)


async def pio_forward(
    db: AsyncSession,
    project: ProjectDetails,
    actor: User,
    remarks: str | None = None,
) -> None:
    if actor.role != UserRole.PIO.value:
        raise HTTPException(status_code=403, detail="PIO only")
    if project.workflow_status not in (
        WorkflowStatus.SUBMITTED.value,
        WorkflowStatus.UNDER_PIO_REVIEW.value,
    ):
        raise HTTPException(status_code=400, detail="Project not ready to forward")

    old = project.workflow_status
    project.workflow_status = WorkflowStatus.FORWARDED_TO_UNO.value
    if remarks:
        project.pio_remarks = remarks
    _log_event(
        db, project, actor, WorkflowAction.PIO_FORWARD.value,
        old, project.workflow_status, remarks=remarks,
    )


async def pio_flag(
    db: AsyncSession,
    project: ProjectDetails,
    actor: User,
    *,
    duplicate: bool = False,
    duplicate_reason: str | None = None,
    impractical_budget: bool = False,
    impractical_budget_reason: str | None = None,
) -> None:
    if actor.role != UserRole.PIO.value:
        raise HTTPException(status_code=403, detail="PIO only")

    if duplicate:
        project.is_duplicate_flag = True
        project.duplicate_reason = duplicate_reason or "Flagged by PIO"
        _log_event(
            db, project, actor, WorkflowAction.PIO_FLAG_DUPLICATE.value,
            project.workflow_status, project.workflow_status,
            remarks=duplicate_reason,
        )
    if impractical_budget:
        project.is_impractical_budget_flag = True
        project.impractical_budget_reason = impractical_budget_reason or "Flagged by PIO"
        _log_event(
            db, project, actor, WorkflowAction.PIO_FLAG_IMPRACTICAL_BUDGET.value,
            project.workflow_status, project.workflow_status,
            remarks=impractical_budget_reason,
        )


async def uno_decide(
    db: AsyncSession,
    project: ProjectDetails,
    actor: User,
    decision: str,
    remarks: str | None = None,
    custom_data: dict | None = None,
) -> None:
    if actor.role != UserRole.UNO.value:
        raise HTTPException(status_code=403, detail="UNO only")
    if project.workflow_status != WorkflowStatus.FORWARDED_TO_UNO.value:
        raise HTTPException(status_code=400, detail="Project not awaiting UNO decision")
    if decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="decision must be approved or rejected")

    old = project.workflow_status
    project.uno_decision = decision
    project.uno_remarks = remarks
    if custom_data:
        project.custom_data = {**(project.custom_data or {}), **custom_data}
    if decision == "approved":
        project.workflow_status = WorkflowStatus.APPROVED.value
        action = WorkflowAction.UNO_APPROVE.value
    else:
        project.workflow_status = WorkflowStatus.REJECTED.value
        action = WorkflowAction.UNO_REJECT.value

    _log_event(
        db, project, actor, action, old, project.workflow_status, remarks=remarks,
    )
