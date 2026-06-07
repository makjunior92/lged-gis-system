"""Form schema settings (Admin / Super Admin)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.form_schema import FormFieldDefinition, FormSchema, FormSchemaKey
from app.models.user import User
from app.schemas.form import (
    FieldPermissionsUpdate,
    FormFieldDefinitionRead,
    FormSchemaRead,
    FormSchemaUpdate,
)
from app.services.form_schema import (
    CHAIRMAN_SYSTEM_FIELDS,
    PIO_SYSTEM_FIELDS,
    PROJECT_SYSTEM_FIELDS,
    UNO_SYSTEM_FIELDS,
    ensure_system_fields_present,
)

router = APIRouter()
ADMIN_ROLES = ("Super Admin", "Admin")

_SCHEMA_SYSTEM_FIELDS = {
    FormSchemaKey.PROJECT_SUBMISSION.value: PROJECT_SYSTEM_FIELDS,
    FormSchemaKey.CHAIRMAN_USER_CREATE.value: CHAIRMAN_SYSTEM_FIELDS,
    FormSchemaKey.PIO_USER_CREATE.value: PIO_SYSTEM_FIELDS,
    FormSchemaKey.UNO_USER_CREATE.value: UNO_SYSTEM_FIELDS,
    FormSchemaKey.PIO_REVIEW.value: frozenset(),
    FormSchemaKey.UNO_REVIEW.value: frozenset({"uno_decision", "uno_remarks"}),
}


@router.get("/{schema_key}", response_model=FormSchemaRead)
async def get_form_schema(
    schema_key: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> FormSchemaRead:
    stmt = (
        select(FormSchema)
        .options(selectinload(FormSchema.fields))
        .where(FormSchema.key == schema_key)
    )
    schema = (await db.execute(stmt)).scalar_one_or_none()
    if schema is None:
        raise HTTPException(status_code=404, detail="Form schema not found")
    return FormSchemaRead.model_validate(schema)


@router.put("/{schema_key}", response_model=FormSchemaRead)
async def update_form_schema(
    schema_key: str,
    payload: FormSchemaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(ADMIN_ROLES)),
) -> FormSchemaRead:
    stmt = (
        select(FormSchema)
        .options(selectinload(FormSchema.fields))
        .where(FormSchema.key == schema_key)
    )
    schema = (await db.execute(stmt)).scalar_one_or_none()
    if schema is None:
        raise HTTPException(status_code=404, detail="Form schema not found")

    system_keys = _SCHEMA_SYSTEM_FIELDS.get(schema_key, frozenset())
    if system_keys:
        ensure_system_fields_present(
            [FormFieldDefinition(**f.model_dump(), schema_id=schema.id) for f in payload.fields],
            system_keys,
        )

    for old_field in list(schema.fields):
        await db.delete(old_field)
    await db.flush()

    for idx, field_data in enumerate(payload.fields):
        field = FormFieldDefinition(
            schema_id=schema.id,
            display_order=field_data.display_order if field_data.display_order else idx,
            **field_data.model_dump(),
        )
        db.add(field)

    schema.version += 1
    schema.updated_by = current_user.id
    await db.commit()

    schema = (
        await db.execute(
            select(FormSchema)
            .options(selectinload(FormSchema.fields))
            .where(FormSchema.id == schema.id)
        )
    ).scalar_one()
    return FormSchemaRead.model_validate(schema)


@router.put("/{schema_key}/field-permissions", response_model=list[FormFieldDefinitionRead])
async def update_field_permissions(
    schema_key: str,
    payload: FieldPermissionsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(ADMIN_ROLES)),
) -> list[FormFieldDefinitionRead]:
    stmt = (
        select(FormSchema)
        .options(selectinload(FormSchema.fields))
        .where(FormSchema.key == schema_key)
    )
    schema = (await db.execute(stmt)).scalar_one_or_none()
    if schema is None:
        raise HTTPException(status_code=404, detail="Form schema not found")

    by_key = {f.field_key: f for f in schema.fields}
    for perm in payload.permissions:
        field = by_key.get(perm.field_key)
        if field is None:
            raise HTTPException(status_code=400, detail=f"Unknown field: {perm.field_key}")
        field.editable_by_pio = perm.editable_by_pio
        field.editable_by_uno = perm.editable_by_uno
        field.visible_to_uno = perm.visible_to_uno

    await db.commit()
    schema = (
        await db.execute(
            select(FormSchema)
            .options(selectinload(FormSchema.fields))
            .where(FormSchema.id == schema.id)
        )
    ).scalar_one()
    return [FormFieldDefinitionRead.model_validate(f) for f in schema.fields]
