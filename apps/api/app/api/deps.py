"""Reusable FastAPI dependencies: DB session, current user, RBAC."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenError
from app.core.security import resolve_user
from app.db.session import get_session
from app.models.enums import Role
from app.schemas.user import CurrentUser

SessionDep = Annotated[AsyncSession, Depends(get_session)]


def _bearer_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


async def get_current_user(request: Request, session: SessionDep) -> CurrentUser:
    token = _bearer_token(request)
    return await resolve_user(token, session)


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]


def require_roles(*roles: Role) -> Callable[..., Awaitable[CurrentUser]]:
    """Dependency factory enforcing that the user holds one of `roles`."""

    async def _checker(user: CurrentUserDep) -> CurrentUser:
        if roles and not user.has_role(*roles):
            raise ForbiddenError(
                f"Requires one of roles: {', '.join(r.value for r in roles)}"
            )
        return user

    return _checker


require_admin = require_roles(Role.ADMIN, Role.ORG_ADMIN)
