from __future__ import annotations


async def test_health(client):
    r = await client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "version" in body


async def test_ready(client):
    r = await client.get("/api/v1/ready")
    assert r.status_code == 200
    assert set(r.json()["checks"]) == {"database", "cache", "auth", "ai"}


async def test_me_dev_bypass(client):
    r = await client.get("/api/v1/me")
    assert r.status_code == 200
    assert r.json()["email"] == "dev@localhost"


async def test_metrics(client):
    r = await client.get("/metrics")
    assert r.status_code == 200
    assert "amvp_http_requests_total" in r.text
