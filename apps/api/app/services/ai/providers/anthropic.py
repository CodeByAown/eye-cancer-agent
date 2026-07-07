"""Anthropic (Claude) provider — Messages API via httpx."""

from __future__ import annotations

import json
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


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(
        self,
        *,
        api_key: str | None,
        base_url: str,
        model: str,
        version: str,
        timeout: float = 60.0,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self.default_model = model
        self._version = version
        self._timeout = timeout

    def _headers(self) -> dict[str, str]:
        return {
            "content-type": "application/json",
            "x-api-key": self._api_key or "",
            "anthropic-version": self._version,
        }

    def _split(self, messages: Sequence[ChatMessage]) -> tuple[str | None, list[dict]]:
        """Anthropic takes `system` separately from the message list."""
        system: str | None = None
        msgs: list[dict] = []
        for m in messages:
            if m.role == Role.SYSTEM:
                system = f"{system}\n{m.content}" if system else m.content
            else:
                msgs.append({"role": m.role.value, "content": m.content})
        return system, msgs

    def _body(
        self, messages: Sequence[ChatMessage], params: CompletionParams, stream: bool
    ) -> dict:
        system, msgs = self._split(messages)
        body: dict = {
            "model": params.model or self.default_model,
            "messages": msgs,
            "max_tokens": params.max_tokens or 1024,
            "stream": stream,
        }
        if system:
            body["system"] = system
        if params.temperature is not None:
            body["temperature"] = params.temperature
        return body

    async def complete(
        self, messages: Sequence[ChatMessage], params: CompletionParams
    ) -> LLMResult:
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    f"{self._base_url}/messages",
                    headers=self._headers(),
                    json=self._body(messages, params, False),
                )
            if resp.status_code >= 400:
                raise LLMError(
                    f"anthropic returned {resp.status_code}",
                    details={"body": resp.text[:500]},
                )
            data = resp.json()
        except httpx.HTTPError as exc:
            raise LLMError(f"anthropic request failed: {exc}") from exc

        text = "".join(
            block.get("text", "")
            for block in data.get("content", [])
            if block.get("type") == "text"
        )
        usage = data.get("usage") or {}
        return LLMResult(
            text=text,
            model=data.get("model", self.default_model),
            provider=self.name,
            finish_reason=data.get("stop_reason"),
            usage=TokenUsage(
                prompt_tokens=usage.get("input_tokens", 0),
                completion_tokens=usage.get("output_tokens", 0),
            ),
        )

    async def stream(
        self, messages: Sequence[ChatMessage], params: CompletionParams
    ) -> AsyncIterator[str]:
        try:
            async with (
                httpx.AsyncClient(timeout=self._timeout) as client,
                client.stream(
                    "POST",
                    f"{self._base_url}/messages",
                    headers=self._headers(),
                    json=self._body(messages, params, True),
                ) as resp,
            ):
                if resp.status_code >= 400:
                    body = await resp.aread()
                    raise LLMError(
                        f"anthropic returned {resp.status_code}",
                        details={"body": body.decode()[:500]},
                    )
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    try:
                        event = json.loads(line[len("data:") :].strip())
                    except json.JSONDecodeError:
                        continue
                    if event.get("type") == "content_block_delta":
                        piece = (event.get("delta") or {}).get("text")
                        if piece:
                            yield piece
        except httpx.HTTPError as exc:
            raise LLMError(f"anthropic stream failed: {exc}") from exc

    async def healthcheck(self) -> bool:
        return bool(self._api_key)
