"""Eye inference contract."""

from __future__ import annotations

import abc
from enum import StrEnum

from pydantic import BaseModel, Field


class EyeScope(StrEnum):
    ANTERIOR = "anterior"  # external eye (webcam / phone): redness, conjunctivitis, cataract signs
    FUNDUS = "fundus"  # retinal image: DR, glaucoma, AMD


class ClassScore(BaseModel):
    label: str
    prob: float


class EyeFinding(BaseModel):
    """Structured output of an eye analysis — the single shape every model
    returns, so agents/reports/chat consume it uniformly."""

    top_label: str
    confidence: float  # 0..1
    severity: str = "none"  # none | mild | moderate | severe
    classes: list[ClassScore] = Field(default_factory=list)
    observations: list[str] = Field(default_factory=list)  # what the model saw
    rationale: str = ""  # why it concluded this (explainability text)
    recommendations: list[str] = Field(default_factory=list)
    model_name: str = "unknown"
    model_version: str = "0.0.0"
    inconclusive: bool = False


class EyeModel(abc.ABC):
    name: str = "base"
    version: str = "0.0.0"
    supports_gradcam: bool = False

    @abc.abstractmethod
    async def analyze(
        self, image: bytes, *, scope: EyeScope, context: dict | None = None
    ) -> EyeFinding:
        ...
