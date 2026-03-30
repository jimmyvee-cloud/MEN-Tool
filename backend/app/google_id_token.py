"""Verify Google Sign-In ID tokens (JWT)."""

from __future__ import annotations

from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token


def verify_google_id_token(token: str, client_id: str) -> dict:
    """Validate credential JWT; return claims (sub, email, email_verified, ...)."""
    try:
        return id_token.verify_oauth2_token(token, google_requests.Request(), client_id)
    except (ValueError, GoogleAuthError) as exc:
        raise ValueError(str(exc)) from exc
