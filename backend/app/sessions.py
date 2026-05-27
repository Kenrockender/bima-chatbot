"""In-memory training session store. Sessions are ephemeral by design —
they reset on backend restart, just like the spec's chat sessions.
"""
import threading
import time
import uuid
from typing import Dict, List, Optional


SESSION_TTL_SECONDS = 60 * 60 * 4  # 4 hours
_sessions: Dict[str, Dict] = {}
_lock = threading.Lock()


def _now() -> float:
    return time.time()


def _gc():
    """Reap expired sessions. Called opportunistically on writes."""
    cutoff = _now() - SESSION_TTL_SECONDS
    expired = [sid for sid, s in _sessions.items() if s["touched_at"] < cutoff]
    for sid in expired:
        _sessions.pop(sid, None)


def create(persona_id: str, opening_message: str) -> str:
    sid = uuid.uuid4().hex
    with _lock:
        _gc()
        _sessions[sid] = {
            "id": sid,
            "persona_id": persona_id,
            "started_at": _now(),
            "touched_at": _now(),
            "history": [
                {"role": "assistant", "content": opening_message}
            ],
        }
    return sid


def get(session_id: str) -> Optional[Dict]:
    with _lock:
        s = _sessions.get(session_id)
        if s:
            s["touched_at"] = _now()
        return s


def append(session_id: str, role: str, content: str) -> None:
    with _lock:
        s = _sessions.get(session_id)
        if not s:
            return
        s["history"].append({"role": role, "content": content})
        s["touched_at"] = _now()


def end(session_id: str) -> Optional[Dict]:
    with _lock:
        return _sessions.pop(session_id, None)


def history(session_id: str) -> List[Dict]:
    s = get(session_id)
    return list(s["history"]) if s else []
