"""Project endpoints with workflow."""

from __future__ import annotations

from dataclasses import asdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.form_schema import FormSchemaKey
from app.models.location import LocationHierarchy
from app.models.project import ALLOWED_WORKFLOW_STATUSES, ProjectDetails, WorkflowStatus
from app.models.user import User, UserRole, make_upazila_key
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.assessment import AssessmentBreakdownItem, EligibleParentRead, ProjectAssessmentRead
from app.schemas.project import (
    DuplicateMatchRead,
    PioFlagRequest,
    PioForwardRequest,
    ProjectCreate,
    ProjectRead,
    ProjectUpdate,
    UnoDecideRequest,
    WorkflowEventRead,
)
from app.services.assessment_engine import evaluate_and_persist, get_latest_assessment, load_config
from app.services.duplicate_detection import find_duplicates
from app.services.phase_resolution import list_eligible_parents, resolve_phase_fields
from app.services.geo_validation import assert_coords_within_location
from app.services.field_permissions import get_editable_fields
from app.services.form_schema import get_schema_fields, validate_project_submission
from app.services.project_code import generate_project_code
from app.services.workflow import pio_flag, pio_forward, pio_pickup, submit_project, uno_decide

router = APIRouter()


def _duplicate_matches_read(matches) -> list[DuplicateMatchRead]:
    return [DuplicateMatchRead.model_validate(asdict(m)) for m in matches]


ADMIN_ROLES = (UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value)


def _upazila_key_from_user(user: User) -> str | None:
    if user.assigned_upazila_key:
        return user.assigned_upazila_key
    if user.region:
        return make_upazila_key(user.region.district, user.region.upazila)
    return None


async def _build_assessment_read(db: AsyncSession, project_id: int) -> ProjectAssessmentRead | None:
    latest = await get_latest_assessment(db, project_id)
    if latest is None:
        return None
    config = await load_config(db)
    return ProjectAssessmentRead(
        total_score=latest.total_score,
        passed=latest.passed,
        pass_threshold=config.pass_threshold,
        breakdown=[AssessmentBreakdownItem.model_validate(b) for b in latest.breakdown],
        evaluated_at=latest.evaluated_at,
    )


async def _build_project_read(
    db: AsyncSession,
    project: ProjectDetails,
    user: User,
    *,
    include_duplicates: bool = False,
) -> ProjectRead:
    fields = await get_schema_fields(db, FormSchemaKey.PROJECT_SUBMISSION.value)
    editable = get_editable_fields(user, project, fields)
    data = ProjectRead.model_validate(project)
    data.editable_fields = sorted(editable)
    data.assessment = await _build_assessment_read(db, project.id)
    if include_duplicates:
        matches = await find_duplicates(
            db,
            location_id=project.location_id,
            project_type_id=project.project_type_id,
            created_by=project.created_by,
            latitude=project.latitude,
            longitude=project.longitude,
            exclude_project_id=project.id,
            project_group_id=project.project_group_id,
            parent_project_id=project.parent_project_id,
        )
        data.duplicate_matches = _duplicate_matches_read(matches)
    return data


def _apply_role_scope(stmt, user: User):
    if user.role in ADMIN_ROLES:
        return stmt
    if user.role == UserRole.CHAIRMAN.value:
        return stmt.where(ProjectDetails.created_by == user.id)
    if user.role in (UserRole.PIO.value, UserRole.UNO.value):
        upazila_key = _upazila_key_from_user(user)
        if not upazila_key:
            return stmt.where(ProjectDetails.id == -1)
        district, upazila = upazila_key.split("|", 1)
        return stmt.where(
            LocationHierarchy.district == district,
            LocationHierarchy.upazila == upazila,
        )
    return stmt.where(ProjectDetails.id == -1)


@router.get("/", response_model=PaginatedResponse[ProjectRead])
async def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    search: Optional[str] = None,
    workflow_status: Optional[str] = Query(default=None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaginatedResponse[ProjectRead]:
    if workflow_status is not None and workflow_status not in ALLOWED_WORKFLOW_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid workflow status")

    stmt = (
        select(ProjectDetails)
        .join(LocationHierarchy, LocationHierarchy.id == ProjectDetails.location_id)
        .options(
            selectinload(ProjectDetails.location),
            selectinload(ProjectDetails.project_type),
        )
    )
    count_stmt = (
        select(func.count(ProjectDetails.id))
        .join(LocationHierarchy, LocationHierarchy.id == ProjectDetails.location_id)
    )

    stmt = _apply_role_scope(stmt, current_user)
    count_stmt = _apply_role_scope(count_stmt, current_user)

    if user_role := current_user.role:
        if user_role == UserRole.PIO.value and workflow_status is None:
            stmt = stmt.where(
                ProjectDetails.workflow_status.in_([
                    WorkflowStatus.SUBMITTED.value,
                    WorkflowStatus.UNDER_PIO_REVIEW.value,
                    WorkflowStatus.FORWARDED_TO_UNO.value,
                ])
            )
            count_stmt = count_stmt.where(
                ProjectDetails.workflow_status.in_([
                    WorkflowStatus.SUBMITTED.value,
                    WorkflowStatus.UNDER_PIO_REVIEW.value,
                    WorkflowStatus.FORWARDED_TO_UNO.value,
                ])
            )
        elif user_role == UserRole.UNO.value and workflow_status is None:
            stmt = stmt.where(
                ProjectDetails.workflow_status == WorkflowStatus.FORWARDED_TO_UNO.value
            )
            count_stmt = count_stmt.where(
                ProjectDetails.workflow_status == WorkflowStatus.FORWARDED_TO_UNO.value
            )

    if search:
        like = f"%{search}%"
        clause = or_(
            ProjectDetails.project_name.ilike(like),
            ProjectDetails.project_code.ilike(like),
        )
        stmt = stmt.where(clause)
        count_stmt = count_stmt.where(clause)
    if workflow_status:
        stmt = stmt.where(ProjectDetails.workflow_status == workflow_status)
        count_stmt = count_stmt.where(ProjectDetails.workflow_status == workflow_status)

    total = (await db.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(ProjectDetails.id.desc()).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(stmt)).scalars().all()

    items = [await _build_project_read(db, r, current_user) for r in rows]
    return PaginatedResponse[ProjectRead].build(
        items=items, total=total, page=page, page_size=page_size,
    )


@router.get("/eligible-parents", response_model=list[EligibleParentRead])
async def list_eligible_parent_projects(
    location_id: int = Query(..., gt=0),
    exclude_project_id: Optional[int] = Query(default=None, gt=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles((UserRole.CHAIRMAN.value,) + ADMIN_ROLES)),
) -> list[EligibleParentRead]:
    rows = await list_eligible_parents(
        db,
        location_id=location_id,
        created_by=current_user.id,
        exclude_project_id=exclude_project_id,
    )
    return [EligibleParentRead.model_validate(r) for r in rows]


@router.post("/", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles((UserRole.CHAIRMAN.value,) + ADMIN_ROLES)),
) -> ProjectRead:
    raw = payload.model_dump()
    raw.update(payload.custom_data)
    system_data, custom_data = await validate_project_submission(db, raw)

    location_id = system_data["location_id"]
    location = (
        await db.execute(select(LocationHierarchy).where(LocationHierarchy.id == location_id))
    ).scalar_one_or_none()
    if location is None:
        raise HTTPException(status_code=400, detail="Unknown location_id")

    if current_user.role == UserRole.CHAIRMAN.value:
        if current_user.assigned_region and location_id != current_user.assigned_region:
            raise HTTPException(status_code=403, detail="Chairman can only submit for own union")

    await assert_coords_within_location(
        db,
        location_id=location_id,
        latitude=system_data["latitude"],
        longitude=system_data["longitude"],
    )

    project_code = await generate_project_code(db, system_data["project_type_id"])
    geom_wkt = f"SRID=4326;POINT({system_data['longitude']} {system_data['latitude']})"

    wf_status = WorkflowStatus.DRAFT.value
    if payload.submit:
        wf_status = WorkflowStatus.SUBMITTED.value

    if payload.is_follow_up_phase and not payload.parent_project_id:
        raise HTTPException(status_code=400, detail="parent_project_id required for follow-up phase")
    parent_id = payload.parent_project_id if payload.is_follow_up_phase else None
    phase_num = payload.phase_number if payload.is_follow_up_phase else None
    parent_id, phase_number, group_id = await resolve_phase_fields(
        db,
        location_id=location_id,
        created_by=current_user.id,
        parent_project_id=parent_id,
        phase_number=phase_num,
    )

    project = ProjectDetails(
        project_code=project_code,
        location_id=location_id,
        project_type_id=system_data["project_type_id"],
        project_name=system_data["project_name"],
        latitude=system_data["latitude"],
        longitude=system_data["longitude"],
        geom_point=geom_wkt,
        workflow_status=wf_status,
        custom_data=custom_data,
        created_by=current_user.id,
        parent_project_id=parent_id,
        phase_number=phase_number,
        project_group_id=group_id,
    )
    db.add(project)
    await db.flush()

    if payload.submit:
        await evaluate_and_persist(db, project)

    await db.commit()
    project = (
        await db.execute(
            select(ProjectDetails)
            .options(
                selectinload(ProjectDetails.location),
                selectinload(ProjectDetails.project_type),
            )
            .where(ProjectDetails.id == project.id)
        )
    ).scalar_one()
    return await _build_project_read(db, project, current_user, include_duplicates=True)


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectRead:
    project = (
        await db.execute(
            select(ProjectDetails)
            .options(
                selectinload(ProjectDetails.location),
                selectinload(ProjectDetails.project_type),
            )
            .where(ProjectDetails.id == project_id)
        )
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    if current_user.role == UserRole.PIO.value:
        await pio_pickup(db, project, current_user)
        await db.commit()
        await db.refresh(project)

    return await _build_project_read(db, project, current_user, include_duplicates=True)


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectRead:
    project = (
        await db.execute(
            select(ProjectDetails)
            .options(
                selectinload(ProjectDetails.location),
                selectinload(ProjectDetails.project_type),
            )
            .where(ProjectDetails.id == project_id)
        )
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    fields = await get_schema_fields(db, FormSchemaKey.PROJECT_SUBMISSION.value)
    editable = get_editable_fields(current_user, project, fields)

    data = payload.model_dump(exclude_unset=True)
    custom = data.pop("custom_data", None)

    for key, value in data.items():
        if key not in editable:
            raise HTTPException(status_code=403, detail=f"Cannot edit field: {key}")
        setattr(project, key, value)

    if custom is not None:
        merged = {**project.custom_data, **custom}
        for key in custom:
            if key not in editable and key not in project.custom_data:
                raise HTTPException(status_code=403, detail=f"Cannot edit custom field: {key}")
        project.custom_data = merged

    if "latitude" in data or "longitude" in data:
        project.geom_point = f"SRID=4326;POINT({project.longitude} {project.latitude})"
        await assert_coords_within_location(
            db,
            location_id=project.location_id,
            latitude=project.latitude,
            longitude=project.longitude,
        )

    await db.commit()
    project = (
        await db.execute(
            select(ProjectDetails)
            .options(
                selectinload(ProjectDetails.location),
                selectinload(ProjectDetails.project_type),
            )
            .where(ProjectDetails.id == project.id)
        )
    ).scalar_one()
    return await _build_project_read(db, project, current_user)


@router.post("/{project_id}/submit", response_model=ProjectRead)
async def submit_project_endpoint(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles((UserRole.CHAIRMAN.value,) + ADMIN_ROLES)),
) -> ProjectRead:
    project = (
        await db.execute(select(ProjectDetails).where(ProjectDetails.id == project_id))
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    await submit_project(db, project, current_user)
    await evaluate_and_persist(db, project)
    await db.commit()

    project = (
        await db.execute(
            select(ProjectDetails)
            .options(
                selectinload(ProjectDetails.location),
                selectinload(ProjectDetails.project_type),
            )
            .where(ProjectDetails.id == project.id)
        )
    ).scalar_one()
    return await _build_project_read(db, project, current_user, include_duplicates=True)


@router.post("/{project_id}/pio/forward", response_model=ProjectRead)
async def pio_forward_endpoint(
    project_id: int,
    payload: PioForwardRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles((UserRole.PIO.value,))),
) -> ProjectRead:
    project = (
        await db.execute(select(ProjectDetails).where(ProjectDetails.id == project_id))
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    await pio_forward(db, project, current_user, payload.remarks)
    await db.commit()

    project = (
        await db.execute(
            select(ProjectDetails)
            .options(
                selectinload(ProjectDetails.location),
                selectinload(ProjectDetails.project_type),
            )
            .where(ProjectDetails.id == project.id)
        )
    ).scalar_one()
    return await _build_project_read(db, project, current_user)


@router.post("/{project_id}/pio/flag", response_model=ProjectRead)
async def pio_flag_endpoint(
    project_id: int,
    payload: PioFlagRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles((UserRole.PIO.value,))),
) -> ProjectRead:
    project = (
        await db.execute(select(ProjectDetails).where(ProjectDetails.id == project_id))
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    await pio_flag(
        db, project, current_user,
        duplicate=payload.duplicate,
        duplicate_reason=payload.duplicate_reason,
        impractical_budget=payload.impractical_budget,
        impractical_budget_reason=payload.impractical_budget_reason,
    )
    await db.commit()

    project = (
        await db.execute(
            select(ProjectDetails)
            .options(
                selectinload(ProjectDetails.location),
                selectinload(ProjectDetails.project_type),
            )
            .where(ProjectDetails.id == project.id)
        )
    ).scalar_one()
    return await _build_project_read(db, project, current_user, include_duplicates=True)


@router.post("/{project_id}/pio/recheck-assessment", response_model=ProjectRead)
async def pio_recheck_assessment(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles((UserRole.PIO.value,))),
) -> ProjectRead:
    project = (
        await db.execute(select(ProjectDetails).where(ProjectDetails.id == project_id))
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    await evaluate_and_persist(db, project)
    await db.commit()

    project = (
        await db.execute(
            select(ProjectDetails)
            .options(
                selectinload(ProjectDetails.location),
                selectinload(ProjectDetails.project_type),
            )
            .where(ProjectDetails.id == project.id)
        )
    ).scalar_one()
    return await _build_project_read(db, project, current_user, include_duplicates=True)


@router.post("/{project_id}/pio/recheck-duplicates", response_model=ProjectRead, include_in_schema=False)
async def pio_recheck_duplicates_legacy(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles((UserRole.PIO.value,))),
) -> ProjectRead:
    return await pio_recheck_assessment(project_id, db, current_user)


@router.post("/{project_id}/uno/decide", response_model=ProjectRead)
async def uno_decide_endpoint(
    project_id: int,
    payload: UnoDecideRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles((UserRole.UNO.value,))),
) -> ProjectRead:
    project = (
        await db.execute(select(ProjectDetails).where(ProjectDetails.id == project_id))
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    await uno_decide(
        db, project, current_user, payload.decision, payload.remarks, payload.custom_data
    )
    await db.commit()

    project = (
        await db.execute(
            select(ProjectDetails)
            .options(
                selectinload(ProjectDetails.location),
                selectinload(ProjectDetails.project_type),
            )
            .where(ProjectDetails.id == project.id)
        )
    ).scalar_one()
    return await _build_project_read(db, project, current_user)


@router.get("/{project_id}/workflow-events", response_model=list[WorkflowEventRead])
async def list_workflow_events(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[WorkflowEventRead]:
    from app.models.workflow_event import ProjectWorkflowEvent

    project = (
        await db.execute(select(ProjectDetails).where(ProjectDetails.id == project_id))
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    events = (
        await db.execute(
            select(ProjectWorkflowEvent)
            .where(ProjectWorkflowEvent.project_id == project_id)
            .order_by(ProjectWorkflowEvent.created_at.desc())
        )
    ).scalars().all()
    return [WorkflowEventRead.model_validate(e) for e in events]


@router.delete("/{project_id}", response_model=MessageResponse)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(ADMIN_ROLES)),
) -> MessageResponse:
    project = (
        await db.execute(select(ProjectDetails).where(ProjectDetails.id == project_id))
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()
    return MessageResponse(message=f"Project {project_id} deleted")
