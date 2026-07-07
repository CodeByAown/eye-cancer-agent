"""Eye Specialist Agent — runs the real eye inference model.

Consumes the stored image, invokes the pluggable `EyeModel` (OpenAI-vision by
default), and returns a structured finding the orchestrator/report/chat consume.
Handles both the live-scanner (anterior) and upload (anterior/fundus) flows.
"""

from __future__ import annotations

from app.agents.base import BaseAgent
from app.core.logging import get_logger
from app.observability.metrics import inference_confidence, inference_duration_seconds
from app.schemas.agent import AgentRequest, AgentResponse, AgentStatus
from app.services.eye import EyeScope, get_eye_model
from app.services.storage import get_storage

log = get_logger("agent.eye")


class EyeSpecialistAgent(BaseAgent):
    name = "eye_specialist"
    description = "Anterior & fundus eye analysis via the pluggable EyeModel."
    capabilities = ["classify.anterior", "classify.fundus"]
    llm_backed = True  # default model is vision-LLM backed

    async def handle(self, req: AgentRequest) -> AgentResponse:
        source_uri = req.payload.get("source_uri")
        if not source_uri:
            return AgentResponse(
                request_id=req.request_id,
                agent=self.name,
                status=AgentStatus.ERROR,
                result={"reason": "no source_uri in payload"},
            )

        scope = EyeScope.FUNDUS if req.task == "classify.fundus" else EyeScope.ANTERIOR
        model = get_eye_model(scope)

        data = await get_storage().get(source_uri)
        with inference_duration_seconds.labels(model.name, scope.value).time():
            finding = await model.analyze(data, scope=scope, context=req.context)

        inference_confidence.labels(model.name).observe(finding.confidence)

        return AgentResponse(
            request_id=req.request_id,
            agent=self.name,
            status=AgentStatus.OK,
            confidence=finding.confidence,
            result={
                "top_label": finding.top_label,
                "classes": [c.model_dump() for c in finding.classes],
                "severity": finding.severity,
                "model_name": finding.model_name,
                "model_version": finding.model_version,
                "explanation": {
                    "observations": finding.observations,
                    "rationale": finding.rationale,
                    "recommendations": finding.recommendations,
                    "inconclusive": finding.inconclusive,
                    "scope": scope.value,
                },
            },
        )
