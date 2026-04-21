"""
Security utilities for authentication and authorization.
Handles password hashing and JWT creation/validation with strict
token-type enforcement to prevent token confusion attacks.
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings


# Token type constants — used as the `type` claim. A decoder that expects one
# type will reject the others, preventing e.g. a refresh token from being used
# in place of an access token.
TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"
TOKEN_TYPE_EMAIL_VERIFY = "email_verification"
TOKEN_TYPE_PASSWORD_RESET = "password_reset"

EMAIL_VERIFY_TTL = timedelta(hours=24)
PASSWORD_RESET_TTL = timedelta(hours=1)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return True if the plaintext matches the stored bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------
def _encode_token(
    data: Dict[str, Any],
    token_type: str,
    expires_in: timedelta,
) -> str:
    """
    Internal: encode a JWT with standard claims.

    Adds `iat` (issued-at), `exp` (expiry), and `type` claims. Using a single
    encoder ensures every token has the type claim, which `decode_token`
    verifies.
    """
    now = datetime.now(timezone.utc)
    payload = {
        **data,
        "iat": now,
        "exp": now + expires_in,
        "type": token_type,
    }
    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a short-lived access JWT."""
    ttl = expires_delta or timedelta(
        minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return _encode_token(data, TOKEN_TYPE_ACCESS, ttl)


def create_refresh_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a long-lived refresh JWT."""
    ttl = expires_delta or timedelta(
        days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
    )
    return _encode_token(data, TOKEN_TYPE_REFRESH, ttl)


def decode_token(
    token: str,
    expected_type: str = TOKEN_TYPE_ACCESS,
) -> Dict[str, Any]:
    """
    Decode and validate a JWT.

    Raises 401 if the signature, expiry, or token type check fails.
    The token-type check is the fix for the confusion vulnerability: a caller
    protecting an access-token route will now reject refresh / email / reset
    tokens even though they are signed with the same secret.
    """
    credential_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError as exc:
        raise credential_exc from exc

    if payload.get("type") != expected_type:
        raise credential_exc

    return payload


# ---------------------------------------------------------------------------
# Purpose-built tokens (email verification, password reset)
# ---------------------------------------------------------------------------
def create_email_verification_token(email: str) -> str:
    """Create a token for email verification."""
    return _encode_token(
        {"sub": email},
        TOKEN_TYPE_EMAIL_VERIFY,
        EMAIL_VERIFY_TTL,
    )


def verify_email_token(token: str) -> Optional[str]:
    """Return the email subject if the token is a valid, unexpired verify token, else None."""
    return _safe_extract_subject(token, TOKEN_TYPE_EMAIL_VERIFY)


def create_password_reset_token(email: str) -> str:
    """Create a token for password reset."""
    return _encode_token(
        {"sub": email},
        TOKEN_TYPE_PASSWORD_RESET,
        PASSWORD_RESET_TTL,
    )


def verify_password_reset_token(token: str) -> Optional[str]:
    """Return the email subject if the token is a valid, unexpired reset token, else None."""
    return _safe_extract_subject(token, TOKEN_TYPE_PASSWORD_RESET)


def _safe_extract_subject(token: str, expected_type: str) -> Optional[str]:
    """Decode a token and return its `sub` claim, swallowing validation errors."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError:
        return None

    if payload.get("type") != expected_type:
        return None

    return payload.get("sub")
