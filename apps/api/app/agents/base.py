"""Base agent abstraction.

Every worker agent subclasses `BaseAgent`, declares its `capabilities`, and
implements `handle`. The base wraps each invocation with timing, metrics,
error isolation, and a consistent `AgentResponse` envelope so individual agents
stay small and focused.
"""

from __future__ import annotations

import abc
import time

from app.core.logging import get_logger
from app.observability.metrics import agent_runs_total
from app.schemas.agent import (
    AgentCard,
    AgentError,
    AgentHealth,
    AgentRequest,
    AgentResponse,
    AgentStatus,
)

log = get_logger("agent")


class BaseAgent(abc.ABC):
    name: str = "base"
    description: str = ""
    capabilities: list[str] = []
    llm_backed: bool = False

    @abc.abstractmethod
    async def handle(self, req: AgentRequest) -> AgentResponse:
        """Perform the agent's task. Raise to signal a retryable failure."""
        ...

    async def run(self, req: AgentRequest) -> AgentResponse:
        """Public entrypoint used by the orchestrator (adds timing + safety)."""
        start = time.perf_counter()
        try:
            resp = await self.handle(req)
            status = resp.status
        except Exception as exc:  # isolate agent failures
            log.error("agent_error", agent=self.name, task=req.task, error=str(exc))
            resp = AgentResponse(
                request_id=req.request_id,
                agent=self.name,
                status=AgentStatus.ERROR,
                error=AgentError(code="agent_exception", message=str(exc), retryable=True),
            )
            status = AgentStatus.ERROR

        elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
        resp.trace.setdefault("elapsed_ms", elapsed_ms)
        resp.trace.setdefault("agent", self.name)
        agent_runs_total.labels(self.name, req.task, status.value).inc()
        return resp

    def can(self, task: str) -> bool:
        return task in self.capabilities

    def card(self) -> AgentCard:
        return AgentCard(
            name=self.name,
            capabilities=list(self.capabilities),
            description=self.description,
            llm_backed=self.llm_backed,
        )

    async def healthcheck(self) -> AgentHealth:
        return AgentHealth(name=self.name, healthy=True, capabilities=list(self.capabilities))
