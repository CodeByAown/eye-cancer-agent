"""The uniform agent contract.

Every worker agent (Vision, Eye Specialist, Oncology, Explainability, Report,
Education, Chat) speaks this envelope. The Workflow Orchestrator dispatches
`AgentRequest` and aggregates `AgentResponse`. Keeping this stable is what makes
new medical specialties plug-in rather than a refactor (see docs/05-multi-agent.md).

Large binary data (images, heatmaps, PDFs) is always passed BY REFERENCE
(storage keys/URIs), never inline bytes.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class AgentStatus(StrEnum):
    OK = "ok"
    ERROR = "error"
    REJECTED = "rejected"  # e.g. failed a quality gate


class AgentRequest(BaseModel):
    request_id: str = Field(..., description="Correlates all hops of one orchestrated run")
    scan_id: str | None = Field(default=None)
    task: str = Field(..., description="Capability, e.g. 'classify.fundus', 'explain.gradcam'")
    payload: dict[str, Any] = Field(default_factory=dict, description="Refs + prior results")
    context: dict[str, Any] = Field(default_factory=dict, description="user/org, locale, policy")


class AgentError(BaseModel):
    code: str
    message: str
    retryable: bool = False


class AgentResponse(BaseModel):
    request_id: str
    agent: str
    status: AgentStatus
    result: dict[str, Any] = Field(default_factory=dict)
    confidence: float | None = None
    artifacts: list[str] = Field(default_factory=list, description="Storage keys produced")
    trace: dict[str, Any] = Field(
        default_factory=dict, description="timings, model_version, tokens"
    )
    error: AgentError | None = None


class AgentHealth(BaseModel):
    name: str
    healthy: bool
    capabilities: list[str] = Field(default_factory=list)
    detail: dict[str, Any] = Field(default_factory=dict)


class AgentCard(BaseModel):
    """Discovery metadata exposed via the agent registry."""

    name: str
    capabilities: list[str]
    description: str = ""
    llm_backed: bool = False
