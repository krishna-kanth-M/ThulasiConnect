"""Password hashing (Argon2id) and JWT token helpers."""

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from app.core.config import get_settings

_ph = PasswordHasher(time_cost=2, memory_cost=65536, parallelism=2)


def hash_password(plain_password: str) -> str:
    return _ph.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return _ph.verify(password_hash, plain_password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def create_access_token(
    subject: str,
    roles: list[str],
    extra_claims: dict[str, Any] | None = None,
    expires_delta: timedelta | None = None,
) -> tuple[str, str, datetime]:
    settings = get_settings()
    now = datetime.now(UTC)
    expire = now + (expires_delta or timedelta(minutes=settings.jwt_access_token_expire_minutes))
    jti = str(uuid.uuid4())
    payload: dict[str, Any] = {
        "sub": subject,
        "roles": roles,
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    if extra_claims:
        payload.update(extra_claims)
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, jti, expire


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)
