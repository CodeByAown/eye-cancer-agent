"""Oncology Agent — runs specialist cancer classifiers (real ONNX models)."""

from __future__ import annotations

from app.agents.base import BaseAgent
from app.core.logging import get_logger
from app.observability.metrics import inference_confidence, inference_duration_seconds
from app.schemas.agent import AgentRequest, AgentResponse, AgentStatus
from app.services.cancer import get_cancer_model
from app.services.storage import get_storage

log = get_logger("agent.oncology")

# Map scan modality → cancer model modality.
_MODALITY = {"dermoscopy": "dermoscopy", "skin": "dermoscopy"}


class OncologyAgent(BaseAgent):
    name = "oncology"
    description = "Specialist cancer classification (skin HAM10000 now; brain/others next)."
    capabilities = ["classify.cancer", "classify.skin"]
    llm_backed = False  # real ONNX CNN, not an LLM

    async def handle(self, req: AgentRequest) -> AgentResponse:
        source_uri = req.payload.get("source_uri")
        if not source_uri:
            return AgentResponse(
                request_id=req.request_id,
                agent=self.name,
                status=AgentStatus.ERROR,
                result={"reason": "no source_uri in payload"},
            )

        modality = _MODALITY.get(req.payload.get("modality") or "dermoscopy", "dermoscopy")
        try:
            model = get_cancer_model(modality)
        except ValueError as exc:
            return AgentResponse(
                request_id=req.request_id,
                agent=self.name,
                status=AgentStatus.ERROR,
                result={"reason": str(exc)},
            )

        data = await get_storage().get(source_uri)
        with inference_duration_seconds.labels(model.name, modality).time():
            finding = await model.analyze(data, context=req.context)

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
                    "malignant": finding.malignant,
                    "raw_label": finding.raw_label,
                    "supports_gradcam": finding.supports_gradcam,
                    "modality": modality,
                },
            },
        )
