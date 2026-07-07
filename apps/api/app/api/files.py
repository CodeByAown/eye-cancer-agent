"""Serve locally-stored objects (dev). In production, S3/R2 + CDN serve these."""

from __future__ import annotations

from fastapi import APIRouter, Response

from app.core.config import settings
from app.core.errors import NotFoundError
from app.services.storage import get_storage

router = APIRouter(tags=["files"])

_CONTENT_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "tiff": "image/tiff",
    "pdf": "application/pdf",
}


@router.get("/files/{key:path}")
async def get_file(key: str) -> Response:
    if settings.storage_backend != "local":
        # For S3/R2 the client should use the (signed) url_for URL directly.
        raise NotFoundError("Direct file serving is only enabled for local storage.")
    storage = get_storage()
    if not await storage.exists(key):
        raise NotFoundError("File not found.")
    data = await storage.get(key)
    ext = key.rsplit(".", 1)[-1].lower() if "." in key else ""
    return Response(content=data, media_type=_CONTENT_TYPES.get(ext, "application/octet-stream"))
