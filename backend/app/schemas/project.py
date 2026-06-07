"""Project schemas."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.project import ALLOWED_WORKFLOW_STATUSES
from app.schemas.assessment import ProjectAssessmentRead
from app.schemas.project_type import ProjectTypeRead


def _quantize_gis_coord(value: object) -> Decimal:
    return Decimal(str(round(float(value), 6)))


class LocationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    division: str
    district: str
    upazila: str
    union_name: str


class DuplicateMatchRead(BaseModel):
    project_id: int
    project_code: str
    project_name: str
    reason: str


class ProjectCreate(BaseModel):
    project_name: str = Field(min_length=1, max_length=255)
    project_type_id: int = Field(gt=0)
    location_id: int = Field(gt=0)
    latitude: Decimal = Field(ge=Decimal("20.0"), le=Decimal("27.0"), max_digits=9, decimal_places=6)
    longitude: Decimal = Field(ge=Decimal("88.0"), le=Decimal("93.0"), max_digits=9, decimal_places=6)
    custom_data: dict[str, Any] = Field(default_factory=dict)
    submit: bool = False
    parent_project_id: Optional[int] = Field(default=None, gt=0)
    phase_number: Optional[int] = Field(default=None, ge=2, le=99)
    is_follow_up_phase: bool = False

    @field_validator("latitude", "longitude", mode="before")
    @classmethod
    def _round_gis_coords(cls, v: object) -> object:
        if v is None or v == "":
            return v
        return _quantize_gis_coord(v)


class ProjectUpdate(BaseModel):
    project_name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    project_type_id: Optional[int] = Field(default=None, gt=0)
    location_id: Optional[int] = Field(default=None, gt=0)
    latitude: Optional[Decimal] = Field(
        default=None, ge=Decimal("20.0"), le=Decimal("27.0"), max_digits=9, decimal_places=6,
    )
    longitude: Optional[Decimal] = Field(
        default=None, ge=Decimal("88.0"), le=Decimal("93.0"), max_digits=9, decimal_places=6,
    )
    custom_data: Optional[dict[str, Any]] = None
    estimated_cost: Optional[Decimal] = Field(default=None, gt=0, max_digits=15, decimal_places=2)
    current_situation: Optional[str] = Field(default=None, max_length=2000)
    development_status: Optional[str] = Field(default=None, max_length=2000)
    pio_remarks: Optional[str] = Field(default=None, max_length=2000)
    uno_remarks: Optional[str] = Field(default=None, max_length=2000)
    uno_decision: Optional[str] = Field(default=None, max_length=20)

    @field_validator("latitude", "longitude", mode="before")
    @classmethod
    def _round_gis_coords(cls, v: object) -> object:
        if v is None or v == "":
            return v
        return _quantize_gis_coord(v)


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_code: str
    project_name: str
    project_type_id: int
    project_type: Optional[ProjectTypeRead] = None
    location_id: int
    location: Optional[LocationSummary] = None
    latitude: Decimal
    longitude: Decimal
    workflow_status: str
    custom_data: dict[str, Any] = Field(default_factory=dict)
    estimated_cost: Optional[Decimal] = None
    current_situation: Optional[str] = None
    development_status: Optional[str] = None
    pio_remarks: Optional[str] = None
    uno_remarks: Optional[str] = None
    uno_decision: Optional[str] = None
    is_duplicate_flag: bool = False
    duplicate_reason: Optional[str] = None
    is_impractical_budget_flag: bool = False
    impractical_budget_reason: Optional[str] = None
    parent_project_id: Optional[int] = None
    phase_number: Optional[int] = None
    project_group_id: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    editable_fields: list[str] = Field(default_factory=list)
    duplicate_matches: list[DuplicateMatchRead] = Field(default_factory=list)
    assessment: Optional[ProjectAssessmentRead] = None

    @field_validator("project_group_id", mode="before")
    @classmethod
    def _coerce_project_group_id(cls, v: object) -> str | None:
        if v is None:
            return None
        if isinstance(v, UUID):
            return str(v)
        return str(v)


class PioForwardRequest(BaseModel):
    remarks: Optional[str] = Field(default=None, max_length=2000)


class PioFlagRequest(BaseModel):
    duplicate: bool = False
    duplicate_reason: Optional[str] = Field(default=None, max_length=1000)
    impractical_budget: bool = False
    impractical_budget_reason: Optional[str] = Field(default=None, max_length=1000)


class UnoDecideRequest(BaseModel):
    decision: str = Field(pattern="^(approved|rejected)$")
    remarks: Optional[str] = Field(default=None, max_length=2000)
    custom_data: Optional[dict[str, Any]] = None


class WorkflowEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    actor_id: Optional[int] = None
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    action: str
    remarks: Optional[str] = None
    field_changes: Optional[dict[str, Any]] = None
    created_at: datetime
