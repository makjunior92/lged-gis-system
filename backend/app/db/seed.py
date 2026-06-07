"""Idempotent seed: roles, form schemas, project types, users, sample projects."""

from __future__ import annotations

import asyncio
import logging
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.security import hash_password
from app.db.base import AsyncSessionLocal
from app.services.boundary_import import import_boundaries_for_locations
from app.models.assessment import AssessmentConfig, AssessmentRule
from app.services.assessment_engine import evaluate_and_persist, get_latest_assessment
from app.models.form_schema import FormFieldDefinition, FormSchema, FormSchemaKey
from app.models.location import LocationHierarchy
from app.models.project import ProjectDetails, WorkflowStatus
from app.models.project_type import ProjectType
from app.models.user import User, make_upazila_key

logger = logging.getLogger("seed")

_LOCATIONS = [
    {"division": "Chittagong", "district": "Feni", "upazila": "Feni Sadar", "union_name": "Dharmapur"},
    {"division": "Chittagong", "district": "Feni", "upazila": "Feni Sadar", "union_name": "Sharshadi"},
    {"division": "Chittagong", "district": "Feni", "upazila": "Sonagazi", "union_name": "Char Chandia"},
    {"division": "Chittagong", "district": "Feni", "upazila": "Sonagazi", "union_name": "Mongolkandi"},
    {"division": "Chittagong", "district": "Feni", "upazila": "Chhagalnaiya", "union_name": "Radhanagar"},
]

_PROJECT_TYPES = [
    {"code": "B", "name_en": "Bridge", "name_bn": "সেতু", "sort_order": 1},
    {"code": "C", "name_en": "Culvert", "name_bn": "কালভার্ট", "sort_order": 2},
    {"code": "R", "name_en": "Rural Road", "name_bn": "গ্রামীণ সড়ক", "sort_order": 3},
    {"code": "G", "name_en": "Growth Center", "name_bn": "গ্রোথ সেন্টার", "sort_order": 4},
    {"code": "U", "name_en": "Union Parishad Complex", "name_bn": "ইউনিয়ন পরিষদ কমপ্লেক্স", "sort_order": 5},
    {"code": "O", "name_en": "Other", "name_bn": "অন্যান্য", "sort_order": 6},
]

_FENI_UPAZILA_KEY = make_upazila_key("Feni", "Feni Sadar")
_FLOW_DEMO_PASSWORD = "Flow@2026"

_DHARMAPUR = ("Chittagong", "Feni", "Feni Sadar", "Dharmapur")
_SHARSHADI = ("Chittagong", "Feni", "Feni Sadar", "Sharshadi")

_USERS = [
    {
        "username": "admin",
        "password": "Admin@123",
        "full_name": "System Administrator",
        "full_name_bn": "সিস্টেম অ্যাডমিনিস্ট্রেটর",
        "email": "admin@lged.gov.bd",
        "role": "Super Admin",
    },
    {
        "username": "uno.feni",
        "password": _FLOW_DEMO_PASSWORD,
        "full_name": "Md. Abdul Karim",
        "full_name_bn": "মো. আব্দুল করিম",
        "designation": "Upazila Nirbahi Officer",
        "role": "UNO",
        "assigned_upazila_key": _FENI_UPAZILA_KEY,
    },
    {
        "username": "pio.feni",
        "password": _FLOW_DEMO_PASSWORD,
        "full_name": "Md. Shahidul Islam",
        "full_name_bn": "মো. শাহিদুল ইসলাম",
        "designation": "Project Implementation Officer",
        "role": "PIO",
        "assigned_upazila_key": _FENI_UPAZILA_KEY,
    },
    {
        "username": "chairman.dharmapur",
        "password": _FLOW_DEMO_PASSWORD,
        "full_name": "Md. Nurul Amin",
        "full_name_bn": "মো. নুরুল আমিন",
        "designation": "Union Parishad Chairman",
        "role": "Chairman",
        "nid_number": "1234567890123",
        "address": "Dharmapur Union Parishad, Feni Sadar, Feni",
        "region_key": _DHARMAPUR,
    },
    {
        "username": "chairman.sharshadi",
        "password": _FLOW_DEMO_PASSWORD,
        "full_name": "Md. Rafiqul Islam",
        "full_name_bn": "মো. রফিকুল ইসলাম",
        "designation": "Union Parishad Chairman",
        "role": "Chairman",
        "nid_number": "9876543210987",
        "address": "Sharshadi Union Parishad, Feni Sadar, Feni",
        "region_key": _SHARSHADI,
    },
]

# Workflow demo projects (Feni Sadar upazila — visible to pio.feni / uno.feni).
_WORKFLOW_DEMO_PROJECTS = [
    # Baseline: prior approved bridge — causes duplicate detection for new bridge nearby.
    {
        "project_code": "FLOW_B_PRIOR",
        "project_name": "Dharmapur River Bridge (Funded 2024)",
        "project_type_code": "B",
        "latitude": Decimal("22.845600"),
        "longitude": Decimal("91.134500"),
        "workflow_status": WorkflowStatus.APPROVED.value,
        "custom_data": {"requested_budget": 12000000, "project_description": "Existing funded bridge"},
        "estimated_cost": Decimal("11500000.00"),
        "uno_decision": "approved",
        "uno_remarks": "Approved under ADP 2024.",
        "location_key": _DHARMAPUR,
        "created_by": "chairman.dharmapur",
    },
    # PIO queue — should auto-flag as duplicate (same union, type, chairman, ~15m away).
    {
        "project_code": "FLOW_B_DUP",
        "project_name": "Dharmapur River Bridge Phase 2",
        "project_type_code": "B",
        "latitude": Decimal("22.845650"),
        "longitude": Decimal("91.134520"),
        "workflow_status": WorkflowStatus.SUBMITTED.value,
        "custom_data": {"requested_budget": 13000000, "project_description": "Second bridge near existing one"},
        "location_key": _DHARMAPUR,
        "created_by": "chairman.dharmapur",
    },
    # PIO queue — not a duplicate (Other type; chairman already has Road/Bridge/Growth projects here).
    {
        "project_code": "FLOW_O_OK",
        "project_name": "Dharmapur Pond Re-excavation",
        "project_type_code": "O",
        "latitude": Decimal("22.847000"),
        "longitude": Decimal("91.136000"),
        "workflow_status": WorkflowStatus.SUBMITTED.value,
        "custom_data": {"requested_budget": 4500000, "project_description": "Community pond deepening"},
        "location_key": _DHARMAPUR,
        "created_by": "chairman.dharmapur",
    },
    # PIO queue — different union chairman, no overlap.
    {
        "project_code": "FLOW_C_OK",
        "project_name": "Sharshadi Drainage Culvert",
        "project_type_code": "C",
        "latitude": Decimal("22.850000"),
        "longitude": Decimal("91.140000"),
        "workflow_status": WorkflowStatus.SUBMITTED.value,
        "custom_data": {"requested_budget": 1800000, "project_description": "Culvert at ward 3"},
        "location_key": _SHARSHADI,
        "created_by": "chairman.sharshadi",
    },
    # UNO queue — PIO already forwarded; approve this one.
    {
        "project_code": "FLOW_R_FWD_OK",
        "project_name": "Dharmapur School Access Road",
        "project_type_code": "R",
        "latitude": Decimal("22.848200"),
        "longitude": Decimal("91.137500"),
        "workflow_status": WorkflowStatus.FORWARDED_TO_UNO.value,
        "custom_data": {"requested_budget": 3200000, "project_description": "Road to high school"},
        "estimated_cost": Decimal("3100000.00"),
        "pio_remarks": "Site verified. Recommend approval.",
        "current_situation": "Mud road, impassable in monsoon.",
        "location_key": _DHARMAPUR,
        "created_by": "chairman.dharmapur",
    },
    # UNO queue — PIO forwarded; reject this one.
    {
        "project_code": "FLOW_R_FWD_NO",
        "project_name": "Sharshadi Bazaar Link Road",
        "project_type_code": "R",
        "latitude": Decimal("22.851000"),
        "longitude": Decimal("91.141000"),
        "workflow_status": WorkflowStatus.FORWARDED_TO_UNO.value,
        "custom_data": {"requested_budget": 6000000, "project_description": "Paved link to bazaar"},
        "estimated_cost": Decimal("5800000.00"),
        "pio_remarks": "Forwarded with budget concern.",
        "current_situation": "Partially paved.",
        "location_key": _SHARSHADI,
        "created_by": "chairman.sharshadi",
    },
    # Chairman portal — already approved by UNO.
    {
        "project_code": "FLOW_G_DONE_OK",
        "project_name": "Dharmapur Growth Center Shed",
        "project_type_code": "G",
        "latitude": Decimal("22.846500"),
        "longitude": Decimal("91.135500"),
        "workflow_status": WorkflowStatus.APPROVED.value,
        "custom_data": {"requested_budget": 2500000, "project_description": "Farmers market shed"},
        "estimated_cost": Decimal("2400000.00"),
        "uno_decision": "approved",
        "uno_remarks": "Approved with phased release.",
        "pio_remarks": "Growth center location suitable.",
        "location_key": _DHARMAPUR,
        "created_by": "chairman.dharmapur",
    },
    # Chairman portal — already rejected by UNO.
    {
        "project_code": "FLOW_G_DONE_NO",
        "project_name": "Dharmapur Union Office Extension",
        "project_type_code": "U",
        "latitude": Decimal("22.846800"),
        "longitude": Decimal("91.135800"),
        "workflow_status": WorkflowStatus.REJECTED.value,
        "custom_data": {"requested_budget": 8000000, "project_description": "Two-storey extension"},
        "estimated_cost": Decimal("7500000.00"),
        "uno_decision": "rejected",
        "uno_remarks": "Deferred — insufficient upazila allocation this FY.",
        "pio_remarks": "Forwarded for UNO decision.",
        "location_key": _DHARMAPUR,
        "created_by": "chairman.dharmapur",
    },
]


def _project_submission_fields(schema_id: int) -> list[FormFieldDefinition]:
    return [
        FormFieldDefinition(
            schema_id=schema_id, field_key="project_name", label_en="Project Name",
            label_bn="প্রকল্পের নাম", field_type="text", is_system=True, is_required=True,
            display_order=1, section="core", visible_to_chairman=True,
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="project_type_id", label_en="Project Type",
            label_bn="প্রকল্পের ধরন", field_type="select", is_system=True, is_required=True,
            display_order=2, section="core", visible_to_chairman=True,
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="district", label_en="District",
            label_bn="জেলা", field_type="select", is_system=True, is_required=True,
            display_order=3, section="core", visible_to_chairman=True,
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="location_id", label_en="Union Parishad",
            label_bn="ইউনিয়ন পরিষদ", field_type="select", is_system=True, is_required=True,
            display_order=4, section="core", visible_to_chairman=True,
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="latitude", label_en="Latitude",
            field_type="number", is_system=True, is_required=True,
            display_order=5, section="geo", visible_to_chairman=True,
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="longitude", label_en="Longitude",
            field_type="number", is_system=True, is_required=True,
            display_order=6, section="geo", visible_to_chairman=True,
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="requested_budget", label_en="Requested Budget (BDT)",
            label_bn="অনুরোধকৃত বাজেট", field_type="number", is_system=False, is_required=True,
            display_order=7, section="financial", visible_to_chairman=True,
            validation_json={"min": 1},
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="project_description", label_en="Project Description",
            label_bn="প্রকল্পের বিবরণ", field_type="textarea", is_system=False, is_required=False,
            display_order=8, section="details", visible_to_chairman=True,
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="estimated_cost", label_en="Estimated Budget (BDT)",
            label_bn="আনুমানিক বাজেট", field_type="number", is_system=False, is_required=False,
            display_order=10, section="pio", visible_to_chairman=False, editable_by_pio=True,
            validation_json={"min": 1},
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="current_situation", label_en="Current Situation",
            label_bn="বর্তমান অবস্থা", field_type="textarea", is_system=False,
            display_order=11, section="pio", visible_to_chairman=False, editable_by_pio=True,
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="development_status", label_en="Development Status",
            label_bn="উন্নয়নের অবস্থা", field_type="textarea", is_system=False,
            display_order=12, section="pio", visible_to_chairman=False, editable_by_pio=True,
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="pio_remarks", label_en="PIO Remarks",
            label_bn="পিআইও মন্তব্য", field_type="textarea", is_system=False,
            display_order=13, section="pio", visible_to_chairman=False, editable_by_pio=True,
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="uno_decision", label_en="Funding Decision",
            label_bn="অর্থায়ন সিদ্ধান্ত", field_type="select", is_system=True,
            display_order=20, section="uno", visible_to_chairman=False, visible_to_uno=True,
            editable_by_uno=True, options_json=[{"value": "approved", "label": "Approve"}, {"value": "rejected", "label": "Reject"}],
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="uno_remarks", label_en="UNO Remarks",
            label_bn="ইউএনও মন্তব্য", field_type="textarea", is_system=True,
            display_order=21, section="uno", visible_to_chairman=False, visible_to_uno=True,
            editable_by_uno=True,
        ),
    ]


def _uno_review_fields(schema_id: int) -> list[FormFieldDefinition]:
    return [
        FormFieldDefinition(
            schema_id=schema_id, field_key="uno_decision", label_en="Funding Decision",
            label_bn="অর্থায়ন সিদ্ধান্ত", field_type="select", is_system=True, is_required=True,
            display_order=1, section="uno", visible_to_chairman=False, visible_to_uno=True,
            editable_by_uno=True,
            options_json=[{"value": "approved", "label": "Approve"}, {"value": "rejected", "label": "Reject"}],
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="uno_remarks", label_en="UNO Remarks",
            label_bn="ইউএনও মন্তব্য", field_type="textarea", is_system=True, is_required=True,
            display_order=2, section="uno", visible_to_chairman=False, visible_to_uno=True,
            editable_by_uno=True,
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="funding_conditions", label_en="Funding Conditions",
            label_bn="অর্থায়নের শর্ত", field_type="textarea", is_system=False, is_required=False,
            display_order=3, section="uno", visible_to_chairman=False, visible_to_uno=True,
            editable_by_uno=True,
        ),
    ]


def _chairman_user_fields(schema_id: int) -> list[FormFieldDefinition]:
    return [
        FormFieldDefinition(
            schema_id=schema_id, field_key="username", label_en="Username",
            field_type="text", is_system=True, is_required=True, display_order=1,
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="nid_number", label_en="NID Number",
            label_bn="এনআইডি নম্বর", field_type="text", is_system=True, is_required=True,
            display_order=2,
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="assigned_region", label_en="Union Parishad",
            label_bn="ইউনিয়ন পরিষদ", field_type="select", is_system=True, is_required=True,
            display_order=3,
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="address", label_en="Address",
            label_bn="ঠিকানা", field_type="textarea", is_system=True, is_required=True,
            display_order=4,
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="phone", label_en="Phone Number",
            label_bn="ফোন নম্বর", field_type="text", is_system=False, is_required=False,
            display_order=5,
        ),
    ]


def _pio_user_fields(schema_id: int) -> list[FormFieldDefinition]:
    return [
        FormFieldDefinition(
            schema_id=schema_id, field_key="username", label_en="Username",
            field_type="text", is_system=True, is_required=True, display_order=1,
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="employee_id", label_en="Government Employee ID",
            label_bn="সরকারি কর্মচারী আইডি", field_type="text", is_system=True, is_required=True,
            display_order=2,
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="designation", label_en="Designation",
            label_bn="পদবি", field_type="text", is_system=True, is_required=True,
            display_order=3,
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="assigned_upazila_key", label_en="Upazila Assignment",
            label_bn="উপজেলা বরাদ্দ", field_type="select", is_system=True, is_required=True,
            display_order=4,
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="email", label_en="Email",
            field_type="text", is_system=False, is_required=False, display_order=5,
        ),
        FormFieldDefinition(
            schema_id=schema_id, field_key="phone", label_en="Phone Number",
            label_bn="ফোন নম্বর", field_type="text", is_system=False, is_required=False,
            display_order=6,
        ),
    ]


def _uno_user_fields(schema_id: int) -> list[FormFieldDefinition]:
    return _pio_user_fields(schema_id)


async def _ensure_locations(db: AsyncSession) -> dict[tuple[str, str, str, str], int]:
    by_key: dict[tuple[str, str, str, str], int] = {}
    for loc in _LOCATIONS:
        key = (loc["division"], loc["district"], loc["upazila"], loc["union_name"])
        existing = (
            await db.execute(
                select(LocationHierarchy).where(
                    LocationHierarchy.division == loc["division"],
                    LocationHierarchy.district == loc["district"],
                    LocationHierarchy.upazila == loc["upazila"],
                    LocationHierarchy.union_name == loc["union_name"],
                )
            )
        ).scalar_one_or_none()
        if existing is None:
            row = LocationHierarchy(
                division=loc["division"],
                district=loc["district"],
                upazila=loc["upazila"],
                union_name=loc["union_name"],
            )
            db.add(row)
            await db.flush()
            existing = row
            logger.info("Seeded location: %s", "/".join(key))
        by_key[key] = existing.id
    return by_key


async def _ensure_project_types(db: AsyncSession) -> dict[str, int]:
    by_code: dict[str, int] = {}
    for pt in _PROJECT_TYPES:
        existing = (
            await db.execute(select(ProjectType).where(ProjectType.code == pt["code"]))
        ).scalar_one_or_none()
        if existing is None:
            row = ProjectType(**pt)
            db.add(row)
            await db.flush()
            existing = row
            logger.info("Seeded project type: %s", pt["name_en"])
        by_code[pt["code"]] = existing.id
    return by_code


async def _ensure_form_schemas(db: AsyncSession) -> None:
    schemas = {
        FormSchemaKey.PROJECT_SUBMISSION.value: _project_submission_fields,
        FormSchemaKey.CHAIRMAN_USER_CREATE.value: _chairman_user_fields,
        FormSchemaKey.PIO_USER_CREATE.value: _pio_user_fields,
        FormSchemaKey.UNO_USER_CREATE.value: _uno_user_fields,
        FormSchemaKey.PIO_REVIEW.value: lambda sid: [],
        FormSchemaKey.UNO_REVIEW.value: _uno_review_fields,
    }
    for key, field_factory in schemas.items():
        existing = (
            await db.execute(
                select(FormSchema).options(selectinload(FormSchema.fields)).where(FormSchema.key == key)
            )
        ).scalar_one_or_none()
        if existing is not None:
            if existing.fields:
                if key == FormSchemaKey.PROJECT_SUBMISSION.value:
                    existing_keys = {f.field_key for f in existing.fields}
                    if "district" not in existing_keys:
                        for field in _project_submission_fields(existing.id):
                            if field.field_key == "district":
                                db.add(field)
                                logger.info("Added missing district field to project_submission")
                if key in (FormSchemaKey.PIO_USER_CREATE.value, FormSchemaKey.UNO_USER_CREATE.value):
                    for field in existing.fields:
                        if field.field_key == "employee_id" and field.label_en == "Employee ID":
                            field.label_en = "Government Employee ID"
                            field.label_bn = "সরকারি কর্মচারী আইডি"
                            logger.info("Updated employee_id label on %s", key)
                continue
            for field in field_factory(existing.id):
                db.add(field)
            logger.info("Seeded fields for schema: %s", key)
            continue
        if existing is None:
            existing = FormSchema(key=key, version=1)
            db.add(existing)
            await db.flush()
            logger.info("Seeded form schema: %s", key)
        for field in field_factory(existing.id):
            db.add(field)


async def _ensure_users(
    db: AsyncSession, locations: dict[tuple[str, str, str, str], int]
) -> dict[str, int]:
    by_username: dict[str, int] = {}
    for user in _USERS:
        existing = (
            await db.execute(select(User).where(User.username == user["username"]))
        ).scalar_one_or_none()
        if existing is None:
            region_key = user.get("region_key")
            row = User(
                username=user["username"],
                password_hash=hash_password(user["password"]),
                full_name=user["full_name"],
                full_name_bn=user.get("full_name_bn"),
                email=user.get("email"),
                designation=user.get("designation"),
                role=user["role"],
                nid_number=user.get("nid_number"),
                address=user.get("address"),
                assigned_region=locations.get(region_key) if region_key else None,
                assigned_upazila_key=user.get("assigned_upazila_key"),
                is_active=True,
            )
            db.add(row)
            await db.flush()
            existing = row
            logger.info("Seeded user: %s (%s)", user["username"], user["role"])
        elif settings.SEED_RESET_DEMO_PASSWORDS:
            existing.password_hash = hash_password(user["password"])
            logger.info("Reset demo password for user: %s", user["username"])
        by_username[user["username"]] = existing.id
    return by_username


_OBSOLETE_DEMO_CODES = ("APP_B0001", "APP_R0002", "FLOW_R_OK")


async def _ensure_projects(
    db: AsyncSession,
    locations: dict[tuple[str, str, str, str], int],
    users: dict[str, int],
    project_types: dict[str, int],
) -> None:
    for code in _OBSOLETE_DEMO_CODES:
        stale = (
            await db.execute(select(ProjectDetails).where(ProjectDetails.project_code == code))
        ).scalar_one_or_none()
        if stale is not None:
            await db.delete(stale)
            logger.info("Removed obsolete demo project: %s", code)

    submitted_for_dup_check: list[ProjectDetails] = []

    for proj in _WORKFLOW_DEMO_PROJECTS:
        existing = (
            await db.execute(
                select(ProjectDetails).where(ProjectDetails.project_code == proj["project_code"])
            )
        ).scalar_one_or_none()
        if existing is not None:
            if existing.workflow_status not in (
                WorkflowStatus.DRAFT.value,
                WorkflowStatus.REJECTED.value,
            ):
                latest = await get_latest_assessment(db, existing.id)
                if latest is None:
                    submitted_for_dup_check.append(existing)
            continue
        location_id = locations.get(proj["location_key"])
        creator_id = users.get(proj["created_by"])
        type_id = project_types.get(proj["project_type_code"])
        if not location_id or not creator_id or not type_id:
            logger.warning("Skipping project %s — missing location/user/type", proj["project_code"])
            continue
        geom_wkt = f"SRID=4326;POINT({proj['longitude']} {proj['latitude']})"
        row = ProjectDetails(
            project_code=proj["project_code"],
            location_id=location_id,
            project_type_id=type_id,
            project_name=proj["project_name"],
            latitude=proj["latitude"],
            longitude=proj["longitude"],
            geom_point=geom_wkt,
            workflow_status=proj["workflow_status"],
            custom_data=proj.get("custom_data", {}),
            estimated_cost=proj.get("estimated_cost"),
            pio_remarks=proj.get("pio_remarks"),
            current_situation=proj.get("current_situation"),
            uno_decision=proj.get("uno_decision"),
            uno_remarks=proj.get("uno_remarks"),
            created_by=creator_id,
        )
        db.add(row)
        await db.flush()
        if proj["workflow_status"] == WorkflowStatus.SUBMITTED.value:
            submitted_for_dup_check.append(row)
        logger.info("Seeded project: %s (%s)", proj["project_code"], proj["workflow_status"])

    for project in submitted_for_dup_check:
        result = await evaluate_and_persist(db, project)
        if not result.passed:
            logger.info(
                "Assessment on %s → score %s (passed=%s)",
                project.project_code,
                result.total_score,
                result.passed,
            )


_DEFAULT_ASSESSMENT_RULES = [
    {
        "rule_key": "duplicate_nearby",
        "display_name": "Duplicate nearby project",
        "rule_type": "veto",
        "weight": None,
        "params": {"radius_meters": 50},
        "failure_message": "Potential duplicate project detected nearby",
        "sort_order": 1,
    },
    {
        "rule_key": "geo_outside_union",
        "display_name": "Coordinates outside union",
        "rule_type": "veto",
        "weight": None,
        "params": {},
        "failure_message": "Project coordinates are outside the union boundary",
        "sort_order": 2,
    },
    {
        "rule_key": "budget_over_cap",
        "display_name": "Budget over cap",
        "rule_type": "weighted",
        "weight": 30,
        "params": {"max_cost": 50000000},
        "failure_message": "Estimated cost exceeds the configured cap",
        "sort_order": 3,
    },
    {
        "rule_key": "budget_vs_median",
        "display_name": "Budget vs union median",
        "rule_type": "weighted",
        "weight": 25,
        "params": {"max_ratio": 2.0},
        "failure_message": "Estimated cost is high compared to approved projects",
        "sort_order": 4,
    },
    {
        "rule_key": "pending_same_type",
        "display_name": "Pending same-type density",
        "rule_type": "weighted",
        "weight": 20,
        "params": {"max_pending": 3},
        "failure_message": "Too many pending applications of this type in the union",
        "sort_order": 5,
    },
    {
        "rule_key": "description_complete",
        "display_name": "Description completeness",
        "rule_type": "weighted",
        "weight": 25,
        "params": {"required_fields": ["current_situation", "development_status"]},
        "failure_message": "Required narrative fields are incomplete",
        "sort_order": 6,
    },
]


async def _ensure_assessment_settings(db: AsyncSession) -> None:
    config = (await db.execute(select(AssessmentConfig).limit(1))).scalar_one_or_none()
    if config is None:
        db.add(AssessmentConfig(pass_threshold=80, version=1))
        logger.info("Seeded assessment config")

    for rule_def in _DEFAULT_ASSESSMENT_RULES:
        existing = (
            await db.execute(
                select(AssessmentRule).where(AssessmentRule.rule_key == rule_def["rule_key"])
            )
        ).scalar_one_or_none()
        if existing is None:
            db.add(AssessmentRule(**rule_def, is_active=True))
            logger.info("Seeded assessment rule: %s", rule_def["rule_key"])


async def run_seed() -> None:
    if not settings.SEED_ON_STARTUP:
        logger.info("SEED_ON_STARTUP=false, skipping seed.")
        return
    logging.basicConfig(level=logging.INFO)
    async with AsyncSessionLocal() as db:
        try:
            locations = await _ensure_locations(db)
            if settings.SEED_IMPORT_BOUNDARIES:
                from pathlib import Path

                adm3 = Path(settings.BOUNDARY_GEOJSON_ADM3) if settings.BOUNDARY_GEOJSON_ADM3 else None
                adm4 = Path(settings.BOUNDARY_GEOJSON_ADM4) if settings.BOUNDARY_GEOJSON_ADM4 else None
                count = await import_boundaries_for_locations(db, adm3_path=adm3, adm4_path=adm4)
                logger.info("Imported %s union boundary polygon(s) from GIS data", count)
            project_types = await _ensure_project_types(db)
            await _ensure_assessment_settings(db)
            await _ensure_form_schemas(db)
            users = await _ensure_users(db, locations)
            await _ensure_projects(db, locations, users, project_types)
            await db.commit()
            logger.info("Seed complete.")
        except Exception:
            await db.rollback()
            logger.exception("Seed failed")
            raise


if __name__ == "__main__":
    asyncio.run(run_seed())
