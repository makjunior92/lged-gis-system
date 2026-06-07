"""Application configuration via environment variables (pydantic-settings)."""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated, List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    PROJECT_NAME: str = "LGED Rural Infrastructure GIS Management System"
    PROJECT_VERSION: str = "0.1.0"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = Field(default="development")

    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://lged:lged_dev_pw@db:5432/lged_gis",
    )

    JWT_SECRET_KEY: str = Field(default="change_me_in_prod")
    JWT_ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)

    # NoDecode tells pydantic-settings NOT to try JSON-decoding the raw env value
    # (the comma-separated string is handled by `_split_cors` below instead).
    CORS_ORIGINS: Annotated[List[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://localhost:3000"]
    )

    SEED_ON_STARTUP: bool = Field(default=True)
    # Re-sync seeded demo account passwords on startup (dev/demo only).
    SEED_RESET_DEMO_PASSWORDS: bool = Field(default=True)
    SEED_IMPORT_BOUNDARIES: bool = Field(default=True)
    BOUNDARY_GEOJSON_ADM3: str | None = Field(default=None)
    BOUNDARY_GEOJSON_ADM4: str | None = Field(default=None)

    LOG_LEVEL: str = Field(default="INFO")

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_cors(cls, v):
        if isinstance(v, str):
            return [item.strip() for item in v.split(",") if item.strip()]
        return v


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
