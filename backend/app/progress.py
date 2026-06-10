"""Progress tracking, gamification, and adaptive coaching.

Everything here is derived from the `attempts` table — a single source of
truth. Streaks, XP, levels, and badges are computed on read so there's no
denormalized state to keep in sync.

FAs are identified by an anonymous per-device id (sent as the X-FA-Id header),
so no login is required — progress simply follows the browser.
"""
import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional

from .firebase import fs

log = logging.getLogger("bima.progress")


DIMENSIONS = [
    "rapport",
    "discovery",
    "product_knowledge",
    "objection_handling",
    "closing",
]

# Which persona best stretches each skill. Used by recommend_next() to turn the
# weakest dimension into a concrete "go practice with X" suggestion.
DIMENSION_TO_PERSONA = {
    "rapport": "cautious_mom",
    "discovery": "skeptical_owner",
    "product_knowledge": "young_executive",
    "objection_handling": "skeptical_owner",
    "closing": "young_executive",
}

XP_PER_LEVEL = 120


# -----------------------------------------------------------------------------
# Write
# -----------------------------------------------------------------------------

def _xp_for(report: Dict) -> int:
    """XP rewards both quality (overall score) and effort (turns taken)."""
    overall = int(report.get("overall_score", 0) or 0)
    turns = int(report.get("turn_count", 0) or 0)
    return overall * 10 + min(turns, 10) * 2


def _attempts_col(fa_id: str):
    return fs().collection("users").document(fa_id).collection("attempts")


def save_attempt(fa_id: str, report: Dict, transcript: List[Dict]) -> Dict:
    """Persist a finished session. Returns gamification deltas the UI can
    celebrate: xp earned, new streak, and any freshly unlocked badges."""
    scores = report.get("scores", {}) or {}
    xp = _xp_for(report)
    aid = uuid.uuid4().hex

    badges_before = {b["id"] for b in _earned_badges(fa_id)}

    _attempts_col(fa_id).document(aid).set({
        "id": aid,
        "persona_id": report.get("persona", {}).get("id", "unknown"),
        "persona_name": report.get("persona", {}).get("name", "—"),
        "drill_id": report.get("drill_id"),
        "focus_dimension": report.get("focus_dimension"),
        "rapport": int(scores.get("rapport", 0) or 0),
        "discovery": int(scores.get("discovery", 0) or 0),
        "product_knowledge": int(scores.get("product_knowledge", 0) or 0),
        "objection_handling": int(scores.get("objection_handling", 0) or 0),
        "closing": int(scores.get("closing", 0) or 0),
        "overall_score": int(report.get("overall_score", 0) or 0),
        "strengths": report.get("strengths", []) or [],
        "improvements": report.get("improvements", []) or [],
        "next_focus": report.get("next_focus", "") or "",
        "transcript": transcript,
        "turn_count": int(report.get("turn_count", 0) or 0),
        "xp_earned": xp,
        # ISO 8601 UTC string keeps date parsing and lexical ordering simple.
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    badges_after = _earned_badges(fa_id)
    new_badges = [b for b in badges_after if b["id"] not in badges_before]
    stats = get_stats(fa_id)

    return {
        "xp_earned": xp,
        "streak": stats["streak"],
        "level": stats["level"],
        "total_sessions": stats["total_sessions"],
        "new_badges": new_badges,
    }


# -----------------------------------------------------------------------------
# Read
# -----------------------------------------------------------------------------

def _rows(fa_id: str) -> List[Dict]:
    docs = _attempts_col(fa_id).order_by("created_at").stream()
    out = []
    for doc in docs:
        d = doc.to_dict() or {}
        d.setdefault("id", doc.id)
        out.append(d)
    return out


def _attempt_dates(rows: List[Dict]) -> List[date]:
    out = []
    for r in rows:
        try:
            out.append(datetime.fromisoformat(r["created_at"]).date())
        except Exception:
            pass
    return out


def _streak(rows: List[Dict]) -> int:
    """Consecutive days (ending today or yesterday) with at least one attempt."""
    days = set(_attempt_dates(rows))
    if not days:
        return 0
    today = date.today()
    # A streak is still "alive" if the last practice was today or yesterday.
    cursor = today if today in days else today - timedelta(days=1)
    if cursor not in days:
        return 0
    streak = 0
    while cursor in days:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def _averages(rows: List[Dict]) -> Dict[str, float]:
    if not rows:
        return {d: 0.0 for d in DIMENSIONS}
    return {
        d: round(sum(int(r[d]) for r in rows) / len(rows), 1) for d in DIMENSIONS
    }


def _earned_badges(fa_id: str) -> List[Dict]:
    rows = _rows(fa_id)
    if not rows:
        return []
    n = len(rows)
    streak = _streak(rows)
    personas_done = {r["persona_id"] for r in rows}
    best = {d: max(int(r[d]) for r in rows) for d in DIMENSIONS}
    best_overall = max(int(r["overall_score"]) for r in rows)

    catalog = [
        ("first_pitch", "First Pitch", "Completed your first roleplay", n >= 1),
        ("regular", "Regular", "Completed 10 roleplays", n >= 10),
        ("veteran", "Veteran", "Completed 25 roleplays", n >= 25),
        ("streak_3", "On a Roll", "3-day practice streak", streak >= 3),
        ("streak_7", "Unstoppable", "7-day practice streak", streak >= 7),
        ("tough_crowd", "Tough Crowd", "Survived Pak Budi", "skeptical_owner" in personas_done),
        ("high_roller", "High Roller", "Closed Pak Hendra's profile", "legacy_planner" in personas_done),
        ("closer", "Closer", "Scored 8+ on closing", best["closing"] >= 8),
        ("listener", "Deep Listener", "Scored 9+ on discovery", best["discovery"] >= 9),
        ("ace", "Ace", "Scored 9+ overall", best_overall >= 9),
    ]
    return [
        {"id": bid, "name": name, "description": desc}
        for bid, name, desc, earned in catalog
        if earned
    ]


def get_stats(fa_id: str) -> Dict:
    rows = _rows(fa_id)
    n = len(rows)
    averages = _averages(rows)
    total_xp = sum(int(r["xp_earned"]) for r in rows)
    level = total_xp // XP_PER_LEVEL + 1
    xp_into_level = total_xp - (level - 1) * XP_PER_LEVEL

    today = date.today()
    done_today = sum(1 for d in _attempt_dates(rows) if d == today)

    # Per-dimension trend: most recent 8 scores, for sparklines.
    recent = rows[-8:]
    trend = {d: [int(r[d]) for r in recent] for d in DIMENSIONS}

    weakest = min(DIMENSIONS, key=lambda d: averages[d]) if n else None
    strongest = max(DIMENSIONS, key=lambda d: averages[d]) if n else None

    return {
        "fa_id": fa_id,
        "total_sessions": n,
        "total_xp": total_xp,
        "level": level,
        "xp_into_level": xp_into_level,
        "xp_per_level": XP_PER_LEVEL,
        "streak": _streak(rows),
        "daily_goal": 1,
        "done_today": done_today,
        "averages": averages,
        "trend": trend,
        "weakest_dimension": weakest,
        "strongest_dimension": strongest,
        "badges": _earned_badges(fa_id),
        "last_overall": int(rows[-1]["overall_score"]) if n else 0,
    }


def get_history(fa_id: str, limit: int = 20) -> List[Dict]:
    rows = _rows(fa_id)
    rows = list(reversed(rows))[:limit]
    out = []
    for r in rows:
        out.append({
            "id": r["id"],
            "persona_id": r["persona_id"],
            "persona_name": r["persona_name"],
            "overall_score": int(r["overall_score"]),
            "scores": {d: int(r[d]) for d in DIMENSIONS},
            "turn_count": int(r["turn_count"]),
            "xp_earned": int(r["xp_earned"]),
            "next_focus": r["next_focus"],
            "created_at": r["created_at"],
        })
    return out


def recommend_next(fa_id: str) -> Optional[Dict]:
    """Turn the weakest dimension into a concrete next-session suggestion."""
    stats = get_stats(fa_id)
    if not stats["total_sessions"]:
        return None
    dim = stats["weakest_dimension"]
    persona_id = DIMENSION_TO_PERSONA.get(dim, "cautious_mom")
    return {
        "dimension": dim,
        "persona_id": persona_id,
        "average": stats["averages"].get(dim, 0),
    }
