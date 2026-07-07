"""Google Gemini provider — generateContent via httpx."""

from __future__ import annotations

from collections.abc import AsyncIterator, Sequence

import httpx

from app.services.ai.base import (
    ChatMessage,
    CompletionParams,
    LLMError,
    LLMProvider,
    LLMResult,
    Role,
    TokenUsage,
)


class GeminiProvider(LLMProvider):
    name = "gemini"

    def __init__(
        self, *, api_key: str | None, base_url: str, model: str, timeout: float = 60.0
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self.default_model = model
        self._timeout = timeout

    def _payload(self, messages: Sequence[ChatMessage], params: CompletionParams) -> dict:
        system_parts: list[str] = []
        contents: list[dict] = []
        for m in messages:
            if m.role == Role.SYSTEM:
                system_parts.append(m.content)
                continue
            role = "model" if m.role == Role.ASSISTANT else "user"
            contents.append({"role": role, "parts": [{"text": m.content}]})
        payload: dict = {"contents": contents}
        if system_parts:
            payload["systemInstruction"] = {"parts": [{"text": "\n".join(system_parts)}]}
        gen: dict = {}
        if params.temperature is not None:
            gen["temperature"] = params.temperature
        if params.max_tokens is not None:
            gen["maxOutputTokens"] = params.max_tokens
        if gen:
            payload["generationConfig"] = gen
        return payload

    async def complete(
        self, messages: Sequence[ChatMessage], params: CompletionParams
    ) -> LLMResult:
        model = params.model or self.default_model
        url = f"{self._base_url}/models/{model}:generateContent?key={self._api_key}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(url, json=self._payload(messages, params))
            if resp.status_code >= 400:
                raise LLMError(
                    f"gemini returned {resp.status_code}", details={"body": resp.text[:500]}
                )
            data = resp.json()
        except httpx.HTTPError as exc:
            raise LLMError(f"gemini request failed: {exc}") from exc

        candidates = data.get("candidates") or [{}]
        parts = (candidates[0].get("content") or {}).get("parts") or []
        text = "".join(p.get("text", "") for p in parts)
        usage = data.get("usageMetadata") or {}
        return LLMResult(
            text=text,
            model=model,
            provider=self.name,
            finish_reason=candidates[0].get("finishReason"),
            usage=TokenUsage(
                prompt_tokens=usage.get("promptTokenCount", 0),
                completion_tokens=usage.get("candidatesTokenCount", 0),
            ),
        )

    async def stream(
        self, messages: Sequence[ChatMessage], params: CompletionParams
    ) -> AsyncIterator[str]:
        # Gemini SSE differs; a correct single-shot fallback keeps behavior sane
        # until native streaming is prioritized.
        result = await self.complete(messages, params)
        if result.text:
            yield result.text

    async def healthcheck(self) -> bool:
        return bool(self._api_key)
