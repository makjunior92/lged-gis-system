"""Assessment settings and result schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.assessment import AssessmentRuleKey, AssessmentRuleType

ALLOWED_RULE_KEYS = {k.value for k in AssessmentRuleKey}
ALLOWED_RULE_TYPES = {t.value for t in AssessmentRuleType}


class AssessmentConfigRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    pass_threshold: int
    version: int
    updated_at: datetime


class AssessmentConfigUpdate(BaseModel):
    pass_threshold: int = Field(ge=0, le=100)


class AssessmentRuleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    rule_key: str
    display_name: str
    rule_type: str
    weight: Optional[int] = None
    params: dict[str, Any] = Field(default_factory=dict)
    failure_message: str
    is_active: bool
    sort_order: int


class AssessmentRuleCreate(BaseModel):
    rule_key: str
    display_name: str = Field(min_length=1, max_length=120)
    rule_type: str
    weight: Optional[int] = Field(default=None, ge=0, le=100)
    params: dict[str, Any] = Field(default_factory=dict)
    failure_message: str = Field(min_length=1, max_length=500)
    is_active: bool = True
    sort_order: int = 0

    @field_validator("rule_key")
    @classmethod
    def validate_rule_key(cls, v: str) -> str:
        if v not in ALLOWED_RULE_KEYS:
            raise ValueError(f"rule_key must be one of: {sorted(ALLOWED_RULE_KEYS)}")
        return v

    @field_validator("rule_type")
    @classmethod
    def validate_rule_type(cls, v: str) -> str:
        if v not in ALLOWED_RULE_TYPES:
            raise ValueError(f"rule_type must be one of: {sorted(ALLOWED_RULE_TYPES)}")
        return v


class AssessmentRuleUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    rule_type: Optional[str] = None
    weight: Optional[int] = Field(default=None, ge=0, le=100)
    params: Optional[dict[str, Any]] = None
    failure_message: Optional[str] = Field(default=None, min_length=1, max_length=500)
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None

    @field_validator("rule_type")
    @classmethod
    def validate_rule_type(cls, v: str | None) -> str | None:
        if v is not None and v not in ALLOWED_RULE_TYPES:
            raise ValueError(f"rule_type must be one of: {sorted(ALLOWED_RULE_TYPES)}")
        return v


class AssessmentBreakdownItem(BaseModel):
    rule_key: str
    rule_type: str
    display_name: Optional[str] = None
    weight: Optional[int] = None
    earned: int = 0
    max: int = 0
    passed: bool = True
    message: str = ""
    matches: list[dict[str, Any]] = Field(default_factory=list)


class ProjectAssessmentRead(BaseModel):
    total_score: int
    passed: bool
    pass_threshold: int = 80
    breakdown: list[AssessmentBreakdownItem] = Field(default_factory=list)
    evaluated_at: Optional[datetime] = None


class EligibleParentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_code: str
    project_name: str
    phase_number: Optional[int] = None
    workflow_status: str
