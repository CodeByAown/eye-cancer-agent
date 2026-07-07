"""Skin cancer model — real HAM10000 MobileNetV3 via ONNX Runtime."""

from __future__ import annotations

from app.services.cancer.base import CancerFinding, CancerModel, ClassScore
from app.services.onnx.classifier import OnnxImageClassifier
from app.services.onnx.registry import SKIN_HAM10000, SKIN_MALIGNANT


def _severity(raw_label: str, confidence: float) -> str:
    """Map class + confidence to a screening severity band."""
    if raw_label == "mel":  # melanoma
        return "severe" if confidence >= 0.5 else "moderate"
    if raw_label in {"bcc", "akiec"}:  # carcinomas / pre-cancer
        return "moderate" if confidence >= 0.4 else "mild"
    return "none"  # benign classes (nv, bkl, df, vasc)


class SkinCancerOnnxModel(CancerModel):
    name = SKIN_HAM10000.name
    version = SKIN_HAM10000.version
    modality = "dermoscopy"
    supports_gradcam = True  # CNN — Grad-CAM feasible (added in a later increment)

    def __init__(self) -> None:
        self._clf = OnnxImageClassifier(SKIN_HAM10000)

    async def analyze(self, image: bytes, *, context: dict | None = None) -> CancerFinding:
        ranked = await self._clf.classify_all(image)
        top = ranked[0]
        malignant = top.label in SKIN_MALIGNANT
        severity = _severity(top.label, top.prob)

        observations = [
            f"Top prediction: {top.display} ({top.prob * 100:.1f}%).",
            "Malignant/pre-malignant pattern." if malignant else "Benign-appearing pattern.",
        ]

        return CancerFinding(
            top_label=top.display,
            raw_label=top.label,
            confidence=top.prob,
            severity=severity,
            malignant=malignant,
            classes=[
                ClassScore(label=r.label, display=r.display, prob=r.prob) for r in ranked
            ],
            observations=observations,
            model_name=self.name,
            model_version=self.version,
            supports_gradcam=self.supports_gradcam,
        )
