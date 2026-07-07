from __future__ import annotations

import abc
from dataclasses import dataclass


@dataclass(frozen=True)
class StoredObject:
    key: str
    url: str
    size: int
    content_type: str


class Storage(abc.ABC):
    """Abstract object storage. Keys are POSIX-style paths, e.g. 'scans/<uuid>.jpg'."""

    @abc.abstractmethod
    async def put(
        self, key: str, data: bytes, *, content_type: str = "application/octet-stream"
    ) -> StoredObject:
        ...

    @abc.abstractmethod
    async def get(self, key: str) -> bytes:
        ...

    @abc.abstractmethod
    async def delete(self, key: str) -> None:
        ...

    @abc.abstractmethod
    async def exists(self, key: str) -> bool:
        ...

    @abc.abstractmethod
    def url_for(self, key: str, *, expires_in: int = 3600) -> str:
        """Return a (possibly signed) URL for reading the object."""
        ...
