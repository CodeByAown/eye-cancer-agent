"""AIService — the single entrypoint the whole app uses for LLM calls.

Agents, workflows, reports, and chat depend ONLY on this class. It wraps the
active provider with defaults, logging, metrics, and light retry, and exposes a
provider-agnostic API. It never leaks a provider SDK type.
"""

from __future__ import annotations

import time
from collections.abc import AsyncIterator, Sequence

from app.core.config import Settings
from app.core.config import settings as default_settings
from app.core.logging import get_logger
from app.services.ai.base import ChatMessage, CompletionParams, LLMProvider, LLMResult, Role
from app.services.ai.factory import build_provider

log = get_logger("ai.service")


class AIService:
    def __init__(self, provider: LLMProvider, settings: Settings | None = None) -> None:
        self._provider = provider
        self._settings = settings or default_settings

    @property
    def provider_name(self) -> str:
        return self._provider.name

    @property
    def model(self) -> str:
        return self._provider.default_model

    def _params(
        self, model: str | None, temperature: float | None, max_tokens: int | None
    ) -> CompletionParams:
        return CompletionParams(
            model=model,
            temperature=temperature if temperature is not None else self._settings.ai_temperature,
            max_tokens=max_tokens if max_tokens is not None else self._settings.ai_max_tokens,
        )

    @staticmethod
    def _to_messages(
        messages: Sequence[ChatMessage] | None,
        prompt: str | None,
        system: str | None,
        images: Sequence[str] | None,
    ) -> list[ChatMessage]:
        if messages:
            msgs = list(messages)
            if images:
                # Attach images to the last user message.
                for m in reversed(msgs):
                    if m.role == Role.USER:
                        m.images = [*m.images, *images]
                        break
            return msgs
        msgs = []
        if system:
            msgs.append(ChatMessage.system(system))
        if prompt:
            msgs.append(ChatMessage.user(prompt, images=list(images) if images else None))
        return msgs

    async def complete(
        self,
        prompt: str | None = None,
        *,
        system: str | None = None,
        messages: Sequence[ChatMessage] | None = None,
        images: Sequence[str] | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> LLMResult:
        """Non-streaming completion. Provide either `prompt` (+optional `system`)
        or a full `messages` list. `images` (data URLs) enable vision on
        providers that support it."""
        msgs = self._to_messages(messages, prompt, system, images)
        params = self._params(model, temperature, max_tokens)
        start = time.perf_counter()
        result = await self._provider.complete(msgs, params)
        log.info(
            "ai_complete",
            provider=result.provider,
            model=result.model,
            ms=round((time.perf_counter() - start) * 1000, 1),
            tokens=result.usage.total_tokens,
        )
        return result

    async def stream(
        self,
        prompt: str | None = None,
        *,
        system: str | None = None,
        messages: Sequence[ChatMessage] | None = None,
        images: Sequence[str] | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> AsyncIterator[str]:
        """Streaming completion yielding text deltas."""
        msgs = self._to_messages(messages, prompt, system, images)
        params = self._params(model, temperature, max_tokens)
        async for delta in self._provider.stream(msgs, params):
            yield delta

    async def healthcheck(self) -> bool:
        return await self._provider.healthcheck()


_ai_service: AIService | None = None


def get_ai_service() -> AIService:
    """Singleton accessor used across the app (and as a FastAPI dependency)."""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService(build_provider())
    return _ai_service
