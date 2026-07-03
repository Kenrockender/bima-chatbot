"""In-memory session store tests. Firestore is unavailable in the test env, so
the store degrades to memory-only — exactly the local-dev path we want covered.
"""
from app import sessions


def test_create_get_append_end_roundtrip():
    sid = sessions.create("cautious_mom", "Halo, ada yang bisa dibantu?")
    assert isinstance(sid, str) and sid

    s = sessions.get(sid)
    assert s is not None
    assert s["persona_id"] == "cautious_mom"
    assert s["history"][0] == {"role": "assistant", "content": "Halo, ada yang bisa dibantu?"}

    sessions.append(sid, "user", "Saya mau tanya produk")
    sessions.append(sid, "assistant", "Tentu")
    assert len(sessions.history(sid)) == 3

    ended = sessions.end(sid)
    assert ended is not None
    assert sessions.get(sid) is None


def test_get_unknown_session_returns_none():
    assert sessions.get("does-not-exist") is None


def test_append_to_missing_session_is_noop():
    # Should not raise even though the session was never created.
    sessions.append("ghost", "user", "hi")
    assert sessions.get("ghost") is None
