"""Shared Pydantic schemas (pagination, etc.)."""

from __future__ import annotations

from math import ceil
from typing import Generic, List, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total_pages: int = Field(ge=0)

    @classmethod
    def build(cls, *, items: List[T], total: int, page: int, page_size: int):
        total_pages = int(ceil(total / page_size)) if page_size else 0
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )


class HealthResponse(BaseModel):
    status: str
    db: str
    version: str


class MessageResponse(BaseModel):
    message: str
