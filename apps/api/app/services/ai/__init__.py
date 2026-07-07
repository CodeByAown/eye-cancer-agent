"""Provider-agnostic AI layer.

The entire application (agents, workflows, reports, chat) talks ONLY to
`AIService`. Concrete provider SDKs/HTTP live behind `LLMProvider`
implementations and are selected by the `AI_PROVIDER` env var. Swapping
providers is a configuration change, never a code change.

    app code → AIService → LLMProvider → {OpenAI, Anthropic, Gemini,
                                          Azure OpenAI, Ollama, OpenRouter}
"""

from app.services.ai.base import ChatMessage, LLMError, LLMProvider, LLMResult, Role
from app.services.ai.service import AIService, get_ai_service

__all__ = [
    "AIService",
    "ChatMessage",
    "LLMError",
    "LLMProvider",
    "LLMResult",
    "Role",
    "get_ai_service",
]
