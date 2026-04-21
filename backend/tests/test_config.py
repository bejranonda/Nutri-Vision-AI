"""
Unit tests for app.core.config.

Settings are loaded from env at import time, so these tests mostly verify
that the parsed `settings` singleton exposes the expected shapes and that
the validator functions behave correctly.
"""
import os

import pytest

from app.core.config import Settings, settings, validate_settings


class TestSettingsParsing:
    def test_required_fields_loaded(self):
        assert settings.SECRET_KEY
        assert settings.JWT_SECRET_KEY
        assert settings.DATABASE_URL
        assert settings.GEMINI_API_KEY

    def test_defaults(self):
        assert settings.JWT_ALGORITHM == "HS256"
        assert settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES == 30
        assert settings.MAX_FILE_SIZE_MB == 10

    def test_list_fields_have_sensible_defaults(self):
        assert isinstance(settings.ALLOWED_ORIGINS, list)
        assert isinstance(settings.ALLOWED_IMAGE_TYPES, list)
        assert isinstance(settings.SUPPORTED_LANGUAGES, list)

    def test_max_file_size_bytes_property(self):
        assert settings.max_file_size_bytes == settings.MAX_FILE_SIZE_MB * 1024 * 1024

    def test_env_helpers(self):
        # APP_ENV is "test" in the conftest fixture
        assert settings.is_production is False
        assert settings.is_development is False


class TestCommaSeparatedValidators:
    """Re-instantiate Settings with env overrides to verify comma-separated parsing."""

    @pytest.fixture
    def env(self, monkeypatch):
        monkeypatch.setenv("SECRET_KEY", "test-secret-key-that-is-at-least-32-chars-long")
        monkeypatch.setenv("JWT_SECRET_KEY", "test-jwt-secret-key-that-is-at-least-32-chars-long")
        monkeypatch.setenv("DATABASE_URL", "postgresql://x")
        monkeypatch.setenv("GEMINI_API_KEY", "k")
        return monkeypatch

    def test_allowed_origins_parses_csv(self, env):
        env.setenv("ALLOWED_ORIGINS", "https://a.com, https://b.com ,https://c.com")
        s = Settings()
        assert s.ALLOWED_ORIGINS == ["https://a.com", "https://b.com", "https://c.com"]

    def test_allowed_image_types_parses_csv(self, env):
        env.setenv("ALLOWED_IMAGE_TYPES", "image/jpeg,image/png")
        s = Settings()
        assert s.ALLOWED_IMAGE_TYPES == ["image/jpeg", "image/png"]

    def test_supported_languages_parses_csv(self, env):
        env.setenv("SUPPORTED_LANGUAGES", "th,en,ja")
        s = Settings()
        assert s.SUPPORTED_LANGUAGES == ["th", "en", "ja"]


class TestValidateSettings:
    """validate_settings enforces production safety invariants."""

    def _base_kwargs(self):
        return dict(
            SECRET_KEY="x" * 32,
            JWT_SECRET_KEY="y" * 32,
            DATABASE_URL="postgresql://x",
            GEMINI_API_KEY="k",
        )

    def test_development_always_passes(self):
        s = Settings(**self._base_kwargs(), APP_ENV="development")
        # Should not raise
        validate_settings(s)

    def test_production_with_debug_fails(self):
        s = Settings(
            **self._base_kwargs(),
            APP_ENV="production",
            DEBUG=True,
        )
        with pytest.raises(ValueError, match="DEBUG must be False"):
            validate_settings(s)

    def test_production_with_localhost_origin_fails(self):
        s = Settings(
            **self._base_kwargs(),
            APP_ENV="production",
            DEBUG=False,
            ENABLE_TEST_ROUTES=False,
            ENABLE_API_DOCS=False,
            ALLOWED_ORIGINS=["http://localhost:3000"],
        )
        with pytest.raises(ValueError, match="localhost"):
            validate_settings(s)

    def test_production_with_hardened_config_passes(self):
        s = Settings(
            **self._base_kwargs(),
            APP_ENV="production",
            DEBUG=False,
            ENABLE_TEST_ROUTES=False,
            ENABLE_API_DOCS=False,
            ALLOWED_ORIGINS=["https://prod.example.com"],
        )
        validate_settings(s)


class TestSecretKeyLength:
    """Required-field length validation — fail-fast on misconfiguration."""

    def _base_kwargs(self):
        return dict(
            SECRET_KEY="x" * 32,
            JWT_SECRET_KEY="y" * 32,
            DATABASE_URL="postgresql://x",
            GEMINI_API_KEY="k",
        )

    def test_short_secret_key_rejected(self):
        from pydantic import ValidationError

        kwargs = self._base_kwargs()
        kwargs["SECRET_KEY"] = "short"
        with pytest.raises(ValidationError):
            Settings(**kwargs)

    def test_short_jwt_secret_key_rejected(self):
        from pydantic import ValidationError

        kwargs = self._base_kwargs()
        kwargs["JWT_SECRET_KEY"] = "short"
        with pytest.raises(ValidationError):
            Settings(**kwargs)
