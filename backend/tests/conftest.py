"""Test fixtures."""

from __future__ import annotations

import os

# Use HTTP client against a running container by default. These are smoke
# tests intended to run after `docker compose up`.
os.environ.setdefault("BACKEND_BASE_URL", "http://localhost:8000")
