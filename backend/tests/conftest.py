"""
Shared pytest fixtures.

Sets safe defaults for required env vars BEFORE `app.core.config` is imported,
so tests can run without a real `.env` file. This runs once per test session.
"""
import os

# Must be set before importing `app.core.config`.
os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-at-least-32-chars-long")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret-key-that-is-at-least-32-chars-long")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")
os.environ.setdefault("APP_ENV", "test")
