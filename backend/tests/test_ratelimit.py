"""Rate limiter unit tests — no external services needed."""
import pytest

pytest.importorskip("fastapi")

from fastapi import HTTPException  # noqa: E402

from app.ratelimit import RateLimiter, _client_id  # noqa: E402


class _FakeClient:
    host = "10.0.0.1"


class _FakeReq:
    def __init__(self, headers=None, client=True):
        self.headers = headers or {}
        self.state = type("S", (), {})()
        self.client = _FakeClient() if client else None


def test_allows_up_to_limit_then_blocks():
    limiter = RateLimiter("unit", max_calls=3, per_seconds=60)
    req = _FakeReq()
    for _ in range(3):
        limiter(req)  # should not raise
    with pytest.raises(HTTPException) as exc:
        limiter(req)
    assert exc.value.status_code == 429
    assert "Retry-After" in exc.value.headers


def test_separate_clients_have_separate_budgets():
    limiter = RateLimiter("unit2", max_calls=1, per_seconds=60)
    a = _FakeReq({"x-forwarded-for": "1.1.1.1"})
    b = _FakeReq({"x-forwarded-for": "2.2.2.2"})
    limiter(a)
    limiter(b)  # different client, own bucket → allowed
    with pytest.raises(HTTPException):
        limiter(a)


def test_bearer_token_identifies_client_over_ip():
    # Two tokens behind the same IP must not share a bucket.
    shared_ip = {"x-forwarded-for": "9.9.9.9"}
    r1 = _FakeReq({**shared_ip, "authorization": "Bearer aaaaaaaaaaaaaaaaaaaaaa"})
    r2 = _FakeReq({**shared_ip, "authorization": "Bearer bbbbbbbbbbbbbbbbbbbbbb"})
    assert _client_id(r1) != _client_id(r2)
    assert _client_id(r1).startswith("tok:")


def test_uid_state_takes_priority():
    req = _FakeReq({"authorization": "Bearer zzzzzzzzzzzzzzzzzzzzzz"})
    req.state.uid = "user-123"
    assert _client_id(req) == "uid:user-123"
