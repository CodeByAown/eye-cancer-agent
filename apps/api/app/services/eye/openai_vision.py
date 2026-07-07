"""OpenAI-vision eye analyzer.

Sends the preprocessed eye image to a vision LLM with a strict, guardrailed
medical-screening prompt and parses a structured `EyeFinding`. Real analysis
(not a stub); scoped to *visible* signs, framed as educational screening.

If the active AI provider is the mock (no key configured), returns a clear
"screening unavailable" finding so the app stays runnable without secrets.
"""

from __future__ import annotations

import json
import re

from app.core.config import settings
from app.core.logging import get_logger
from app.services.ai import get_ai_service
from app.services.eye.base import ClassScore, EyeFinding, EyeModel, EyeScope
from app.services.imaging import decode, preprocess, to_data_url

log = get_logger("eye.openai_vision")

_ANTERIOR_CONDITIONS = [
    "normal",
    "conjunctivitis",  # red eye / pink eye (bacterial, viral, or allergic)
    "blepharitis",  # eyelid margin inflammation
    "stye_hordeolum",  # lid lump / infection
    "chalazion",  # blocked meibomian gland
    "dry_eye",  # dryness / irritation
    "subconjunctival_hemorrhage",  # blood patch on sclera
    "pterygium",  # tissue growth on conjunctiva
    "corneal_opacity",  # cloudy/scarred cornea
    "cataract_suspect",  # visible lens clouding
    "eyelid_swelling",  # periorbital / lid edema
    "other_abnormality",
]

_FUNDUS_CONDITIONS = [
    "normal",
    "diabetic_retinopathy",
    "glaucoma_suspect",
    "amd",
    "hypertensive_retinopathy",
    "other_retinal_abnormality",
]

_SYSTEM_ANTERIOR = (
    "You are an ophthalmology screening assistant analyzing an EXTERNAL (anterior-segment) "
    "photograph of a human eye. Systematically assess each visible structure and report what "
    "you actually see: (1) sclera — white vs redness/injection, any blood patch; "
    "(2) conjunctiva — inflammation, discharge (watery/mucopurulent); (3) cornea — clarity vs "
    "cloudiness/opacity; (4) iris & pupil — visible, symmetry; (5) lens — any visible clouding "
    "(cataract); (6) eyelids/margins — swelling, crusting, lumps (stye/chalazion), blepharitis; "
    "(7) any growths (pterygium) or lesions. Then give the single most likely condition, "
    "calibrated confidence, and severity. You CANNOT assess the retina (that needs a fundus "
    "image). This is educational screening, NOT a diagnosis. If the image is not a clearly "
    "visible human eye, set top_label to 'unclear' with low confidence."
)

_SYSTEM_FUNDUS = (
    "You are an ophthalmology screening assistant analyzing a FUNDUS (retinal) photograph. "
    "Comment on visible retinal signs (microaneurysms, hemorrhages, exudates, optic disc "
    "cup/disc ratio, macular changes). This is educational screening, not a diagnosis. Be "
    "calibrated and conservative; if the image is unclear or not a fundus photo, say so. "
    "Note: a specialized retinal model is recommended for clinical-grade grading."
)


def _prompt(conditions: list[str]) -> str:
    return (
        "Analyze the eye image and respond with ONLY a JSON object (no prose, no code fences) "
        "with this exact schema:\n"
        "{\n"
        '  "top_label": one of ' + json.dumps(conditions) + ' or "unclear",\n'
        '  "confidence": number 0..1 (be calibrated — low if the image is poor),\n'
        '  "severity": "none"|"mild"|"moderate"|"severe",\n'
        '  "classes": [{"label": string, "prob": number}],  // top 3 candidates, probs sum ~1\n'
        '  "observations": [4-6 concrete visual findings, one per structure you assessed — '
        'e.g. "Sclera shows moderate diffuse redness", "Watery discharge on lower lid margin", '
        '"Cornea appears clear", "No visible lens clouding"],\n'
        '  "rationale": one sentence linking the observations to the most likely condition,\n'
        '  "recommendations": [2-4 concrete next steps for the person]\n'
        "}\n"
        'If it is not a clearly visible human eye, set top_label to "unclear", confidence low, '
        'and say so in observations.'
    )


def _extract_json(text: str) -> dict | None:
    text = text.strip()
    # Strip code fences if present.
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                return None
    return None


def _clamp(v: float) -> float:
    return max(0.0, min(1.0, float(v)))


class OpenAIVisionEyeModel(EyeModel):
    name = "openai-vision-eye"
    supports_gradcam = False

    def __init__(self) -> None:
        self.ai = get_ai_service()
        self.vision_model = settings.openai_vision_model
        self.version = self.vision_model or "vision"

    def _unavailable(self, reason: str) -> EyeFinding:
        return EyeFinding(
            top_label="screening_unavailable",
            confidence=0.0,
            severity="none",
            classes=[ClassScore(label="screening_unavailable", prob=1.0)],
            observations=[],
            rationale=reason,
            recommendations=["Configure an AI provider API key to enable analysis."],
            model_name=self.name,
            model_version=self.version,
            inconclusive=True,
        )

    async def analyze(
        self, image: bytes, *, scope: EyeScope, context: dict | None = None
    ) -> EyeFinding:
        if self.ai.provider_name == "mock":
            return self._unavailable("AI provider not configured (running in mock mode).")

        img = preprocess(decode(image))
        data_url = to_data_url(img)
        is_fundus = scope == EyeScope.FUNDUS
        conditions = _FUNDUS_CONDITIONS if is_fundus else _ANTERIOR_CONDITIONS
        system = _SYSTEM_FUNDUS if is_fundus else _SYSTEM_ANTERIOR

        try:
            result = await self.ai.complete(
                _prompt(conditions),
                system=system,
                images=[data_url],
                model=self.vision_model,
                temperature=0.1,
                max_tokens=800,
            )
        except Exception as exc:
            log.warning("eye_vision_failed", error=str(exc))
            return self._unavailable(f"Analysis request failed: {exc}")

        data = _extract_json(result.text)
        if not data or "top_label" not in data:
            return self._unavailable("Model response could not be parsed.")

        classes = [
            ClassScore(label=str(c.get("label", "")), prob=_clamp(c.get("prob", 0)))
            for c in data.get("classes", [])
            if isinstance(c, dict)
        ]
        top_label = str(data.get("top_label", "unclear"))
        confidence = _clamp(data.get("confidence", 0))
        return EyeFinding(
            top_label=top_label,
            confidence=confidence,
            severity=str(data.get("severity", "none")),
            classes=classes or [ClassScore(label=top_label, prob=confidence)],
            observations=[str(o) for o in data.get("observations", [])][:6],
            rationale=str(data.get("rationale", "")),
            recommendations=[str(r) for r in data.get("recommendations", [])][:6],
            model_name=self.name,
            model_version=self.version,
            inconclusive=top_label in {"unclear", "screening_unavailable"},
        )
