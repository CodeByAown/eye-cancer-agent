"""Lightweight per-client rate limiting.

Fixed-window counter backed by the cache (Redis in prod, in-memory in dev). Keeps
the API resilient to abuse/runaway clients. Limits are generous so normal
dashboard polling and uploads are unaffected; tune via constants.

Health/metrics are exempt so monitoring is never throttled.
"""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.logging import get_logger
from app.services.cache import cache

log = get_logger("ratelimit")

WINDOW_SECONDS = 60
MAX_REQUESTS = 240  # per client per window
_EXEMPT_PREFIXES = ("/metrics", "/api/v1/health", "/api/v1/ready", "/files/")


def _client_key(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For")
    if fwd:  # noqa: SIM108 - nested ternary would be less readable
        ip = fwd.split(",")[0].strip()
    else:
        ip = request.client.host if request.client else "unknown"
    return f"rl:{ip}"


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        path = request.url.path
        if any(path.startswith(p) for p in _EXEMPT_PREFIXES):
            return await call_next(request)

        key = _client_key(request)
        try:
            client = await cache.client()
            count = await client.incr(key)
            if count == 1:
                await client.expire(key, WINDOW_SECONDS)
        except Exception:
            # Never fail a request because the limiter backend hiccuped.
            return await call_next(request)

        if count > MAX_REQUESTS:
            log.warning("rate_limited", key=key, count=count)
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "rate_limited",
                        "message": "Too many requests. Please slow down.",
                        "details": {"limit": MAX_REQUESTS, "window_seconds": WINDOW_SECONDS},
                    }
                },
                headers={"Retry-After": str(WINDOW_SECONDS)},
            )
        return await call_next(request)
