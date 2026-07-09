"""Firebase Admin SDK bootstrap.

The backend is the *only* Firestore client (backend-mediated design), so this
module owns SDK initialization, the Firestore handle, and ID-token verification.
Credentials come from the FIREBASE_SERVICE_ACCOUNT env (inline JSON) or a JSON
file path. Initialization is lazy and thread-safe; the first call that needs
Firestore or auth triggers it.
"""
import json
import logging
import threading
from typing import Optional

import firebase_admin
from firebase_admin import auth as fb_auth
from firebase_admin import credentials, firestore

from .config import settings


log = logging.getLogger("sera.firebase")

# Reentrant: fs() holds the lock and calls _ensure_app(), which takes it again.
_lock = threading.RLock()
_app: Optional[firebase_admin.App] = None
_db = None


def _build_credentials() -> credentials.Base:
    if settings.firebase_service_account.strip():
        try:
            info = json.loads(settings.firebase_service_account)
        except json.JSONDecodeError as e:
            raise RuntimeError(
                "FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON."
            ) from e
        return credentials.Certificate(info)
    if settings.firebase_service_account_file.strip():
        return credentials.Certificate(settings.firebase_service_account_file)
    # Falls back to GOOGLE_APPLICATION_CREDENTIALS / ADC if present.
    return credentials.ApplicationDefault()


def _ensure_app() -> firebase_admin.App:
    global _app
    if _app is None:
        with _lock:
            if _app is None:
                try:
                    cred = _build_credentials()
                    _app = firebase_admin.initialize_app(cred)
                    log.info("firebase-admin initialized")
                except Exception as e:
                    raise RuntimeError(
                        "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT "
                        "(service-account JSON) — see .env.example."
                    ) from e
    return _app


def fs():
    """Return the shared Firestore client."""
    global _db
    if _db is None:
        with _lock:
            if _db is None:
                _ensure_app()
                _db = firestore.client()
    return _db


def verify_token(id_token: str) -> dict:
    """Verify a Firebase ID token. Raises on invalid/expired tokens."""
    _ensure_app()
    return fb_auth.verify_id_token(id_token)
