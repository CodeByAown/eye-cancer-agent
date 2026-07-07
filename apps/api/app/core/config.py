"""Application configuration.

Single source of truth for settings, loaded from environment / `.env`.
Typed via pydantic-settings so misconfiguration fails fast at startup.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["development", "staging", "production"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- General ---
    app_env: Environment = "development"
    app_name: str = "AI Medical Vision Platform"
    log_level: str = "INFO"
    log_json: bool = False

    # --- API ---
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_secret_key: str = "dev-secret-change-me-please-32-characters"
    api_cors_origins: str = "http://localhost:3000"

    # --- Database ---
    database_url: str = "sqlite+aiosqlite:///./dev.sqlite3"

    # --- Redis ---
    redis_url: str = "redis://localhost:6379/0"

    # --- Storage ---
    storage_backend: Literal["local", "s3"] = "local"
    storage_local_dir: str = "./storage"
    s3_endpoint_url: str | None = None
    s3_region: str = "auto"
    s3_bucket: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    s3_public_base_url: str | None = None

    # --- Auth (Clerk) ---
    dev_auth_bypass: bool = True
    clerk_jwks_url: str | None = None
    clerk_issuer: str | None = None
    clerk_audience: str | None = None

    # --- AI / LLM (provider-agnostic) ---
    # Active provider. The whole app talks to AIService only; swapping providers
    # is a config change, never a code change.
    ai_provider: Literal[
        "openai", "anthropic", "gemini", "azure_openai", "ollama", "openrouter", "mock"
    ] = "openai"
    ai_temperature: float = 0.2
    ai_max_tokens: int = 1024

    # OpenAI (default)
    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    # Vision-capable model for image analysis (stronger than mini). Narration/
    # chat use `openai_model`; image understanding uses this.
    openai_vision_model: str = "gpt-4o"

    # Anthropic
    anthropic_api_key: str | None = None
    anthropic_base_url: str = "https://api.anthropic.com/v1"
    anthropic_model: str = "claude-sonnet-5"
    anthropic_version: str = "2023-06-01"

    # Google Gemini
    gemini_api_key: str | None = None
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    gemini_model: str = "gemini-1.5-flash"

    # Azure OpenAI
    azure_openai_api_key: str | None = None
    azure_openai_endpoint: str | None = None
    azure_openai_deployment: str | None = None
    azure_openai_api_version: str = "2024-06-01"

    # Ollama (local, OpenAI-compatible)
    ollama_base_url: str = "http://localhost:11434/v1"
    ollama_model: str = "llama3.1"

    # OpenRouter (OpenAI-compatible)
    openrouter_api_key: str | None = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "openai/gpt-4o-mini"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.api_cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @field_validator("api_secret_key")
    @classmethod
    def _secret_len(cls, v: str) -> str:
        if len(v) < 16:
            raise ValueError("API_SECRET_KEY must be at least 16 characters")
        return v

    @field_validator("database_url")
    @classmethod
    def _normalize_db_url(cls, v: str) -> str:
        # Managed Postgres (Render/Heroku/etc.) hands out `postgres://` or
        # `postgresql://`. Our async engine needs the asyncpg driver.
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+asyncpg://", 1)
        elif v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor (import this everywhere)."""
    return Settings()


settings = get_settings()
