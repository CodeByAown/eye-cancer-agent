from __future__ import annotations

import pytest

from app.core.config import Settings
from app.services.ai import AIService
from app.services.ai.factory import build_provider
from app.services.ai.providers.anthropic import AnthropicProvider
from app.services.ai.providers.mock import MockProvider
from app.services.ai.providers.openai_compat import OpenAICompatProvider
from app.services.ai.service import get_ai_service


def _settings(**kw) -> Settings:
    base = {"api_secret_key": "x" * 16, "database_url": "sqlite+aiosqlite:///./t.sqlite3"}
    return Settings(**base, **kw)


def test_factory_falls_back_to_mock_without_key():
    provider = build_provider(_settings(ai_provider="openai", openai_api_key=None))
    assert isinstance(provider, MockProvider)


def test_factory_selects_openai_with_key():
    provider = build_provider(_settings(ai_provider="openai", openai_api_key="sk-test"))
    assert isinstance(provider, OpenAICompatProvider)
    assert provider.name == "openai"
    assert provider.default_model == "gpt-4o-mini"


def test_factory_selects_anthropic_with_key():
    provider = build_provider(_settings(ai_provider="anthropic", anthropic_api_key="sk-ant"))
    assert isinstance(provider, AnthropicProvider)


def test_factory_ollama_needs_no_key():
    provider = build_provider(_settings(ai_provider="ollama"))
    assert isinstance(provider, OpenAICompatProvider)
    assert provider.name == "ollama"


def test_explicit_mock_provider():
    provider = build_provider(_settings(ai_provider="mock"))
    assert isinstance(provider, MockProvider)


async def test_ai_service_complete_with_mock():
    svc = AIService(MockProvider(), settings=_settings(ai_provider="mock"))
    result = await svc.complete("What does 83% confidence mean?", system="You are helpful.")
    assert result.provider == "mock"
    assert "mock AI response" in result.text
    assert result.usage.completion_tokens > 0


async def test_ai_service_stream_with_mock():
    svc = AIService(MockProvider(), settings=_settings(ai_provider="mock"))
    chunks = [c async for c in svc.stream("hello")]
    assert len(chunks) > 0
    assert "".join(chunks).strip().startswith("[mock")


async def test_ai_service_healthcheck():
    svc = AIService(MockProvider())
    assert await svc.healthcheck() is True


def test_get_ai_service_singleton():
    assert get_ai_service() is get_ai_service()


@pytest.mark.parametrize("provider_key", ["openai", "anthropic", "gemini", "ollama", "openrouter"])
def test_all_providers_constructible(provider_key):
    # With keys present, each builds its real provider (no network calls made).
    keys = {
        "openai": {"openai_api_key": "k"},
        "anthropic": {"anthropic_api_key": "k"},
        "gemini": {"gemini_api_key": "k"},
        "ollama": {},
        "openrouter": {"openrouter_api_key": "k"},
    }[provider_key]
    provider = build_provider(_settings(ai_provider=provider_key, **keys))
    assert provider.name == provider_key
