"""Provider factory — turns configuration into a concrete `LLMProvider`.

The only place that knows about specific providers. If the selected provider is
missing its API key, we fall back to the MockProvider (with a warning) so the
app stays runnable in dev/CI without secrets.
"""

from __future__ import annotations

from app.core.config import Settings
from app.core.config import settings as default_settings
from app.core.logging import get_logger
from app.services.ai.base import LLMProvider
from app.services.ai.providers.anthropic import AnthropicProvider
from app.services.ai.providers.gemini import GeminiProvider
from app.services.ai.providers.mock import MockProvider
from app.services.ai.providers.openai_compat import Endpoint, OpenAICompatProvider

log = get_logger("ai.factory")


def _openai(s: Settings) -> LLMProvider | None:
    if not s.openai_api_key:
        return None
    return OpenAICompatProvider(
        Endpoint(
            name="openai",
            base_url=s.openai_base_url,
            model=s.openai_model,
            api_key=s.openai_api_key,
        )
    )


def _azure(s: Settings) -> LLMProvider | None:
    if not (s.azure_openai_api_key and s.azure_openai_endpoint and s.azure_openai_deployment):
        return None
    return OpenAICompatProvider(
        Endpoint(
            name="azure_openai",
            base_url=s.azure_openai_endpoint,
            model=s.azure_openai_deployment,
            api_key=s.azure_openai_api_key,
            auth="azure",
            azure_deployment=s.azure_openai_deployment,
            azure_api_version=s.azure_openai_api_version,
        )
    )


def _openrouter(s: Settings) -> LLMProvider | None:
    if not s.openrouter_api_key:
        return None
    return OpenAICompatProvider(
        Endpoint(
            name="openrouter",
            base_url=s.openrouter_base_url,
            model=s.openrouter_model,
            api_key=s.openrouter_api_key,
        )
    )


def _ollama(s: Settings) -> LLMProvider:
    # Ollama needs no API key (local, OpenAI-compatible).
    return OpenAICompatProvider(
        Endpoint(name="ollama", base_url=s.ollama_base_url, model=s.ollama_model, auth="none")
    )


def _anthropic(s: Settings) -> LLMProvider | None:
    if not s.anthropic_api_key:
        return None
    return AnthropicProvider(
        api_key=s.anthropic_api_key,
        base_url=s.anthropic_base_url,
        model=s.anthropic_model,
        version=s.anthropic_version,
    )


def _gemini(s: Settings) -> LLMProvider | None:
    if not s.gemini_api_key:
        return None
    return GeminiProvider(
        api_key=s.gemini_api_key, base_url=s.gemini_base_url, model=s.gemini_model
    )


def build_provider(s: Settings | None = None) -> LLMProvider:
    s = s or default_settings
    builders = {
        "openai": _openai,
        "azure_openai": _azure,
        "openrouter": _openrouter,
        "ollama": _ollama,
        "anthropic": _anthropic,
        "gemini": _gemini,
        "mock": lambda _s: MockProvider(),
    }
    builder = builders.get(s.ai_provider)
    provider = builder(s) if builder else None

    if provider is None:
        log.warning(
            "ai_provider_fallback_mock",
            requested=s.ai_provider,
            reason="missing API key / configuration",
        )
        return MockProvider()

    log.info("ai_provider_selected", provider=provider.name, model=provider.default_model)
    return provider
