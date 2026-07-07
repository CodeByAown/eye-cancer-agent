from __future__ import annotations

from pathlib import Path

import anyio

from app.core.config import settings
from app.services.storage.base import Storage, StoredObject


class LocalStorage(Storage):
    """Filesystem-backed storage for development.

    Objects are served by the API under `/files/<key>` (see files router),
    so `url_for` returns an app-relative URL.
    """

    def __init__(self, root: str | None = None) -> None:
        self.root = Path(root or settings.storage_local_dir).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        # Prevent path traversal outside the storage root.
        p = (self.root / key).resolve()
        if not str(p).startswith(str(self.root)):
            raise ValueError("Invalid storage key")
        return p

    async def put(
        self, key: str, data: bytes, *, content_type: str = "application/octet-stream"
    ) -> StoredObject:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        await anyio.Path(path).write_bytes(data)
        return StoredObject(
            key=key, url=self.url_for(key), size=len(data), content_type=content_type
        )

    async def get(self, key: str) -> bytes:
        return await anyio.Path(self._path(key)).read_bytes()

    async def delete(self, key: str) -> None:
        path = self._path(key)
        if path.exists():
            path.unlink()

    async def exists(self, key: str) -> bool:
        return await anyio.Path(self._path(key)).exists()

    def url_for(self, key: str, *, expires_in: int = 3600) -> str:
        return f"/files/{key}"
