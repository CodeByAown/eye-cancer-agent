"""Liveness & readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app import __version__
from app.core.config import settings
from app.core.security import fetch_clerk_jwks_ok
from app.db.session import ping as db_ping
from app.schemas.common import HealthStatus, ReadinessStatus
from app.services.ai import get_ai_service
from app.services.cache import cache

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthStatus)
async def health() -> HealthStatus:
    """Liveness — process is up."""
    return HealthStatus(status="ok", version=__version__, environment=settings.app_env)


@router.get("/ready", response_model=ReadinessStatus)
async def ready() -> ReadinessStatus:
    """Readiness — dependencies are reachable."""
    checks = {
        "database": await db_ping(),
        "cache": await cache.ping(),
        "auth": await fetch_clerk_jwks_ok(),
        "ai": await get_ai_service().healthcheck(),
    }
    status = "ok" if all(checks.values()) else "degraded"
    return ReadinessStatus(status=status, checks=checks)
