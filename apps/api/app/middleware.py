"""HTTP middleware: request-id propagation + access logging + metrics."""

from __future__ import annotations

import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.logging import get_logger, request_id_ctx
from app.observability.metrics import (
    http_request_duration_seconds,
    http_requests_total,
)

log = get_logger("http")

# Paths we don't want to spam metrics/labels for (avoid label cardinality blowups).
_UNLABELED = {"/metrics", "/favicon.ico"}


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[no-untyped-def]
        rid = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        token = request_id_ctx.set(rid)
        start = time.perf_counter()

        # Use the route template (not the raw path) as the metric label to keep
        # cardinality bounded; fall back to raw path pre-routing.
        route = request.scope.get("route")
        path_label = getattr(route, "path", request.url.path)

        try:
            response: Response = await call_next(request)
        except Exception:
            elapsed = time.perf_counter() - start
            log.error(
                "request_failed",
                method=request.method,
                path=request.url.path,
                elapsed=elapsed,
            )
            raise
        finally:
            request_id_ctx.reset(token)

        elapsed = time.perf_counter() - start
        response.headers["X-Request-ID"] = rid

        if request.url.path not in _UNLABELED:
            http_requests_total.labels(request.method, path_label, response.status_code).inc()
            http_request_duration_seconds.labels(request.method, path_label).observe(elapsed)
            log.info(
                "request",
                method=request.method,
                path=request.url.path,
                status=response.status_code,
                ms=round(elapsed * 1000, 1),
            )
        return response
