"""
Unit tests for app.core.security.

Covers:
- Password hashing round-trip and wrong-password rejection
- JWT creation + decode round-trip
- Token-type enforcement (refresh cannot pose as access, etc.)
- Expiry handling
- Tampered / malformed tokens
- Email / password-reset token helpers
"""
from datetime import timedelta

import pytest
from fastapi import HTTPException
from jose import jwt

from app.core import security
from app.core.config import settings


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------
class TestPasswordHashing:
    def test_hash_round_trip(self):
        pwd = "MyS3cret!"
        hashed = security.get_password_hash(pwd)
        assert hashed != pwd
        assert security.verify_password(pwd, hashed) is True

    def test_wrong_password_rejected(self):
        hashed = security.get_password_hash("correct-password")
        assert security.verify_password("wrong-password", hashed) is False

    def test_each_hash_is_salted(self):
        """Same input should produce different hashes (bcrypt salt)."""
        h1 = security.get_password_hash("same")
        h2 = security.get_password_hash("same")
        assert h1 != h2
        assert security.verify_password("same", h1)
        assert security.verify_password("same", h2)


# ---------------------------------------------------------------------------
# Token creation / decode
# ---------------------------------------------------------------------------
class TestAccessTokens:
    def test_create_and_decode(self):
        token = security.create_access_token({"sub": "user@example.com"})
        payload = security.decode_token(token, expected_type=security.TOKEN_TYPE_ACCESS)
        assert payload["sub"] == "user@example.com"
        assert payload["type"] == security.TOKEN_TYPE_ACCESS
        assert "exp" in payload
        assert "iat" in payload

    def test_custom_expiry(self):
        token = security.create_access_token(
            {"sub": "u"}, expires_delta=timedelta(seconds=1)
        )
        payload = security.decode_token(token)
        assert payload["exp"] > payload["iat"]


class TestRefreshTokens:
    def test_create_and_decode(self):
        token = security.create_refresh_token({"sub": "user"})
        payload = security.decode_token(
            token, expected_type=security.TOKEN_TYPE_REFRESH
        )
        assert payload["type"] == security.TOKEN_TYPE_REFRESH


# ---------------------------------------------------------------------------
# Security: token type confusion
# ---------------------------------------------------------------------------
class TestTokenTypeEnforcement:
    """
    Regression tests for the vulnerability where any JWT signed with the
    same secret was accepted, regardless of its `type` claim.
    """

    def test_refresh_token_rejected_as_access(self):
        refresh = security.create_refresh_token({"sub": "u"})
        with pytest.raises(HTTPException) as exc:
            security.decode_token(refresh, expected_type=security.TOKEN_TYPE_ACCESS)
        assert exc.value.status_code == 401

    def test_email_verify_token_rejected_as_access(self):
        token = security.create_email_verification_token("u@example.com")
        with pytest.raises(HTTPException):
            security.decode_token(token, expected_type=security.TOKEN_TYPE_ACCESS)

    def test_password_reset_token_rejected_as_access(self):
        token = security.create_password_reset_token("u@example.com")
        with pytest.raises(HTTPException):
            security.decode_token(token, expected_type=security.TOKEN_TYPE_ACCESS)

    def test_access_token_rejected_as_refresh(self):
        access = security.create_access_token({"sub": "u"})
        with pytest.raises(HTTPException):
            security.decode_token(access, expected_type=security.TOKEN_TYPE_REFRESH)


# ---------------------------------------------------------------------------
# Malformed / expired / tampered tokens
# ---------------------------------------------------------------------------
class TestInvalidTokens:
    def test_garbage_token_rejected(self):
        with pytest.raises(HTTPException) as exc:
            security.decode_token("not-a-jwt")
        assert exc.value.status_code == 401

    def test_tampered_signature_rejected(self):
        token = security.create_access_token({"sub": "u"})
        # Flip a non-padding character in the signature. Mutating the FINAL
        # character is flaky: JWT signatures are base64url-encoded without
        # padding, and at certain lengths (e.g. 43 chars) two different final
        # characters can decode to identical bytes because the final sextet's
        # low bits are discarded. Flipping the first signature char avoids
        # that ambiguity.
        header, payload, signature = token.split(".")
        replacement = "A" if signature[0] != "A" else "B"
        tampered = ".".join([header, payload, replacement + signature[1:]])
        with pytest.raises(HTTPException):
            security.decode_token(tampered)

    def test_expired_token_rejected(self):
        token = security.create_access_token(
            {"sub": "u"}, expires_delta=timedelta(seconds=-1)
        )
        with pytest.raises(HTTPException):
            security.decode_token(token)

    def test_token_signed_with_wrong_key_rejected(self):
        token = jwt.encode(
            {"sub": "attacker", "type": security.TOKEN_TYPE_ACCESS},
            "a-totally-different-secret",
            algorithm=settings.JWT_ALGORITHM,
        )
        with pytest.raises(HTTPException):
            security.decode_token(token)


# ---------------------------------------------------------------------------
# Email verification / password reset helpers
# ---------------------------------------------------------------------------
class TestEmailAndResetTokens:
    def test_email_round_trip(self):
        token = security.create_email_verification_token("a@b.com")
        assert security.verify_email_token(token) == "a@b.com"

    def test_email_verify_rejects_reset_token(self):
        reset = security.create_password_reset_token("a@b.com")
        assert security.verify_email_token(reset) is None

    def test_password_reset_round_trip(self):
        token = security.create_password_reset_token("a@b.com")
        assert security.verify_password_reset_token(token) == "a@b.com"

    def test_password_reset_rejects_email_token(self):
        email_token = security.create_email_verification_token("a@b.com")
        assert security.verify_password_reset_token(email_token) is None

    def test_invalid_email_token_returns_none(self):
        assert security.verify_email_token("not-a-token") is None

    def test_invalid_reset_token_returns_none(self):
        assert security.verify_password_reset_token("not-a-token") is None
