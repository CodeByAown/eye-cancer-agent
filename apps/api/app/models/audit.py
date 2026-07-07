from __future__ import annotations

import uuid

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import GUID, Base, JSONColumn


class AuditLog(Base):
    """Append-only audit trail (medical traceability requirement)."""

    __tablename__ = "audit_logs"

    actor_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), index=True, default=None)
    action: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    entity: Mapped[str | None] = mapped_column(String(60), default=None)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), default=None)
    ip: Mapped[str | None] = mapped_column(String(64), default=None)
    user_agent: Mapped[str | None] = mapped_column(Text, default=None)
    detail: Mapped[dict | None] = mapped_column(JSONColumn(), default=None)
