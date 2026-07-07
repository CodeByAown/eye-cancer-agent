"""Core AI abstractions: message/result DTOs and the provider interface."""

from __future__ import annotations

import abc
from collections.abc import AsyncIterator, Sequence
from enum import StrEnum

from pydantic import BaseModel, Field

from app.core.errors import AppError


class Role(StrEnum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


class ChatMessage(BaseModel):
    role: Role
    content: str
    # Optional image inputs (data URLs, e.g. "data:image/jpeg;base64,...").
    # Providers that support vision attach these to the message; others ignore.
    images: list[str] = Field(default_factory=list)

    @classmethod
    def system(cls, content: str) -> ChatMessage:
        return cls(role=Role.SYSTEM, content=content)

    @classmethod
    def user(cls, content: str, images: list[str] | None = None) -> ChatMessage:
        return cls(role=Role.USER, content=content, images=images or [])

    @classmethod
    def assistant(cls, content: str) -> ChatMessage:
        return cls(role=Role.ASSISTANT, content=content)


class TokenUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0

    @property
    def total_tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens


class LLMResult(BaseModel):
    text: str
    model: str
    provider: str
    usage: TokenUsage = Field(default_factory=TokenUsage)
    finish_reason: str | None = None


class LLMError(AppError):
    code = "llm_error"
    status_code = 502
    message = "The AI provider request failed."


class CompletionParams(BaseModel):
    """Normalized generation parameters passed to every provider."""

    model: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None


class LLMProvider(abc.ABC):
    """Interface every concrete provider implements. App code never sees this
    directly — only through `AIService`."""

    name: str = "base"
    default_model: str = ""

    @abc.abstractmethod
    async def complete(
        self, messages: Sequence[ChatMessage], params: CompletionParams
    ) -> LLMResult:
        """Return a full completion."""

    @abc.abstractmethod
    def stream(
        self, messages: Sequence[ChatMessage], params: CompletionParams
    ) -> AsyncIterator[str]:
        """Yield text deltas as they arrive."""

    async def healthcheck(self) -> bool:
        """Best-effort check that the provider is configured/reachable."""
        return True
