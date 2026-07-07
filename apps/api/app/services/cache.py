"""Cache / key-value client with a graceful in-memory fallback.

In production this is Redis. If Redis is unreachable (e.g. zero-infra local dev),
it transparently falls back to an in-process dict with TTL support, so the app
keeps running. The interface is intentionally small (get/set/incr/expire).
"""

from __future__ import annotations

import time
from typing import Any

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)


class InMemoryCache:
    """Best-effort, single-process cache. Not for production."""

    def __init__(self) -> None:
        self._store: dict[str, tuple[Any, float | None]] = {}

    def _expired(self, key: str) -> bool:
        item = self._store.get(key)
        if not item:
            return True
        _, exp = item
        if exp is not None and exp < time.time():
            self._store.pop(key, None)
            return True
        return False

    async def get(self, key: str) -> Any | None:
        if self._expired(key):
            return None
        return self._store[key][0]

    async def set(self, key: str, value: Any, *, ex: int | None = None) -> None:
        exp = time.time() + ex if ex else None
        self._store[key] = (value, exp)

    async def incr(self, key: str) -> int:
        current = 0 if self._expired(key) else int(self._store[key][0])
        current += 1
        exp = self._store.get(key, (None, None))[1]
        self._store[key] = (current, exp)
        return current

    async def expire(self, key: str, seconds: int) -> None:
        if not self._expired(key):
            val = self._store[key][0]
            self._store[key] = (val, time.time() + seconds)

    async def ping(self) -> bool:
        return True

    async def close(self) -> None:
        self._store.clear()


class _Cache:
    """Lazy singleton that prefers Redis, falls back to memory."""

    def __init__(self) -> None:
        self._client: Any | None = None
        self._is_redis = False

    async def client(self) -> Any:
        if self._client is not None:
            return self._client
        try:
            import redis.asyncio as aioredis  # noqa: PLC0415

            client = aioredis.from_url(settings.redis_url, decode_responses=True)
            await client.ping()
            self._client = client
            self._is_redis = True
            log.info("cache_backend", backend="redis")
        except Exception as exc:
            self._client = InMemoryCache()
            self._is_redis = False
            log.warning("cache_fallback_memory", reason=str(exc))
        return self._client

    @property
    def is_redis(self) -> bool:
        return self._is_redis

    async def ping(self) -> bool:
        try:
            c = await self.client()
            return bool(await c.ping())
        except Exception:
            return False

    async def close(self) -> None:
        if self._client is not None:
            await self._client.close()
            self._client = None


cache = _Cache()
