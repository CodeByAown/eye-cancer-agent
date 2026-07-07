"""Eye disease inference — provider-agnostic, mirrors the LLM abstraction.

App/agents depend only on `EyeModel`. Default implementation uses OpenAI vision
(real analysis of external-eye images, works for webcam capture + uploads). A
CNN/ONNX implementation can be added later for on-device inference + true
Grad-CAM without changing callers.
"""

from app.services.eye.base import EyeFinding, EyeModel, EyeScope
from app.services.eye.factory import get_eye_model

__all__ = ["EyeFinding", "EyeModel", "EyeScope", "get_eye_model"]
