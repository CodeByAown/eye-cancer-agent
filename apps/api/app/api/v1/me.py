"""Current-user endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CurrentUserDep
from app.schemas.user import UserPublic

router = APIRouter(tags=["auth"])


@router.get("/me", response_model=UserPublic)
async def me(user: CurrentUserDep) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        organization_id=user.organization_id,
    )
