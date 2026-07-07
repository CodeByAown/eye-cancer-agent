"""Fundus diabetic-retinopathy model — real ResNet50/APTOS specialist via ONNX.

This is the specialist inference for Workflow B (fundus upload), replacing the
GPT-4o-vision path for retinal grading. OpenAI is used only for narrating the
structured DR grade in the report/chat.
"""

from __future__ import annotations

from app.services.eye.base import ClassScore, EyeFinding, EyeModel, EyeScope
from app.services.onnx.classifier import OnnxImageClassifier
from app.services.onnx.registry import FUNDUS_APTOS_DR, FUNDUS_DR_SEVERITY


class FundusDrOnnxModel(EyeModel):
    name = FUNDUS_APTOS_DR.name
    version = FUNDUS_APTOS_DR.version
    supports_gradcam = True  # CNN — Grad-CAM feasible (added later)

    def __init__(self) -> None:
        self._clf = OnnxImageClassifier(FUNDUS_APTOS_DR)

    async def analyze(
        self, image: bytes, *, scope: EyeScope, context: dict | None = None
    ) -> EyeFinding:
        ranked = await self._clf.classify_all(image)
        top = ranked[0]
        severity = FUNDUS_DR_SEVERITY.get(top.label, "none")
        referable = top.label not in {"No DR", "Mild DR"}

        observations = [
            f"Predicted grade: {top.display} ({top.prob * 100:.1f}%).",
            "Referable DR — ophthalmology review advised."
            if referable
            else "Non-referable grade on this image.",
        ]
        recommendations = (
            [
                "Refer to an ophthalmologist for dilated fundus examination.",
                "Optimize glycemic and blood-pressure control.",
            ]
            if referable
            else ["Continue routine diabetic eye screening."]
        )

        return EyeFinding(
            top_label=top.display,
            confidence=top.prob,
            severity=severity,
            classes=[ClassScore(label=r.label, prob=r.prob) for r in ranked],
            observations=observations,
            rationale=(
                f"A specialist ResNet50 model trained on APTOS graded this fundus as "
                f"{top.display} with {top.prob * 100:.1f}% confidence."
            ),
            recommendations=recommendations,
            model_name=self.name,
            model_version=self.version,
            inconclusive=False,
        )
