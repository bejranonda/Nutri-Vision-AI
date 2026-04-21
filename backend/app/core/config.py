"""
Application configuration and settings.
Loads from environment variables with validation (Pydantic v2).
"""
from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict
from typing_extensions import Annotated


class Settings(BaseSettings):
    """Application settings from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "NutriVision AI"
    APP_ENV: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    # Security — required; startup fails fast if missing or too short.
    SECRET_KEY: str = Field(..., min_length=32)
    JWT_SECRET_KEY: str = Field(..., min_length=32)
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS — stored as List[str] after parsing; accepts comma-separated input.
    # NoDecode tells pydantic-settings NOT to JSON-decode the raw env var, so
    # our validator below receives the raw string and can split on commas.
    ALLOWED_ORIGINS: Annotated[List[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    # Database
    DATABASE_URL: str = Field(..., description="PostgreSQL connection string")
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL: int = 3600

    # Google Gemini AI
    GEMINI_API_KEY: str = Field(..., description="Google Gemini API key")
    GEMINI_MODEL: str = "gemini-1.5-flash"
    GEMINI_MAX_TOKENS: int = 2048
    GEMINI_TEMPERATURE: float = 0.7
    GEMINI_RATE_LIMIT_PER_MINUTE: int = 60
    GEMINI_DAILY_REQUEST_LIMIT: int = 1500

    # File Storage
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE_MB: int = 10
    ALLOWED_IMAGE_TYPES: Annotated[List[str], NoDecode] = Field(
        default_factory=lambda: ["image/jpeg", "image/png", "image/webp", "image/heic"]
    )

    @field_validator("ALLOWED_IMAGE_TYPES", mode="before")
    @classmethod
    def _parse_image_types(cls, v):
        if isinstance(v, str):
            return [t.strip() for t in v.split(",") if t.strip()]
        return v

    # S3/MinIO (optional)
    USE_S3: bool = False
    S3_ENDPOINT: Optional[str] = None
    S3_ACCESS_KEY: Optional[str] = None
    S3_SECRET_KEY: Optional[str] = None
    S3_BUCKET_NAME: Optional[str] = None
    S3_REGION: str = "us-east-1"

    # Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: str = "noreply@nutrivision.app"
    SMTP_FROM_NAME: str = "NutriVision AI"

    # OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: Optional[str] = None

    LINE_CHANNEL_ID: Optional[str] = None
    LINE_CHANNEL_SECRET: Optional[str] = None
    LINE_REDIRECT_URI: Optional[str] = None

    FACEBOOK_APP_ID: Optional[str] = None
    FACEBOOK_APP_SECRET: Optional[str] = None
    FACEBOOK_REDIRECT_URI: Optional[str] = None

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    API_SCAN_LIMIT_FREE: int = 10
    API_SCAN_LIMIT_PREMIUM: int = 999999
    API_CHAT_LIMIT_FREE: int = 5
    API_CHAT_LIMIT_PREMIUM: int = 999999

    # URLs
    FRONTEND_URL: str = "http://localhost:3000"
    BACKEND_URL: str = "http://localhost:8000"

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # Monitoring
    SENTRY_DSN: Optional[str] = None
    SENTRY_ENVIRONMENT: str = "development"

    # Feature Flags
    ENABLE_REGISTRATION: bool = True
    ENABLE_OAUTH: bool = True
    ENABLE_EMAIL_VERIFICATION: bool = False
    ENABLE_PREMIUM_FEATURES: bool = True
    ENABLE_ANALYTICS: bool = False

    # Localization
    DEFAULT_LANGUAGE: str = "th"
    SUPPORTED_LANGUAGES: Annotated[List[str], NoDecode] = Field(
        default_factory=lambda: ["th", "en"]
    )

    @field_validator("SUPPORTED_LANGUAGES", mode="before")
    @classmethod
    def _parse_languages(cls, v):
        if isinstance(v, str):
            return [lang.strip() for lang in v.split(",") if lang.strip()]
        return v

    # Payments
    PROMPTPAY_ENABLED: bool = False
    PROMPTPAY_MERCHANT_ID: Optional[str] = None

    STRIPE_ENABLED: bool = False
    STRIPE_PUBLIC_KEY: Optional[str] = None
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None

    # Development
    ENABLE_API_DOCS: bool = True
    API_DOCS_URL: str = "/docs"
    ENABLE_TEST_ROUTES: bool = True

    @property
    def max_file_size_bytes(self) -> int:
        """Max file size in bytes."""
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"


def validate_settings(s: "Settings") -> None:
    """
    Production-only sanity checks. Required-field defaults are already
    enforced by Pydantic, so we only guard against configurations that are
    syntactically valid but operationally dangerous.
    """
    errors: List[str] = []

    if s.is_production:
        if s.DEBUG:
            errors.append("DEBUG must be False in production")
        if s.ENABLE_TEST_ROUTES:
            errors.append("ENABLE_TEST_ROUTES must be False in production")
        if s.ENABLE_API_DOCS:
            errors.append("ENABLE_API_DOCS should be False in production")
        if s.ALLOWED_ORIGINS and any("localhost" in origin for origin in s.ALLOWED_ORIGINS):
            errors.append("ALLOWED_ORIGINS must not contain localhost in production")

    if errors:
        raise ValueError(
            "Configuration validation failed:\n" + "\n".join(f"  - {e}" for e in errors)
        )


# Global settings instance. Importing this module requires the required
# env vars to be present — intentional, so misconfiguration fails fast.
settings = Settings()

if settings.is_production:
    validate_settings(settings)
