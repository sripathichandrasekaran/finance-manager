from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration, loaded from `.env` at the repo root (one
    level above the `backend/` dir, mirroring ReplyPilot). Env vars cover infra
    only — credentials that change at runtime live in the database instead."""

    APP_NAME: str = "Finance Manager"
    ENVIRONMENT: str = "development"

    DATABASE_URL: str = "sqlite:///./finance.db"

    # Claude (Anthropic) — used for natural-language transaction parsing,
    # spending insights, and the agent chat assistant. When left blank, AI
    # features degrade gracefully.
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-4-6"

    # CORS — comma-separated list for local dev.
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:4000"

    # Authentication — single-user, credential-driven (no user module).
    # APP_PASSWORD gates access (compare in constant time); APP_USERNAME is an
    # optional display name for the profile. SESSION_SECRET signs the issued
    # tokens; SESSION_HOURS is how long a session stays valid before expiry.
    APP_USERNAME: str = "Admin"
    APP_PASSWORD: str = ""
    SESSION_SECRET: str = "finance-manager-dev-secret"
    SESSION_HOURS: int = 168

    # Email (SMTP) — optional, for sending invoices and notifications.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_TLS: bool = True
    EMAIL_FROM: str = "noreply@financemanager.local"
    EMAIL_FROM_NAME: str = "Finance Manager"

    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
