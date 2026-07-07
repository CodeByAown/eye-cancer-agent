"""Eye model selection by scope.

- FUNDUS  → FundusDrOnnxModel   (real ResNet50/APTOS specialist, ONNX)
- ANTERIOR → OpenAIVisionEyeModel (external-eye observation; no specialist ONNX
             exists publicly for external/webcam eyes — see docs/01-research.md)

OpenAI is used only for narration/report/chat, never as the fundus classifier.
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
