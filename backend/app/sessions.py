"""Training session store.

Primary store is in-process (fast, no I/O on the hot path). On top of that we
write through to Firestore so an active roleplay survives a backend restart —
which matters on sleepy free-tier hosts (HF Spaces / Render) where the process
can be recycled mid-session. Persistence is strictly best-effort: if Firestore
isn't configured (local dev) or a write fails, we degrade to the old
memory-only behaviour instead of breaking the conversation.

On a cache miss `get()` rehydrates from Firestore, so a session_id the frontend
still holds keeps working after a restart. `end()` removes the doc so finished
sessions don't accumulate.
"""
import logging
import threading
import time
import uuid
from typing import Dict, List, Optional


log = logging.getLogger("sera.sessions")

SESSION_TTL_SECONDS = 60 * 60 * 4  # 4 hours
_COLLECTION = "training_sessions"
_sessions: Dict[str, Dict] = {}
_lock = threading.Lock()


def _now() -> float:
    return time.time()


# -----------------------------------------------------------------------------
# Firestore write-through (best-effort)
# -----------------------------------------------------------------------------

def _doc(session_id: str):
    """Firestore document handle, or None when Firestore is unavailable."""
    try:
        from .firebase import fs
        return fs().collection(_COLLECTION).document(session_id)
    except Exception as e:
        log.debug("Firestore unavailable, sessions stay in-memory: %s", e)
        return None


def _persist(session: Dict) -> None:
    ref = _doc(session["id"])
    if ref is None:
        return
    try:
        ref.set(session)
    except Exception as e:
        log.warning("failed to persist session %s: %s", session["id"], e)


def _load(session_id: str) -> Optional[Dict]:
    ref = _doc(session_id)
    if ref is None:
        return None
    try:
        snap = ref.get()
        if not snap.exists:
            return None
        data = snap.to_dict() or {}
        data["id"] = session_id
        data.setdefault("history", [])
        data["touched_at"] = _now()
        return data
    except Exception as e:
        log.warning("failed to load session %s: %s", session_id, e)
        return None


def _delete(session_id: str) -> None:
    ref = _doc(session_id)
    if ref is None:
        return
    try:
        ref.delete()
    except Exception as e:
        log.warning("failed to delete session %s: %s", session_id, e)


def _gc():
    """Reap expired sessions. Called opportunistically on writes."""
    cutoff = _now() - SESSION_TTL_SECONDS
    expired = [sid for sid, s in _sessions.items() if s["touched_at"] < cutoff]
    for sid in expired:
        _sessions.pop(sid, None)
        _delete(sid)


# -----------------------------------------------------------------------------
# Public API
# -----------------------------------------------------------------------------

def create(
    persona_id: str,
    opening_message: str,
    drill_id: Optional[str] = None,
    focus_dimension: Optional[str] = None,
    persona: Optional[Dict] = None,
    module_id: Optional[str] = None,
) -> str:
    sid = uuid.uuid4().hex
    session = {
        "id": sid,
        "persona_id": persona_id,
        # Built one-off personas (e.g. the custom persona) are stored inline
        # because they can't be looked up in PERSONAS later.
        "persona": persona,
        "drill_id": drill_id,
        # Learning-path module this session belongs to, if any. Stamped onto the
        # saved attempt so curriculum completion is exact.
        "module_id": module_id,
        "focus_dimension": focus_dimension,
        "started_at": _now(),
        "touched_at": _now(),
        "history": [
            {"role": "assistant", "content": opening_message}
        ],
    }
    with _lock:
        _gc()
        _sessions[sid] = session
    _persist(session)
    return sid


def get(session_id: str) -> Optional[Dict]:
    with _lock:
        s = _sessions.get(session_id)
        if s:
            s["touched_at"] = _now()
            return s
    # Cache miss — the process may have restarted. Try to rehydrate from
    # Firestore so a session_id the client still holds keeps working.
    restored = _load(session_id)
    if restored is None:
        return None
    with _lock:
        # Another request may have restored it first; prefer the live copy.
        existing = _sessions.get(session_id)
        if existing:
            existing["touched_at"] = _now()
            return existing
        _sessions[session_id] = restored
    return restored


def append(session_id: str, role: str, content: str) -> None:
    with _lock:
        s = _sessions.get(session_id)
        if not s:
            return
        s["history"].append({"role": role, "content": content})
        s["touched_at"] = _now()
        snapshot = dict(s)
    _persist(snapshot)


def end(session_id: str) -> Optional[Dict]:
    with _lock:
        s = _sessions.pop(session_id, None)
    if s is None:
        # It might only live in Firestore after a restart — pull it so the
        # end-of-session evaluation still has the transcript.
        s = _load(session_id)
    _delete(session_id)
    return s


def history(session_id: str) -> List[Dict]:
    s = get(session_id)
    return list(s["history"]) if s else []
