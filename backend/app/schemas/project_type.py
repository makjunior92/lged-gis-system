"""Project type schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ProjectTypeBase(BaseModel):
    code: str = Field(min_length=1, max_length=30)
    name_en: str = Field(min_length=1, max_length=100)
    name_bn: Optional[str] = Field(default=None, max_length=150)
    is_active: bool = True
    sort_order: int = 0


class ProjectTypeCreate(ProjectTypeBase):
    pass


class ProjectTypeUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=1, max_length=30)
    name_en: Optional[str] = Field(default=None, min_length=1, max_length=100)
    name_bn: Optional[str] = Field(default=None, max_length=150)
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class ProjectTypeRead(ProjectTypeBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
