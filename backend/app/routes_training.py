from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from . import personas, training, drills, progress
from .auth import get_current_user


router = APIRouter(prefix="/api/training", tags=["training"])


class PersonaPublic(BaseModel):
    id: str
    name: str
    title: str
    summary: str
    challenge: str
    accent: str


class DrillPublic(BaseModel):
    id: str
    title: str
    dimension: str
    summary: str


class StartRequest(BaseModel):
    persona_id: str
    drill_id: Optional[str] = None


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
        return training.start_session(req.persona_id, req.drill_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Unknown persona")


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    try:
        return training.reply(req.session_id, req.message)
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found or expired")


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
