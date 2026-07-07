"""Agent registry inspection (admin/debug).

Exposes what the multi-agent runtime can do. Read-only; admin-scoped.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.agents.registry import get_registry
from app.api.deps import require_admin
from app.schemas.agent import AgentCard, AgentHealth

router = APIRouter(tags=["agents"], dependencies=[Depends(require_admin)])


@router.get("/agents/registry", response_model=list[AgentCard])
async def registry() -> list[AgentCard]:
    return get_registry().cards()


@router.get("/agents/health", response_model=list[AgentHealth])
async def agents_health() -> list[AgentHealth]:
    reg = get_registry()
    return [await a.healthcheck() for a in reg.agents]
