"""Authentication & authorization.

Production: verify Clerk-issued JWTs against Clerk's JWKS (RS256).
Development: `DEV_AUTH_BYPASS=true` injects a stable dev user so the app is
fully usable without a Clerk account.

Users are provisioned into our DB on first sight (JIT provisioning), keyed by
the token's `sub` (Clerk user id) stored as `User.external_id`.
"""

from __future__ import annotations

import time
from typing import Any

import httpx
import jwt
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AuthError
from app.core.logging import get_logger
from app.models.enums import Role
from app.models.user import User
from app.schemas.user import CurrentUser

log = get_logger(__name__)

_DEV_EXTERNAL_ID = "dev-user"
_DEV_EMAIL = "dev@localhost"

_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        if not settings.clerk_jwks_url:
            raise AuthError("Auth is not configured (CLERK_JWKS_URL missing).")
        _jwks_client = PyJWKClient(settings.clerk_jwks_url)
    return _jwks_client


def _decode_clerk_token(token: str) -> dict[str, Any]:
    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        claims: dict[str, Any] = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.clerk_audience,
            issuer=settings.clerk_issuer,
            options={"verify_aud": bool(settings.clerk_audience)},
        )
        return claims
    except jwt.PyJWTError as exc:
        raise AuthError(f"Invalid token: {exc}") from exc


async def _provision_user(
    session: AsyncSession,
    *,
    external_id: str,
    email: str,
    full_name: str | None,
    role: Role = Role.CLINICIAN,
) -> User:
    result = await session.execute(select(User).where(User.external_id == external_id))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(external_id=external_id, email=email, full_name=full_name, role=role)
        session.add(user)
        await session.flush()
        log.info("user_provisioned", external_id=external_id)
    return user


async def resolve_user(token: str | None, session: AsyncSession) -> CurrentUser:
    """Resolve the authenticated principal from a bearer token (or dev bypass)."""
    if settings.dev_auth_bypass:
        user = await _provision_user(
            session,
            external_id=_DEV_EXTERNAL_ID,
            email=_DEV_EMAIL,
            full_name="Dev User",
            role=Role.ADMIN,
        )
    else:
        if not token:
            raise AuthError("Missing bearer token.")
        claims = _decode_clerk_token(token)
        external_id = claims.get("sub")
        if not external_id:
            raise AuthError("Token missing subject.")
        email = claims.get("email") or f"{external_id}@users.noreply"
        name = claims.get("name") or claims.get("full_name")
        user = await _provision_user(
            session, external_id=external_id, email=email, full_name=name
        )

    return CurrentUser(
        id=user.id,
        external_id=user.external_id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        organization_id=user.organization_id,
    )


async def fetch_clerk_jwks_ok() -> bool:
    """Readiness helper: confirm JWKS is reachable when auth is enabled."""
    if settings.dev_auth_bypass or not settings.clerk_jwks_url:
        return True
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get(settings.clerk_jwks_url)
            return r.status_code == 200
    except Exception:
        return False


# small utility used by rate limiting / tokens
def now() -> float:
    return time.time()
