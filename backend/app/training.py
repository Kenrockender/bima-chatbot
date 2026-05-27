"""Sales-training roleplay engine.

Flow:
- start_session(persona_id) → creates a session, returns the customer's opening line
- reply(session_id, fa_message) → BIMA replies in-character as the customer
- end_session(session_id) → BIMA exits role, returns structured feedback report

Product knowledge: full PDF text is appended to the persona/evaluator system
prompt as a stable prefix so DeepSeek's prompt cache covers it across turns.
"""
import json
import logging
import re
from typing import Dict, List, Optional

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from . import personas, rag, sessions


log = logging.getLogger("bima.training")


# -----------------------------------------------------------------------------
# Customer reply
# -----------------------------------------------------------------------------

_CUSTOMER_RULES_FOOTER = """

FAKTA_PRODUK (brosur BCA Life yang kebetulan kamu tahu):
{product_facts}

FORMAT BALASAN — WAJIB DIPATUHI:
- Tulis SATU paragraf mengalir saja. Bukan daftar.
- JANGAN pakai bullet "-", "*", "•", penomoran "1.", atau markdown apa pun.
- JANGAN bungkus tiap kalimat dalam tanda kutip ("…").
- JANGAN kasih beberapa opsi/varian balasan — pilih satu, kirim itu saja.
- Maksimum 4 kalimat, gaya percakapan natural seperti chat WhatsApp."""


# Defensive sanitizer — strips list/quote artifacts even when the LLM
# ignores the format rules. Output should always render as a clean paragraph.
_BULLET_PREFIX = re.compile(r"^\s*(?:[-*•]\s+|\d+[.)]\s+)")
_LEAD_TRAIL_QUOTE = re.compile(r'^["“”\'`]+|["“”\'`]+$')


def _clean_reply(text: str) -> str:
    if not text:
        return text
    raw_lines = [ln.strip() for ln in text.splitlines()]
    lines = [ln for ln in raw_lines if ln]
    cleaned: List[str] = []
    for ln in lines:
        ln = _BULLET_PREFIX.sub("", ln)
        ln = _LEAD_TRAIL_QUOTE.sub("", ln).strip()
        if ln:
            cleaned.append(ln)
    if len(cleaned) > 1:
        return " ".join(cleaned)
    return cleaned[0] if cleaned else ""


def _product_facts_block() -> str:
    block = rag.documents_block()
    if not block.strip():
        return "(belum ada brosur produk yang dimuat)"
    return block


def _loaded_product_refs() -> List[Dict[str, Optional[int]]]:
    return [{"name": d["name"], "page": None} for d in rag.list_documents()]


def start_session(persona_id: str) -> Dict:
    persona = personas.get_persona(persona_id)
    sid = sessions.create(persona_id, persona["opening"])
    return {
        "session_id": sid,
        "persona": {
            "id": persona["id"],
            "name": persona["name"],
            "title": persona["title"],
            "summary": persona["summary"],
            "challenge": persona["challenge"],
            "accent": persona["accent"],
        },
        "opening_message": persona["opening"],
    }


def reply(session_id: str, fa_message: str) -> Dict:
    session = sessions.get(session_id)
    if not session:
        raise KeyError("session not found or expired")

    persona = personas.get_persona(session["persona_id"])
    history = session["history"]

    system = persona["persona_prompt"] + _CUSTOMER_RULES_FOOTER.format(
        product_facts=_product_facts_block(),
    )

    msgs = [SystemMessage(content=system)]
    for h in history[-8:]:
        if h["role"] == "user":
            msgs.append(HumanMessage(content=h["content"]))
        else:
            msgs.append(AIMessage(content=h["content"]))
    msgs.append(HumanMessage(content=fa_message))

    try:
        out = rag.get_llm().invoke(msgs)
        text = _clean_reply((out.content or "").strip())
    except Exception as e:
        log.exception("customer reply failed: %s", e)
        text = "Maaf, ada gangguan koneksi sebentar. Bisa diulang?"

    sessions.append(session_id, "user", fa_message)
    sessions.append(session_id, "assistant", text)

    return {
        "reply": text,
        "facts_referenced": _loaded_product_refs(),
    }


# -----------------------------------------------------------------------------
# End-session feedback
# -----------------------------------------------------------------------------

EVAL_SYSTEM = """Kamu adalah sales coach senior BCA Life yang sedang mengevaluasi sesi latihan seorang financial advisor (FA).

Kamu akan dikasih:
- Profil calon nasabah yang dimainkan (persona)
- FAKTA_PRODUK (referensi kebenaran dari brosur)
- Transkrip percakapan (FA dan customer)

Tugasmu: kasih evaluasi yang FAIR, SPESIFIK, dan ACTIONABLE.

Dimensi penilaian (skor 1-10 per dimensi):
1. rapport — Apakah FA membangun hubungan dengan baik di awal sebelum jualan?
2. discovery — Apakah FA menggali kebutuhan, kekhawatiran, dan situasi finansial calon nasabah?
3. product_knowledge — Apakah klaim & angka yang FA sebut akurat sesuai FAKTA_PRODUK? (kalau tidak ada produk yang disebut, beri skor 5 — neutral)
4. objection_handling — Apakah FA menjawab keberatan calon nasabah dengan empati & substansi?
5. closing — Apakah FA mengarahkan ke next step yang jelas (proposal, follow-up, dll) tanpa terkesan memaksa?

Output WAJIB JSON valid dengan struktur PERSIS sebagai berikut, tanpa text lain di luar JSON:

{
  "scores": {
    "rapport": <int 1-10>,
    "discovery": <int 1-10>,
    "product_knowledge": <int 1-10>,
    "objection_handling": <int 1-10>,
    "closing": <int 1-10>
  },
  "overall_score": <int 1-10>,
  "strengths": ["<poin 1>", "<poin 2>", "<poin 3>"],
  "improvements": ["<poin 1>", "<poin 2>", "<poin 3>"],
  "next_focus": "<satu kalimat saran fokus latihan berikutnya>"
}

Aturan:
- Tulis strengths & improvements dalam Bahasa Indonesia. Spesifik (kutip frasa dari transkrip jika perlu). Hindari generic.
- Jujur. Kalau FA buruk, kasih skor rendah. Kalau bagus, kasih kredit.
- JANGAN output text lain di luar JSON. Jangan markdown fence."""


def _extract_json(text: str) -> Optional[Dict]:
    text = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text.strip())
    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def end_session(session_id: str) -> Dict:
    session = sessions.get(session_id)
    if not session:
        raise KeyError("session not found or expired")

    persona = personas.get_persona(session["persona_id"])
    history = session["history"]

    if len(history) < 2:
        sessions.end(session_id)
        return _empty_report(persona)

    transcript_lines = []
    for h in history:
        speaker = "FA" if h["role"] == "user" else persona["name"]
        transcript_lines.append(f"{speaker}: {h['content']}")
    transcript = "\n".join(transcript_lines)

    user_block = f"""PROFIL CALON NASABAH (persona):
- Nama: {persona['name']}
- {persona['title']}
- Ringkasan: {persona['summary']}
- Tingkat kesulitan: {persona['challenge']}

FAKTA_PRODUK (kebenaran referensi dari brosur):
{_product_facts_block()}

TRANSKRIP PERCAKAPAN:
{transcript}

Kasih evaluasi JSON sesuai format yang diminta."""

    try:
        out = rag.get_strict_llm().invoke([
            SystemMessage(content=EVAL_SYSTEM),
            HumanMessage(content=user_block),
        ])
        raw = (out.content or "").strip()
    except Exception as e:
        log.exception("eval LLM failed: %s", e)
        sessions.end(session_id)
        return _empty_report(persona, error=str(e))

    report = _extract_json(raw)
    if not report:
        log.warning("eval JSON parse failed; raw=%r", raw[:300])
        report = _empty_report(persona, error="Parsing feedback gagal.")
        report["raw"] = raw[:800]

    report["persona"] = {
        "id": persona["id"],
        "name": persona["name"],
        "title": persona["title"],
        "summary": persona["summary"],
        "challenge": persona["challenge"],
        "accent": persona["accent"],
    }
    report["turn_count"] = sum(1 for h in history if h["role"] == "user")

    sessions.end(session_id)
    return report


def _empty_report(persona: Dict, error: Optional[str] = None) -> Dict:
    return {
        "scores": {
            "rapport": 0,
            "discovery": 0,
            "product_knowledge": 0,
            "objection_handling": 0,
            "closing": 0,
        },
        "overall_score": 0,
        "strengths": [],
        "improvements": ["Sesi terlalu singkat untuk dievaluasi."] if not error else [error],
        "next_focus": "Mulai sesi baru dan ajak nasabah ngobrol lebih lama.",
        "persona": {
            "id": persona["id"],
            "name": persona["name"],
            "title": persona["title"],
            "summary": persona["summary"],
            "challenge": persona["challenge"],
            "accent": persona["accent"],
        },
        "turn_count": 0,
    }
