from __future__ import annotations

import os

# Force an isolated, zero-infra config for tests before app imports.
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///./test.sqlite3")
os.environ.setdefault("DEV_AUTH_BYPASS", "true")
os.environ.setdefault("STORAGE_BACKEND", "local")
os.environ.setdefault("STORAGE_LOCAL_DIR", "./test-storage")
# Tests never hit a real AI provider: force the mock (overrides any .env).
os.environ["AI_PROVIDER"] = "mock"

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.agents.registry import bootstrap_agents
from app.db.session import create_all, engine
from app.main import app


@pytest_asyncio.fixture
async def client():
    await create_all()
    bootstrap_agents()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    await engine.dispose()


@pytest.fixture
def png_bytes() -> bytes:
    """A textured, mid-brightness image that passes the quality gate
    (sharp + well-lit). A flat color would be rejected as blurry — by design."""
    import io

    from PIL import Image

    noise = Image.effect_noise((256, 256), 48).convert("RGB")
    buf = io.BytesIO()
    noise.save(buf, format="PNG")
    return buf.getvalue()
