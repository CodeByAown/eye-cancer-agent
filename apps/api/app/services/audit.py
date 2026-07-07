"""Audit logging helper — append-only trail for medical traceability."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.audit import AuditLog

log = get_logger("audit")


async def record(
    session: AsyncSession,
    *,
    action: str,
    actor_id: uuid.UUID | None = None,
    entity: str | None = None,
    entity_id: uuid.UUID | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
    detail: dict | None = None,
) -> None:
    """Write an audit entry. Never raises into the request path."""
    try:
        session.add(
            AuditLog(
                actor_id=actor_id,
                action=action,
                entity=entity,
                entity_id=entity_id,
                ip=ip,
                user_agent=user_agent,
                detail=detail,
            )
        )
        await session.flush()
    except Exception as exc:  # pragma: no cover - auditing must not break requests
        log.warning("audit_write_failed", action=action, error=str(exc))
