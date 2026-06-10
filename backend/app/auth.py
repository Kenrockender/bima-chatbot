"""Request authentication via Firebase ID tokens.

The client sends `Authorization: Bearer <Firebase ID token>`. `get_current_user`
verifies it and returns the caller's identity; `require_admin` additionally
checks the admin claim or the email allow-list. Sign-in can be restricted to
configured email domains.
"""
import logging
from typing import Optional

from fastapi import Depends, Header, HTTPException, status

from . import firebase
from .config import settings


log = logging.getLogger("bima.auth")


def _bearer(authorization: str) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )
    return authorization[7:].strip()


def get_current_user(authorization: str = Header(default="")) -> dict:
    """Resolve the signed-in user from the bearer token.

    Returns {uid, email, name, picture, admin}. Rejects tokens whose email
    domain is not in ALLOWED_EMAIL_DOMAINS (when that allow-list is set).
    """
    token = _bearer(authorization)
    try:
        decoded = firebase.verify_token(token)
    except Exception as e:
        log.info("token verification failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    email = (decoded.get("email") or "").lower()
    allowed = settings.allowed_domain_set()
    if allowed:
        domain = email.split("@")[-1] if "@" in email else ""
        if domain not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Please sign in with your company account.",
            )

    is_admin = bool(decoded.get("admin")) or email in settings.admin_email_set()
    return {
        "uid": decoded.get("uid") or decoded.get("user_id") or "",
        "email": email,
        "name": decoded.get("name") or "",
        "picture": decoded.get("picture") or "",
        "admin": is_admin,
    }


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
