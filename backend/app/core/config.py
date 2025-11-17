"""
Application configuration and settings.
Loads from environment variables with validation.
"""
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, validator


class Settings(BaseSettings):
    """Application settings from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # Application
    APP_NAME: str = "NutriVision AI"
    APP_ENV: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    # Security
    SECRET_KEY: str = Field(..., min_length=32)
    JWT_SECRET_KEY: str = Field(..., min_length=32)
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    @validator("ALLOWED_ORIGINS")
    def parse_cors_origins(cls, v: str) -> List[str]:
        """Parse comma-separated CORS origins."""
        return [origin.strip() for origin in v.split(",")]

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
    ALLOWED_IMAGE_TYPES: str = "image/jpeg,image/png,image/webp,image/heic"

    @validator("ALLOWED_IMAGE_TYPES")
    def parse_image_types(cls, v: str) -> List[str]:
        """Parse comma-separated image types."""
        return [t.strip() for t in v.split(",")]

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
    SUPPORTED_LANGUAGES: str = "th,en"

    @validator("SUPPORTED_LANGUAGES")
    def parse_languages(cls, v: str) -> List[str]:
        """Parse comma-separated languages."""
        return [lang.strip() for lang in v.split(",")]

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
        """Get max file size in bytes."""
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    @property
    def is_production(self) -> bool:
        """Check if running in production."""
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development."""
        return self.APP_ENV == "development"


# Global settings instance
settings = Settings()


# Validate critical settings on import
def validate_settings():
    """Validate that critical settings are properly configured."""
    errors = []

    if settings.SECRET_KEY == "your-secret-key-here-min-32-characters-change-this":
        errors.append("SECRET_KEY must be changed from default value")

    if settings.JWT_SECRET_KEY == "your-jwt-secret-key-here-change-this":
        errors.append("JWT_SECRET_KEY must be changed from default value")

    if settings.GEMINI_API_KEY == "your-gemini-api-key-here":
        errors.append("GEMINI_API_KEY must be set to a valid API key")

    if settings.is_production:
        if settings.DEBUG:
            errors.append("DEBUG must be False in production")
        if settings.ENABLE_TEST_ROUTES:
            errors.append("ENABLE_TEST_ROUTES must be False in production")
        if "localhost" in settings.ALLOWED_ORIGINS[0]:
            errors.append("ALLOWED_ORIGINS must not contain localhost in production")

    if errors:
        error_msg = "Configuration validation failed:\n" + "\n".join(f"  - {e}" for e in errors)
        raise ValueError(error_msg)


# Only validate in production or when explicitly running
if settings.is_production:
    validate_settings()
