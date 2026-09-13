from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Database ─────────────────────────────────────────────────────────────
    # Docker: postgresql://liftiq_user:password@postgres:5432/liftiq_db
    # Local:  postgresql://postgres:postgres@localhost:5432/liftiq
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/liftiq"

    # ── Security ──────────────────────────────────────────────────────────────
    # Override with a securely generated value in production.
    # Generate: python -c "import secrets; print(secrets.token_hex(32))"
    SECRET_KEY: str = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── CORS / Frontend URL ───────────────────────────────────────────────────
    # Public URL of the frontend — used to build the CORS origin allowlist.
    # Production: set to your Vercel domain (e.g. https://liftiq.vercel.app).
    FRONTEND_URL: str = "http://localhost:3001"

    # ── Application ───────────────────────────────────────────────────────────
    # Values: development | docker | production
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
