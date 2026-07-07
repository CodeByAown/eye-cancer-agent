"""Cancer inference contract (parallels EyeFinding)."""

from __future__ import annotations

import abc

from pydantic import BaseModel, Field


class ClassScore(BaseModel):
    label: str
    display: str
    prob: float


class CancerFinding(BaseModel):
    top_label: str  # human-readable
    raw_label: str  # model class code
    confidence: float
    severity: str = "none"  # none | mild | moderate | severe
    malignant: bool = False
    classes: list[ClassScore] = Field(default_factory=list)
    observations: list[str] = Field(default_factory=list)
    model_name: str = "unknown"
    model_version: str = "0.0.0"
    supports_gradcam: bool = False


class CancerModel(abc.ABC):
    name: str = "base"
    version: str = "0.0.0"
    modality: str = "dermoscopy"
    supports_gradcam: bool = False

    @abc.abstractmethod
    async def analyze(self, image: bytes, *, context: dict | None = None) -> CancerFinding:
        ...
