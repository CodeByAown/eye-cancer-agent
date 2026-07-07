from __future__ import annotations

import app.ratelimit as rl


async def test_rate_limit_trips(client, monkeypatch):
    # Tighten the limit for a fast, deterministic test.
    monkeypatch.setattr(rl, "MAX_REQUESTS", 5)
    hit_429 = False
    for _ in range(8):
        r = await client.get("/api/v1/me")
        if r.status_code == 429:
            hit_429 = True
            body = r.json()
            assert body["error"]["code"] == "rate_limited"
            assert r.headers.get("Retry-After")
            break
    assert hit_429, "rate limit should trigger after exceeding the cap"


async def test_health_exempt_from_rate_limit(client, monkeypatch):
    monkeypatch.setattr(rl, "MAX_REQUESTS", 2)
    for _ in range(6):
        r = await client.get("/api/v1/health")
        assert r.status_code == 200  # never throttled
