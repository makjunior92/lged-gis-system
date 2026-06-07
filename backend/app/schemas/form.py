"""Form schema Pydantic models."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class FormFieldDefinitionBase(BaseModel):
    field_key: str = Field(min_length=1, max_length=80)
    label_en: str = Field(min_length=1, max_length=150)
    label_bn: Optional[str] = Field(default=None, max_length=200)
    field_type: str
    is_system: bool = False
    is_required: bool = False
    display_order: int = 0
    section: Optional[str] = Field(default=None, max_length=80)
    options_json: Optional[list[Any]] = None
    validation_json: Optional[dict[str, Any]] = None
    visible_to_chairman: bool = True
    editable_by_pio: bool = False
    editable_by_uno: bool = False
    visible_to_uno: bool = True


class FormFieldDefinitionRead(FormFieldDefinitionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    schema_id: int


class FormSchemaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    key: str
    version: int
    updated_at: datetime
    fields: list[FormFieldDefinitionRead]


class FormSchemaUpdate(BaseModel):
    fields: list[FormFieldDefinitionBase]


class FieldPermissionUpdate(BaseModel):
    field_key: str
    editable_by_pio: bool
    editable_by_uno: bool = False
    visible_to_uno: bool = True


class FieldPermissionsUpdate(BaseModel):
    permissions: list[FieldPermissionUpdate]
