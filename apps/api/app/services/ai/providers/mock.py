"""Deterministic mock provider.

Used automatically when the selected provider has no API key configured (dev/CI),
mirroring the Redis→in-memory fallback pattern so the app is always runnable and
testable without secrets. Never used in production if a real key is present.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Sequence

from app.services.ai.base import (
    ChatMessage,
    CompletionParams,
    LLMProvider,
    LLMResult,
    Role,
    TokenUsage,
)


class MockProvider(LLMProvider):
    name = "mock"
    default_model = "mock-1"

    def _render(self, messages: Sequence[ChatMessage]) -> str:
        last_user = next(
            (m.content for m in reversed(messages) if m.role == Role.USER), ""
        )
        return (
            "[mock AI response] This is a placeholder generated without a real provider. "
            "Configure AI_PROVIDER + an API key to enable live generation. "
            f'Prompt echo: "{last_user[:160]}"'
        )

    async def complete(
        self, messages: Sequence[ChatMessage], params: CompletionParams
    ) -> LLMResult:
        text = self._render(messages)
        return LLMResult(
            text=text,
            model=params.model or self.default_model,
            provider=self.name,
            finish_reason="stop",
            usage=TokenUsage(prompt_tokens=0, completion_tokens=len(text.split())),
        )

    async def stream(
        self, messages: Sequence[ChatMessage], params: CompletionParams
    ) -> AsyncIterator[str]:
        for word in self._render(messages).split(" "):
            yield word + " "

    async def healthcheck(self) -> bool:
        return True
