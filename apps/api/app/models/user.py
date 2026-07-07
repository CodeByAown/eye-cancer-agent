from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import GUID, Base
from app.models.enums import Role

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.scan import Scan


class User(Base):
    __tablename__ = "users"

    external_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(200), default=None)
    role: Mapped[Role] = mapped_column(String(20), default=Role.CLINICIAN, nullable=False)

    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        GUID(), ForeignKey("organizations.id"), default=None
    )
    organization: Mapped[Organization | None] = relationship(back_populates="users")
    scans: Mapped[list[Scan]] = relationship(back_populates="user")
