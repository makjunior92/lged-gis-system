"""Form schema loading and validation."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.form_schema import FormFieldDefinition, FormSchema, FormSchemaKey

# System fields stored as real DB columns on projects.
PROJECT_SYSTEM_FIELDS = frozenset({
    "project_name",
    "project_type_id",
    "location_id",
    "latitude",
    "longitude",
})

# System fields on chairman user creation.
CHAIRMAN_SYSTEM_FIELDS = frozenset({
    "username",
    "password",
    "full_name",
    "nid_number",
    "assigned_region",
    "address",
})

PIO_SYSTEM_FIELDS = frozenset({
    "username",
    "password",
    "full_name",
    "employee_id",
    "designation",
    "assigned_upazila_key",
})

UNO_SYSTEM_FIELDS = PIO_SYSTEM_FIELDS

# PIO/UNO workflow columns on projects.
PROJECT_WORKFLOW_COLUMNS = frozenset({
    "estimated_cost",
    "current_situation",
    "development_status",
    "pio_remarks",
    "uno_remarks",
    "uno_decision",
})


async def get_schema(db: AsyncSession, schema_key: str) -> FormSchema:
    stmt = (
        select(FormSchema)
        .options(selectinload(FormSchema.fields))
        .where(FormSchema.key == schema_key)
    )
    schema = (await db.execute(stmt)).scalar_one_or_none()
    if schema is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Form schema '{schema_key}' not found",
        )
    return schema


async def get_schema_fields(db: AsyncSession, schema_key: str) -> list[FormFieldDefinition]:
    schema = await get_schema(db, schema_key)
    return sorted(schema.fields, key=lambda f: f.display_order)


def _validate_field_value(field: FormFieldDefinition, value: Any) -> Any:
    if value is None or value == "":
        if field.is_required:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Field '{field.field_key}' is required",
            )
        return None

    ftype = field.field_type
    validation = field.validation_json or {}

    if ftype == "text":
        if not isinstance(value, str):
            raise HTTPException(status_code=400, detail=f"{field.field_key} must be text")
        max_len = validation.get("max_length", 500)
        if len(value) > max_len:
            raise HTTPException(status_code=400, detail=f"{field.field_key} exceeds max length")
        return value

    if ftype == "textarea":
        if not isinstance(value, str):
            raise HTTPException(status_code=400, detail=f"{field.field_key} must be text")
        return value

    if ftype == "number":
        try:
            num = Decimal(str(value))
        except (InvalidOperation, ValueError):
            raise HTTPException(status_code=400, detail=f"{field.field_key} must be a number")
        if "min" in validation and num < Decimal(str(validation["min"])):
            raise HTTPException(status_code=400, detail=f"{field.field_key} below minimum")
        if "max" in validation and num > Decimal(str(validation["max"])):
            raise HTTPException(status_code=400, detail=f"{field.field_key} above maximum")
        return float(num) if num % 1 else int(num) if num == int(num) else float(num)

    if ftype == "date":
        return str(value)

    if ftype == "select":
        options = field.options_json or []
        allowed = {opt.get("value", opt) if isinstance(opt, dict) else opt for opt in options}
        if str(value) not in {str(a) for a in allowed} and value not in allowed:
            # Allow project_type_id style numeric selects without options_json
            if field.field_key == "assigned_upazila_key":
                return str(value)
            if field.field_key in ("project_type_id", "assigned_region", "location_id"):
                return int(value)
            if options:
                raise HTTPException(
                    status_code=400,
                    detail=f"{field.field_key} has invalid option",
                )
        return value

    if ftype == "map_coords":
        return value

    return value


def validate_payload(
    fields: list[FormFieldDefinition],
    payload: dict[str, Any],
    *,
    visible_filter: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Split payload into system columns and custom_data."""
    system_data: dict[str, Any] = {}
    custom_data: dict[str, Any] = {}

    visible_fields = fields
    if visible_filter == "chairman":
        visible_fields = [f for f in fields if f.visible_to_chairman]

    for field in visible_fields:
        if field.field_key not in payload and field.is_required and not field.is_system:
            # System fields validated separately
            if field.field_key in payload or not field.is_required:
                continue
        if field.field_key not in payload:
            if field.is_required and field.field_key not in PROJECT_SYSTEM_FIELDS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Missing required field: {field.field_key}",
                )
            continue

        raw = payload[field.field_key]
        if field.field_type == "map_coords":
            continue
        validated = _validate_field_value(field, raw)

        if field.field_key in PROJECT_SYSTEM_FIELDS or field.field_key in PROJECT_WORKFLOW_COLUMNS:
            if validated is not None:
                system_data[field.field_key] = validated
        elif field.field_key in CHAIRMAN_SYSTEM_FIELDS:
            if validated is not None:
                system_data[field.field_key] = validated
        else:
            if validated is not None:
                custom_data[field.field_key] = validated

    return system_data, custom_data


def ensure_system_fields_present(
    fields: list[FormFieldDefinition],
    system_keys: frozenset[str],
) -> None:
    present = {f.field_key for f in fields if f.is_system}
    missing = system_keys - present
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot remove system fields: {', '.join(sorted(missing))}",
        )


async def validate_project_submission(
    db: AsyncSession, payload: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, Any]]:
    fields = await get_schema_fields(db, FormSchemaKey.PROJECT_SUBMISSION.value)
    # Handle lat/lng from map_coords or direct keys
    if "latitude" in payload and "longitude" in payload:
        pass
    elif "map_coords" in payload and isinstance(payload["map_coords"], dict):
        payload["latitude"] = payload["map_coords"].get("latitude")
        payload["longitude"] = payload["map_coords"].get("longitude")

    for key in PROJECT_SYSTEM_FIELDS:
        if key in ("latitude", "longitude"):
            if key not in payload and key not in payload.get("map_coords", {}):
                raise HTTPException(status_code=400, detail=f"Missing required field: {key}")
        elif key not in payload:
            raise HTTPException(status_code=400, detail=f"Missing required field: {key}")

    system_data, custom_data = validate_payload(fields, payload, visible_filter="chairman")

    for key in PROJECT_SYSTEM_FIELDS:
        if key in payload:
            system_data[key] = payload[key]

    return system_data, custom_data


async def validate_chairman_user_payload(
    db: AsyncSession, payload: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, Any]]:
    fields = await get_schema_fields(db, FormSchemaKey.CHAIRMAN_USER_CREATE.value)
    for key in ("username", "password", "full_name", "nid_number", "assigned_region", "address"):
        if key not in payload:
            raise HTTPException(status_code=400, detail=f"Missing required field: {key}")
    system_data, custom_data = validate_payload(fields, payload)
    for key in CHAIRMAN_SYSTEM_FIELDS:
        if key in payload:
            system_data[key] = payload[key]
    return system_data, custom_data


async def validate_pio_user_payload(
    db: AsyncSession, payload: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, Any]]:
    fields = await get_schema_fields(db, FormSchemaKey.PIO_USER_CREATE.value)
    for key in ("username", "password", "full_name", "employee_id", "designation", "assigned_upazila_key"):
        if key not in payload or payload[key] in (None, ""):
            raise HTTPException(status_code=400, detail=f"Missing required field: {key}")
    system_data, custom_data = validate_payload(fields, payload)
    for key in PIO_SYSTEM_FIELDS:
        if key in payload:
            system_data[key] = payload[key]
    return system_data, custom_data


async def validate_uno_user_payload(
    db: AsyncSession, payload: dict[str, Any]
) -> tuple[dict[str, Any], dict[str, Any]]:
    fields = await get_schema_fields(db, FormSchemaKey.UNO_USER_CREATE.value)
    for key in ("username", "password", "full_name", "employee_id", "designation", "assigned_upazila_key"):
        if key not in payload or payload[key] in (None, ""):
            raise HTTPException(status_code=400, detail=f"Missing required field: {key}")
    system_data, custom_data = validate_payload(fields, payload)
    for key in UNO_SYSTEM_FIELDS:
        if key in payload:
            system_data[key] = payload[key]
    return system_data, custom_data
