from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, JSONColumn

if TYPE_CHECKING:
    from app.models.user import User


class Organization(Base):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    plan: Mapped[str] = mapped_column(String(50), default="demo", nullable=False)
    branding: Mapped[dict | None] = mapped_column(JSONColumn(), default=None)

    users: Mapped[list[User]] = relationship(back_populates="organization")
