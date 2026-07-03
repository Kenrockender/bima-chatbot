import hashlib
import json
import logging
import threading
from collections import OrderedDict

import httpx

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from . import personas, training, drills, progress
from .auth import get_current_user
from .config import settings
from .ratelimit import RateLimiter

log = logging.getLogger("bima.routes_training")


router = APIRouter(prefix="/api/training", tags=["training"])


class PersonaPublic(BaseModel):
    id: str
    name: str
    title: str
    summary: str
    challenge: str
    accent: str
    gender: Optional[str] = "f"


class DrillPublic(BaseModel):
    id: str
    title: str
    dimension: str
    summary: str
    objective: Optional[str] = None


class CustomPersona(BaseModel):
    name: Optional[str] = None
    background: Optional[str] = None
    needs: Optional[str] = None
    challenge: Optional[str] = None  # "Mudah" | "Sedang" | "Sulit"


class StartRequest(BaseModel):
    persona_id: str
    drill_id: Optional[str] = None
    custom: Optional[CustomPersona] = None


class StartResponse(BaseModel):
    session_id: str
    persona: PersonaPublic
    opening_message: str
    drill: Optional[DrillPublic] = None


class ChatRequest(BaseModel):
    session_id: str
    message: str


class FactRef(BaseModel):
    name: Optional[str] = None
    page: Optional[int] = None


class Coach(BaseModel):
    verdict: str
    dimension: Optional[str] = None
    note: str


class ChatResponse(BaseModel):
    reply: str
    facts_referenced: List[FactRef]
    coach: Optional[Coach] = None


class EndRequest(BaseModel):
    session_id: str


class Scores(BaseModel):
    rapport: int
    discovery: int
    product_knowledge: int
    objection_handling: int
    closing: int


class EndResponse(BaseModel):
    persona: PersonaPublic
    scores: Scores
    overall_score: int
    strengths: List[str]
    improvements: List[str]
    next_focus: str
    turn_count: int
    eval_failed: Optional[bool] = None
    drill_id: Optional[str] = None
    focus_dimension: Optional[str] = None
    progress: Optional[Dict[str, Any]] = None
    raw: Optional[str] = None


@router.get("/personas", response_model=List[PersonaPublic])
def list_personas():
    return personas.list_public()


@router.get("/drills", response_model=List[DrillPublic])
def list_drills():
    return drills.list_public()


@router.post("/start", response_model=StartResponse)
def start(req: StartRequest):
    try:
        return training.start_session(
            req.persona_id,
            req.drill_id,
            req.custom.model_dump() if req.custom else None,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Unknown persona")


@router.post(
    "/chat",
    response_model=ChatResponse,
    dependencies=[Depends(RateLimiter("training_chat", max_calls=60, per_seconds=60))],
)
def chat(req: ChatRequest):
    try:
        return training.reply(req.session_id, req.message)
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found or expired")


@router.post(
    "/chat/stream",
    dependencies=[Depends(RateLimiter("training_chat", max_calls=60, per_seconds=60))],
)
def chat_stream(req: ChatRequest):
    """Server-sent events: streams the customer reply token-by-token, then a
    final 'done' event carrying the coach note and referenced facts. The
    frontend falls back to POST /chat if this fails, so it's safe to use."""
    try:
        stream = training.reply_stream(req.session_id, req.message)
        first = next(stream)
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    def gen():
        for ev in _chain(first, stream):
            yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


def _chain(first, rest):
    yield first
    yield from rest


@router.post("/end", response_model=EndResponse)
def end(req: EndRequest, user: dict = Depends(get_current_user)):
    try:
        return training.end_session(req.session_id, user["uid"], user)
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found or expired")


# -----------------------------------------------------------------------------
# Progress / gamification
# -----------------------------------------------------------------------------

@router.get("/progress")
def get_progress(user: dict = Depends(get_current_user)):
    return progress.get_stats(user["uid"])


@router.get("/attempt/{attempt_id}")
def get_attempt(attempt_id: str, user: dict = Depends(get_current_user)):
    result = progress.get_attempt(user["uid"], attempt_id)
    if not result:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return result


@router.get("/history")
def get_history(user: dict = Depends(get_current_user)):
    return progress.get_history(user["uid"])


@router.get("/next")
def get_next(user: dict = Depends(get_current_user)):
    rec = progress.recommend_next(user["uid"])
    return rec or {}


@router.get("/leaderboard")
def get_leaderboard(user: dict = Depends(get_current_user)):
    return progress.leaderboard(user["uid"])


# -----------------------------------------------------------------------------
# Server-side speech-to-text (iOS/Safari fallback)
# -----------------------------------------------------------------------------

_STT_MAX_BYTES = 10 * 1024 * 1024  # 10 MB


@router.get("/stt/available")
def stt_available():
    return {"available": bool(settings.stt_api_key)}


# -----------------------------------------------------------------------------
# Text-to-speech (ElevenLabs) — natural customer voice
# -----------------------------------------------------------------------------

_TTS_MAX_CHARS = 1200  # safety cap; customer replies are short anyway

# In-process LRU cache of synthesized audio. Repeated lines — persona openings,
# the voice-test sample, re-listens — are served from here instead of paying
# ElevenLabs per-character again. Keyed by (voice, model, text) so any change
# invalidates naturally. Small cap keeps memory bounded on the free tier.
_TTS_CACHE_MAX = 128
_tts_cache: "OrderedDict[str, bytes]" = OrderedDict()
_tts_cache_lock = threading.Lock()


def _tts_cache_key(voice_id: str, text: str) -> str:
    raw = f"{settings.elevenlabs_model}\x00{voice_id}\x00{text}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _tts_cache_get(key: str) -> Optional[bytes]:
    with _tts_cache_lock:
        audio = _tts_cache.get(key)
        if audio is not None:
            _tts_cache.move_to_end(key)  # mark most-recently used
        return audio


def _tts_cache_put(key: str, audio: bytes) -> None:
    with _tts_cache_lock:
        _tts_cache[key] = audio
        _tts_cache.move_to_end(key)
        while len(_tts_cache) > _TTS_CACHE_MAX:
            _tts_cache.popitem(last=False)  # evict least-recently used


# Browser + CDN may cache the audio too — the bytes for a given text/voice
# never change, so a long immutable TTL is safe.
_TTS_HTTP_HEADERS = {"Cache-Control": "public, max-age=86400, immutable"}


class TTSRequest(BaseModel):
    text: str
    gender: Optional[str] = "f"  # "m" | "f" — picks the matching voice


@router.get("/tts/available")
def tts_available():
    return {"available": bool(settings.elevenlabs_api_key)}


@router.post("/tts", dependencies=[Depends(RateLimiter("tts", max_calls=40, per_seconds=60))])
async def tts(req: TTSRequest):
    if not settings.elevenlabs_api_key:
        raise HTTPException(status_code=501, detail="ElevenLabs TTS not configured")

    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty text")
    text = text[:_TTS_MAX_CHARS]

    voice_id = settings.elevenlabs_voice_for(req.gender or "f")

    cache_key = _tts_cache_key(voice_id, text)
    cached = _tts_cache_get(cache_key)
    if cached is not None:
        return Response(
            content=cached,
            media_type="audio/mpeg",
            headers={**_TTS_HTTP_HEADERS, "X-TTS-Cache": "hit"},
        )

    url = f"{settings.elevenlabs_base_url}/text-to-speech/{voice_id}"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                url,
                headers={
                    "xi-api-key": settings.elevenlabs_api_key,
                    "accept": "audio/mpeg",
                    "content-type": "application/json",
                },
                json={
                    "text": text,
                    "model_id": settings.elevenlabs_model,
                    "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
                },
            )
        if resp.status_code != 200:
            log.warning("TTS error %s: %s", resp.status_code, resp.text[:200])
            raise HTTPException(status_code=502, detail="TTS service error")
        _tts_cache_put(cache_key, resp.content)
        return Response(
            content=resp.content,
            media_type="audio/mpeg",
            headers={**_TTS_HTTP_HEADERS, "X-TTS-Cache": "miss"},
        )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="TTS timeout")
    except HTTPException:
        raise
    except Exception as e:
        log.error("TTS failed: %s", e)
        raise HTTPException(status_code=500, detail="TTS internal error")


@router.post(
    "/stt/transcribe",
    dependencies=[Depends(RateLimiter("stt", max_calls=40, per_seconds=60))],
)
async def stt_transcribe(
    audio: UploadFile = File(...),
    language: str = Form("id"),
):
    if not settings.stt_api_key:
        raise HTTPException(status_code=501, detail="Server-side STT not configured")

    data = await audio.read()
    if len(data) > _STT_MAX_BYTES:
        raise HTTPException(status_code=413, detail="Audio too large (max 10 MB)")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{settings.stt_base_url}/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.stt_api_key}"},
                files={"file": (audio.filename or "audio.webm", data, audio.content_type or "audio/webm")},
                data={"model": settings.stt_model, "language": language},
            )
        if resp.status_code != 200:
            log.warning("STT error %s: %s", resp.status_code, resp.text[:200])
            raise HTTPException(status_code=502, detail="STT service error")
        result = resp.json()
        return {"text": result.get("text", "")}
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="STT timeout")
    except HTTPException:
        raise
    except Exception as e:
        log.error("STT failed: %s", e)
        raise HTTPException(status_code=500, detail="STT internal error")
