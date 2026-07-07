"""Aggregates all v1 routers under /api/v1."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import agents, health, me, scans, stats

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(me.router)
api_router.include_router(scans.router)
api_router.include_router(stats.router)
api_router.include_router(agents.router)
