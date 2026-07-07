"""File storage abstraction.

One `Storage` interface with two backends:
- `LocalStorage`  — filesystem (dev default, zero infra)
- `S3Storage`     — S3 / Cloudflare R2 (production)

Callers depend only on the interface, so switching backends is an env change.
"""

from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.services.storage.base import Storage, StoredObject
from app.services.storage.local import LocalStorage

__all__ = ["Storage", "StoredObject", "get_storage"]


@lru_cache
def get_storage() -> Storage:
    if settings.storage_backend == "s3":
        from app.services.storage.s3 import S3Storage  # lazy: boto3 optional dep

        return S3Storage()
    return LocalStorage()
