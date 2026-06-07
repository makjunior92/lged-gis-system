"""Dynamic form schema definitions."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class FormSchemaKey(str, Enum):
    PROJECT_SUBMISSION = "project_submission"
    CHAIRMAN_USER_CREATE = "chairman_user_create"
    PIO_USER_CREATE = "pio_user_create"
    UNO_USER_CREATE = "uno_user_create"
    PIO_REVIEW = "pio_review"
    UNO_REVIEW = "uno_review"


class FieldType(str, Enum):
    TEXT = "text"
    TEXTAREA = "textarea"
    NUMBER = "number"
    DATE = "date"
    SELECT = "select"
    MAP_COORDS = "map_coords"


ALLOWED_FIELD_TYPES = tuple(t.value for t in FieldType)
_FIELD_TYPE_SQL = ", ".join(f"'{t}'" for t in ALLOWED_FIELD_TYPES)


class FormSchema(Base):
    __tablename__ = "form_schemas"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    updated_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    fields: Mapped[list["FormFieldDefinition"]] = relationship(
        back_populates="schema", cascade="all, delete-orphan", order_by="FormFieldDefinition.display_order"
    )


class FormFieldDefinition(Base):
    __tablename__ = "form_field_definitions"
    __table_args__ = (
        UniqueConstraint("schema_id", "field_key", name="uq_form_field_schema_key"),
        CheckConstraint(
            f"field_type IN ({_FIELD_TYPE_SQL})",
            name="form_field_type_check",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    schema_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("form_schemas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    field_key: Mapped[str] = mapped_column(String(80), nullable=False)
    label_en: Mapped[str] = mapped_column(String(150), nullable=False)
    label_bn: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    field_type: Mapped[str] = mapped_column(String(20), nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    section: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    options_json: Mapped[Optional[list[Any]]] = mapped_column(JSONB, nullable=True)
    validation_json: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    visible_to_chairman: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    editable_by_pio: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    editable_by_uno: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    visible_to_uno: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    schema: Mapped["FormSchema"] = relationship(back_populates="fields")
