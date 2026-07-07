"""Vision Processing Agent — image validation & quality gate.

First real pipeline stage: loads the stored image, decodes it, and runs the
quality assessment (blur/brightness). A failed gate REJECTS the pipeline so we
never run inference on an unusable frame.
"""

from __future__ import annotations

from app.agents.base import BaseAgent
from app.core.logging import get_logger
from app.schemas.agent import AgentRequest, AgentResponse, AgentStatus
from app.services import imaging
from app.services.storage import get_storage

log = get_logger("agent.vision")


class VisionAgent(BaseAgent):
    name = "vision"
    description = "Image validation, quality assessment (blur/brightness), preprocessing."
    capabilities = ["validate.image", "preprocess.image"]

    async def handle(self, req: AgentRequest) -> AgentResponse:
        source_uri = req.payload.get("source_uri")
        if not source_uri:
            return AgentResponse(
                request_id=req.request_id,
                agent=self.name,
                status=AgentStatus.ERROR,
                result={"reason": "no source_uri in payload"},
            )

        try:
            data = await get_storage().get(source_uri)
            img = imaging.decode(data)
        except Exception as exc:
            return AgentResponse(
                request_id=req.request_id,
                agent=self.name,
                status=AgentStatus.REJECTED,
                result={"is_valid": False, "reasons": [f"Unreadable image: {exc}"]},
            )

        quality = imaging.assess_quality(img)
        status = AgentStatus.OK if quality.is_valid else AgentStatus.REJECTED
        return AgentResponse(
            request_id=req.request_id,
            agent=self.name,
            status=status,
            result={
                "width": img.width,
                "height": img.height,
                **quality.as_dict(),
            },
            confidence=1.0 if quality.is_valid else 0.0,
        )
