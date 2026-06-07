"""User-related schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.user import ALLOWED_ROLES


class UserBase(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    full_name: str = Field(min_length=1, max_length=100)
    full_name_bn: Optional[str] = Field(default=None, max_length=150)
    email: Optional[EmailStr] = None
    employee_id: Optional[str] = Field(default=None, max_length=40)
    designation: Optional[str] = Field(default=None, max_length=120)
    role: str
    nid_number: Optional[str] = Field(default=None, max_length=20)
    address: Optional[str] = Field(default=None, max_length=500)
    assigned_region: Optional[int] = None
    assigned_upazila_key: Optional[str] = Field(default=None, max_length=120)
    custom_data: dict[str, Any] = Field(default_factory=dict)

    @field_validator("role")
    @classmethod
    def _check_role(cls, v: str) -> str:
        if v not in ALLOWED_ROLES:
            raise ValueError(f"role must be one of: {', '.join(ALLOWED_ROLES)}")
        return v


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=200)


class UserUpdate(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=50)
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    full_name_bn: Optional[str] = Field(default=None, max_length=150)
    email: Optional[EmailStr] = None
    employee_id: Optional[str] = Field(default=None, max_length=40)
    designation: Optional[str] = Field(default=None, max_length=120)
    role: Optional[str] = None
    nid_number: Optional[str] = Field(default=None, max_length=20)
    address: Optional[str] = Field(default=None, max_length=500)
    assigned_region: Optional[int] = None
    assigned_upazila_key: Optional[str] = Field(default=None, max_length=120)
    custom_data: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None

    @field_validator("role")
    @classmethod
    def _check_role(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ALLOWED_ROLES:
            raise ValueError(f"role must be one of: {', '.join(ALLOWED_ROLES)}")
        return v


class RegionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    division: str
    district: str
    upazila: str
    union_name: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    full_name: str
    full_name_bn: Optional[str] = None
    email: Optional[str] = None
    employee_id: Optional[str] = None
    designation: Optional[str] = None
    role: str
    nid_number: Optional[str] = None
    address: Optional[str] = None
    assigned_region: Optional[int] = None
    assigned_upazila_key: Optional[str] = None
    region: Optional[RegionSummary] = None
    custom_data: dict[str, Any] = Field(default_factory=dict)
    is_active: bool
    last_login: Optional[datetime] = None
    created_at: datetime

    @field_validator("custom_data", mode="before")
    @classmethod
    def _coerce_custom_data(cls, v: Any) -> dict[str, Any]:
        return v if isinstance(v, dict) else {}


class TemporaryPasswordResponse(BaseModel):
    user_id: int
    username: str
    temporary_password: str
    message: str = (
        "Please share this temporary password with the user securely. "
        "They should change it on next login."
    )
