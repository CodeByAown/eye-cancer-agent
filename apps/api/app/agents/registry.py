"""Agent registry — capability-based discovery.

The orchestrator asks the registry "who can do task X?" rather than hard-coding
agents. Registering a new agent is all that's needed to extend the platform.
"""

from __future__ import annotations

from functools import lru_cache

from app.agents.base import BaseAgent
from app.core.errors import AppError
from app.core.logging import get_logger
from app.schemas.agent import AgentCard

log = get_logger("agent.registry")


class NoCapableAgentError(AppError):
    code = "no_capable_agent"
    status_code = 501
    message = "No agent registered for the requested task."


class AgentRegistry:
    def __init__(self) -> None:
        self._agents: dict[str, BaseAgent] = {}

    def register(self, agent: BaseAgent) -> None:
        if agent.name in self._agents:
            log.warning("agent_reregister", agent=agent.name)
        self._agents[agent.name] = agent
        log.info("agent_registered", agent=agent.name, capabilities=agent.capabilities)

    def get(self, name: str) -> BaseAgent | None:
        return self._agents.get(name)

    def for_task(self, task: str) -> BaseAgent:
        for agent in self._agents.values():
            if agent.can(task):
                return agent
        raise NoCapableAgentError(f"No agent can handle task '{task}'.")

    def cards(self) -> list[AgentCard]:
        return [a.card() for a in self._agents.values()]

    @property
    def agents(self) -> list[BaseAgent]:
        return list(self._agents.values())


@lru_cache
def get_registry() -> AgentRegistry:
    """Singleton registry, populated at startup by `bootstrap_agents`."""
    return AgentRegistry()


def bootstrap_agents() -> AgentRegistry:
    """Register all available agents. Extend here as agents are implemented."""
    registry = get_registry()
    if registry.agents:  # already bootstrapped
        return registry

    from app.agents.eye import EyeSpecialistAgent
    from app.agents.oncology import OncologyAgent
    from app.agents.vision import VisionAgent

    registry.register(VisionAgent())
    registry.register(EyeSpecialistAgent())
    registry.register(OncologyAgent())
    return registry
