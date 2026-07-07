"""FastAPI application entrypoint.

Wires config, logging, middleware, error handling, metrics, routers, and the
in-process agent runtime. Lifespan handles startup (agents, dev DB) and
graceful shutdown (cache).
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from starlette.responses import Response

from app import __version__
from app.agents.registry import bootstrap_agents
from app.api.files import router as files_router
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging, get_logger
from app.db.session import create_all
from app.middleware import RequestContextMiddleware
from app.ratelimit import RateLimitMiddleware
from app.services.cache import cache

log = get_logger("app")


@asynccontextmanager
async def lifespan(_: FastAPI):  # type: ignore[no-untyped-def]
    configure_logging()
    log.info("startup", env=settings.app_env, version=__version__)

    # Dev/staging convenience: auto-create tables (SQLite or Postgres) so the app
    # is runnable without a migration step. Production is expected to run Alembic
    # migrations (not yet implemented) and sets APP_ENV=production to skip this.
    if not settings.is_production:
        await create_all()

    bootstrap_agents()
    await cache.client()  # initialize (Redis or in-memory fallback)

    # Warm specialist model weights in the background so the first inference
    # request is fast (avoids downloading 100+ MB inside a user request).
    import asyncio

    from app.services.onnx import warm_models

    warm_task = asyncio.create_task(warm_models())

    yield

    warm_task.cancel()
    await cache.close()
    log.info("shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        description="Multi-agent AI Medical Vision Platform API",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    register_exception_handlers(app)

    app.include_router(api_router)
    app.include_router(files_router)

    @app.get("/metrics", include_in_schema=False)
    async def metrics() -> Response:
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    @app.get("/", include_in_schema=False)
    async def root() -> dict:
        return {
            "name": settings.app_name,
            "version": __version__,
            "docs": "/docs",
            "health": "/api/v1/health",
        }

    return app


app = create_app()
