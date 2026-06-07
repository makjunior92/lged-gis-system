"""Smoke tests against the running backend container.

Run with `pytest` after `docker compose up -d db backend`.
Pointed at a different host with `BACKEND_BASE_URL=http://my-host:8000 pytest`.
"""

from __future__ import annotations

import os

import httpx
import pytest

BASE_URL = os.environ.get("BACKEND_BASE_URL", "http://localhost:8000")


@pytest.mark.asyncio
async def test_health_returns_ok():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        resp = await client.get("/health")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "ok"
    assert body["db"] == "ok"
    assert "version" in body


@pytest.mark.asyncio
async def test_login_with_seeded_admin_returns_jwt():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "Admin@123"},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["user"]["username"] == "admin"
    assert body["user"]["role"] == "Super Admin"


@pytest.mark.asyncio
async def test_login_rejects_bad_password():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": "wrong-password"},
        )
    assert resp.status_code == 401
