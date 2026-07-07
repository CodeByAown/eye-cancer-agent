"""In-process multi-agent runtime.

Per docs/05-multi-agent.md, agents start in-process behind the Workflow
Orchestrator and can later graduate to standalone services (HTTP/gRPC) without
contract changes. This package is that in-process runtime.
"""

from app.agents.base import BaseAgent
from app.agents.orchestrator import Orchestrator, get_orchestrator
from app.agents.registry import AgentRegistry, get_registry

__all__ = [
    "AgentRegistry",
    "BaseAgent",
    "Orchestrator",
    "get_orchestrator",
    "get_registry",
]
