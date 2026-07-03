"""Lightweight in-process rate limiting.

A fixed-window counter per (bucket, client) keeps a single abusive client from
draining the LLM/TTS/STT budget. It's intentionally simple — no Redis, no
sharing across replicas — which is enough for a single-instance deployment
(HF Spaces / Render). If the app is ever scaled horizontally, swap the store
for Redis and keep the same dependency signature.

Client identity: the authenticated Firebase uid when present, else the client
IP (honouring X-Forwarded-For behind the proxy). Missing both → a shared
"anon" bucket, which still caps total anonymous traffic.
"""
import hashlib
import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Tuple

from fastapi import HTTPException, Request

# (bucket, client) -> timestamps of recent calls within the window.
_hits: Dict[Tuple[str, str], Deque[float]] = defaultdict(deque)
_lock = threading.Lock()

# Opportunistic sweep so buckets for one-off clients don't accumulate forever.
_last_sweep = 0.0
_SWEEP_EVERY = 300.0  # seconds


def _client_id(request: Request) -> str:
    # Prefer the verified uid the auth layer may have stashed on the request.
    uid = getattr(request.state, "uid", None)
    if uid:
        return f"uid:{uid}"
    # Next-best: the bearer token itself. It's per-user and stable within its
    # (~1h) lifetime, so two signed-in FAs behind the same office NAT get
    # separate buckets — without paying to verify the token here. We only hash
    # it so the raw credential never becomes a dictionary key.
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer ") and len(auth) > 20:
        digest = hashlib.sha256(auth[7:].strip().encode("utf-8")).hexdigest()[:16]
        return f"tok:{digest}"
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return f"ip:{fwd.split(',')[0].strip()}"
    if request.client and request.client.host:
        return f"ip:{request.client.host}"
    return "anon"


def _sweep(now: float, window: float) -> None:
    global _last_sweep
    if now - _last_sweep < _SWEEP_EVERY:
        return
    _last_sweep = now
    cutoff = now - window
    for key in list(_hits.keys()):
        dq = _hits[key]
        while dq and dq[0] < cutoff:
            dq.popleft()
        if not dq:
            _hits.pop(key, None)


class RateLimiter:
    """FastAPI dependency: allow `max_calls` per `per_seconds` per client.

    Usage:
        @router.post("/x", dependencies=[Depends(RateLimiter("x", 30, 60))])
    """

    def __init__(self, bucket: str, max_calls: int, per_seconds: float):
        self.bucket = bucket
        self.max_calls = max_calls
        self.per_seconds = per_seconds

    def __call__(self, request: Request) -> None:
        now = time.monotonic()
        key = (self.bucket, _client_id(request))
        with _lock:
            _sweep(now, self.per_seconds)
            dq = _hits[key]
            cutoff = now - self.per_seconds
            while dq and dq[0] < cutoff:
                dq.popleft()
            if len(dq) >= self.max_calls:
                retry_after = max(1, int(self.per_seconds - (now - dq[0])))
                raise HTTPException(
                    status_code=429,
                    detail="Terlalu banyak permintaan. Coba lagi sebentar.",
                    headers={"Retry-After": str(retry_after)},
                )
            dq.append(now)
