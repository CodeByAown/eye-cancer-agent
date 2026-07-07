"""Eye model selection by scope (hybrid architecture).

- FUNDUS   → FundusDrOnnxModel    (real self-hosted ResNet50/APTOS DR classifier)
- ANTERIOR → OpenAIVisionEyeModel (structured external-eye assessment via vision;
             a laptop/phone camera can only see the external eye, so this is the
             appropriate tool — no free-hostable specialist model exists for it)

OpenAI is used for the external-eye assessment and all narration; the fundus
classifier is a real self-hosted model.
"""

from __future__ import annotations

from app.services.eye.base import EyeModel, EyeScope

_models: dict[str, EyeModel] = {}


def get_eye_model(scope: EyeScope = EyeScope.ANTERIOR) -> EyeModel:
    key = scope.value
    if key not in _models:
        if scope == EyeScope.FUNDUS:
            from app.services.eye.fundus_onnx import FundusDrOnnxModel

            _models[key] = FundusDrOnnxModel()
        else:
            from app.services.eye.openai_vision import OpenAIVisionEyeModel

            _models[key] = OpenAIVisionEyeModel()
    return _models[key]
