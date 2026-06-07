"""JWT token + Argon2 password hashing helpers."""

from __future__ import annotations

import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Any

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from jose import JWTError, jwt

from app.core.config import settings

_password_hasher = PasswordHasher()


def hash_password(plain_password: str) -> str:
    return _password_hasher.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        _password_hasher.verify(password_hash, plain_password)
        return True
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def generate_temporary_password(length: int = 12) -> str:
    """Generate a URL-safe temporary password with mixed character classes."""
    alphabet = string.ascii_letters + string.digits + "@#$%"
    while True:
        candidate = "".join(secrets.choice(alphabet) for _ in range(length))
        if (
            any(c.islower() for c in candidate)
            and any(c.isupper() for c in candidate)
            and any(c.isdigit() for c in candidate)
        ):
            return candidate


def _create_token(
    *,
    subject: str,
    extra_claims: dict[str, Any] | None,
    expires_delta: timedelta,
    token_type: str,
) -> str:
    now = datetime.now(tz=timezone.utc)
    to_encode: dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "type": token_type,
    }
    if extra_claims:
        to_encode.update(extra_claims)
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(subject: str | int, extra_claims: dict[str, Any] | None = None) -> str:
    return _create_token(
        subject=str(subject),
        extra_claims=extra_claims,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        token_type="access",
    )


def create_refresh_token(subject: str | int) -> str:
    return _create_token(
        subject=str(subject),
        extra_claims=None,
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        token_type="refresh",
    )


def decode_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT. Raises JWTError on failure."""
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


__all__ = [
    "hash_password",
    "verify_password",
    "generate_temporary_password",
    "create_access_token",
    "create_refresh_token",
    "decode_token",
    "JWTError",
]
