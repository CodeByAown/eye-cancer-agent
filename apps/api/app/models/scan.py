from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import GUID, Base, JSONColumn
from app.models.enums import Module, ScanStatus, Severity, Workflow

if TYPE_CHECKING:
    from app.models.user import User


class Scan(Base):
    """One uploaded or captured image and its processing lifecycle."""

    __tablename__ = "scans"

    user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), index=True)
    module: Mapped[Module] = mapped_column(String(20), nullable=False)
    workflow: Mapped[Workflow] = mapped_column(String(20), nullable=False)
    modality: Mapped[str | None] = mapped_column(String(30), default=None)
    source_uri: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ScanStatus] = mapped_column(
        String(20), default=ScanStatus.QUEUED, nullable=False, index=True
    )
    validation: Mapped[dict | None] = mapped_column(JSONColumn(), default=None)
    meta: Mapped[dict | None] = mapped_column(JSONColumn(), default=None)

    user: Mapped[User] = relationship(back_populates="scans")
    predictions: Mapped[list[Prediction]] = relationship(
        back_populates="scan", cascade="all, delete-orphan"
    )


class Prediction(Base):
    """Model inference result for a scan."""

    __tablename__ = "predictions"

    scan_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("scans.id", ondelete="CASCADE"), index=True
    )
    model_name: Mapped[str] = mapped_column(String(120), nullable=False)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
    top_label: Mapped[str] = mapped_column(String(120), nullable=False)
    top_confidence: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    severity: Mapped[Severity | None] = mapped_column(String(20), default=None)
    classes: Mapped[list] = mapped_column(JSONColumn(), nullable=False)  # [{label, prob}]
    # observations, rationale, recommendations from the model (explainability)
    explanation: Mapped[dict | None] = mapped_column(JSONColumn(), default=None)
    heatmap_uri: Mapped[str | None] = mapped_column(Text, default=None)
    latency_ms: Mapped[int | None] = mapped_column(Integer, default=None)

    scan: Mapped[Scan] = relationship(back_populates="predictions")
    report: Mapped[Report | None] = relationship(
        back_populates="prediction", uselist=False, cascade="all, delete-orphan"
    )


class Report(Base):
    """Narrated clinical report generated from a prediction."""

    __tablename__ = "reports"

    scan_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("scans.id", ondelete="CASCADE"), index=True
    )
    prediction_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("predictions.id", ondelete="CASCADE"), index=True
    )
    report_number: Mapped[str | None] = mapped_column(String(40), unique=True, default=None)
    narrative: Mapped[dict] = mapped_column(JSONColumn(), nullable=False)
    llm_model: Mapped[str | None] = mapped_column(String(60), default=None)
    llm_prompt_version: Mapped[str | None] = mapped_column(String(40), default=None)
    pdf_uri: Mapped[str | None] = mapped_column(Text, default=None)
    qr_target_url: Mapped[str | None] = mapped_column(Text, default=None)
    branding: Mapped[dict | None] = mapped_column(JSONColumn(), default=None)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    prediction: Mapped[Prediction] = relationship(back_populates="report")
