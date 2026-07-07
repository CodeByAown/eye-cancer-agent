from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict

from app.models.enums import Role


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str | None = None
    role: Role
    organization_id: uuid.UUID | None = None


class CurrentUser(BaseModel):
    """Authenticated principal resolved from the request (Clerk JWT / dev bypass)."""

    id: uuid.UUID
    external_id: str
    email: str
    full_name: str | None = None
    role: Role
    organization_id: uuid.UUID | None = None

    def has_role(self, *roles: Role) -> bool:
        return self.role in roles
