from __future__ import annotations

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, JSONColumn


class ModelRegistry(Base):
    """Governance record for every model/agent module served by the platform."""

    __tablename__ = "model_registry"

    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    module: Mapped[str] = mapped_column(String(20), nullable=False)
    modality: Mapped[str | None] = mapped_column(String(30), default=None)
    license: Mapped[str | None] = mapped_column(String(60), default=None)
    commercial_ok: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    metrics: Mapped[dict | None] = mapped_column(JSONColumn(), default=None)
    weights_uri: Mapped[str | None] = mapped_column(Text, default=None)
    artifact_hash: Mapped[str | None] = mapped_column(String(80), default=None)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
