from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import Module, ScanStatus, Severity, Workflow


class ClassScore(BaseModel):
    label: str
    prob: float


class PredictionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    model_name: str
    model_version: str
    top_label: str
    top_confidence: float
    severity: Severity | None = None
    classes: list[ClassScore]
    explanation: dict | None = None
    heatmap_uri: str | None = None
    latency_ms: int | None = None
    created_at: datetime


class ScanPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    module: Module
    workflow: Workflow
    modality: str | None = None
    source_uri: str
    status: ScanStatus
    validation: dict | None = None
    meta: dict | None = None
    created_at: datetime


class ScanWithResult(ScanPublic):
    prediction: PredictionPublic | None = None


class AnalyzeRequest(BaseModel):
    """Optional overrides when triggering analysis."""

    modality: str | None = Field(default=None, description="Override auto-detected modality")


class ReportPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    scan_id: uuid.UUID
    prediction_id: uuid.UUID
    report_number: str | None = None
    narrative: dict
    llm_model: str | None = None
    created_at: datetime
