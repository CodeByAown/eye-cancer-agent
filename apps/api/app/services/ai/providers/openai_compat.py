"""OpenAI-compatible provider.

Implements the OpenAI Chat Completions wire format, which is shared by OpenAI,
Azure OpenAI, Ollama, and OpenRouter. Differences (base URL, auth header, path)
are captured in an `Endpoint` config so one implementation serves all four.

Uses httpx directly (no vendor SDK) to keep dependencies light and uniform.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass, field

import httpx

from app.core.logging import get_logger
from app.services.ai.base import (
    ChatMessage,
    CompletionParams,
    LLMError,
    LLMProvider,
    LLMResult,
    TokenUsage,
)

log = get_logger("ai.openai_compat")


@dataclass
class Endpoint:
    name: str
    base_url: str
    model: str
    api_key: str | None = None
    auth: str = "bearer"  # bearer | azure | none
    # Azure uses /deployments/{deployment}/chat/completions?api-version=...
    azure_deployment: str | None = None
    azure_api_version: str | None = None
    extra_headers: dict[str, str] = field(default_factory=dict)


class OpenAICompatProvider(LLMProvider):
    def __init__(self, endpoint: Endpoint, timeout: float = 60.0) -> None:
        self._ep = endpoint
        self.name = endpoint.name
        self.default_model = endpoint.model
        self._timeout = timeout

    # -- request building -------------------------------------------------
    def _url(self) -> str:
        ep = self._ep
        if ep.auth == "azure":
            base = (ep.base_url or "").rstrip("/")
            return (
                f"{base}/openai/deployments/{ep.azure_deployment}/chat/completions"
                f"?api-version={ep.azure_api_version}"
            )
        return f"{ep.base_url.rstrip('/')}/chat/completions"

    def _headers(self) -> dict[str, str]:
        ep = self._ep
        headers = {"Content-Type": "application/json", **ep.extra_headers}
        if ep.auth == "bearer" and ep.api_key:
            headers["Authorization"] = f"Bearer {ep.api_key}"
        elif ep.auth == "azure" and ep.api_key:
            headers["api-key"] = ep.api_key
        return headers

    @staticmethod
    def _message(m: ChatMessage) -> dict:
        # Multimodal content array when the message carries images (vision).
        if m.images:
            parts: list[dict] = [{"type": "text", "text": m.content}]
            for url in m.images:
                parts.append({"type": "image_url", "image_url": {"url": url}})
            return {"role": m.role.value, "content": parts}
        return {"role": m.role.value, "content": m.content}

    def _body(
        self, messages: Sequence[ChatMessage], params: CompletionParams, stream: bool
    ) -> dict:
        body: dict = {
            "model": params.model or self._ep.model,
            "messages": [self._message(m) for m in messages],
            "stream": stream,
        }
        if params.temperature is not None:
            body["temperature"] = params.temperature
        if params.max_tokens is not None:
            body["max_tokens"] = params.max_tokens
        return body

    # -- interface --------------------------------------------------------
    async def complete(
        self, messages: Sequence[ChatMessage], params: CompletionParams
    ) -> LLMResult:
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    self._url(), headers=self._headers(), json=self._body(messages, params, False)
                )
            if resp.status_code >= 400:
                raise LLMError(
                    f"{self.name} returned {resp.status_code}",
                    details={"body": resp.text[:500]},
                )
            data = resp.json()
        except httpx.HTTPError as exc:
            raise LLMError(f"{self.name} request failed: {exc}") from exc

        choice = (data.get("choices") or [{}])[0]
        text = (choice.get("message") or {}).get("content", "") or ""
        usage = data.get("usage") or {}
        return LLMResult(
            text=text,
            model=data.get("model", self._ep.model),
            provider=self.name,
            finish_reason=choice.get("finish_reason"),
            usage=TokenUsage(
                prompt_tokens=usage.get("prompt_tokens", 0),
                completion_tokens=usage.get("completion_tokens", 0),
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
                    self._url(),
                    headers=self._headers(),
                    json=self._body(messages, params, True),
                ) as resp,
            ):
                if resp.status_code >= 400:
                    body = await resp.aread()
                    raise LLMError(
                        f"{self.name} returned {resp.status_code}",
                        details={"body": body.decode()[:500]},
                    )
                async for line in resp.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    payload = line[len("data:") :].strip()
                    if payload == "[DONE]":
                        break
                    try:
                        chunk = json.loads(payload)
                    except json.JSONDecodeError:
                        continue
                    delta = (chunk.get("choices") or [{}])[0].get("delta") or {}
                    piece = delta.get("content")
                    if piece:
                        yield piece
        except httpx.HTTPError as exc:
            raise LLMError(f"{self.name} stream failed: {exc}") from exc

    async def healthcheck(self) -> bool:
        return not (self._ep.auth != "none" and not self._ep.api_key)
