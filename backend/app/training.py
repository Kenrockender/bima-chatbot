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
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Optional

from langchain_core.messages import AIMessage, HumanMessage

from . import drills, personas, progress, rag, sessions


log = logging.getLogger("bima.training")


# -----------------------------------------------------------------------------
# Customer reply
# -----------------------------------------------------------------------------

_CUSTOMER_RULES_FOOTER = """

FAKTA_PRODUK (brosur BCA Life yang kebetulan kamu tahu):
{product_facts}

PENGINGAT PERAN — BACA LAGI SEBELUM MENJAWAB:
- Kamu adalah CALON NASABAH (customer), BUKAN financial advisor, BUKAN sales agent.
- Pesan yang kamu terima berasal dari FA (financial advisor) yang sedang MENJUAL kepadamu.
- Kamu HARUS MERESPONS sebagai customer yang menanggapi pitch/pertanyaan FA.
- JANGAN PERNAH memberikan rekomendasi produk, saran asuransi, atau menjual apa pun. Itu tugas FA, bukan tugasmu.
- JANGAN PERNAH menyapa balik dengan gaya sales ("Halo Mbak/Pak, selamat...", "Saya dari BCA Life...").
- Tetap dalam karakter sesuai persona di atas.

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


def start_session(
    persona_id: str,
    drill_id: Optional[str] = None,
    custom: Optional[Dict] = None,
) -> Dict:
    drill = drills.get_drill_safe(drill_id)
    if drill:
        persona_id = drill["persona_id"]
        custom = None  # drills always target a fixed persona
    if persona_id == "custom" and custom:
        persona = personas.build_custom(custom)
    else:
        persona = personas.get_persona(persona_id)
    focus_dimension = drill["dimension"] if drill else None
    sid = sessions.create(
        persona["id"], persona["opening"],
        drill_id=drill["id"] if drill else None,
        focus_dimension=focus_dimension,
        # Persist the built persona so reply()/end_session() can recover its
        # prompt — a custom persona has no PERSONAS entry.
        persona=persona if persona["id"] == "custom" else None,
    )
    return {
        "session_id": sid,
        "persona": {
            "id": persona["id"],
            "name": persona["name"],
            "title": persona["title"],
            "summary": persona["summary"],
            "challenge": persona["challenge"],
            "accent": persona["accent"],
            "gender": persona.get("gender", "f"),
        },
        "opening_message": persona["opening"],
        "drill": {
            "id": drill["id"],
            "title": drill["title"],
            "dimension": drill["dimension"],
            "summary": drill["summary"],
            "objective": drill.get("objective"),
        } if drill else None,
    }


def _session_persona(session: Dict) -> Dict:
    """A session may carry a built persona inline (custom); otherwise look it
    up in PERSONAS by id."""
    return session.get("persona") or personas.get_persona(session["persona_id"])


def reply(session_id: str, fa_message: str) -> Dict:
    session = sessions.get(session_id)
    if not session:
        raise KeyError("session not found or expired")

    persona = _session_persona(session)
    history = session["history"]
    focus = session.get("focus_dimension")

    system = persona["persona_prompt"] + _CUSTOMER_RULES_FOOTER.format(
        product_facts=_product_facts_block(),
    )

    # Mark the (stable, large) system+product-facts prefix as a prompt-cache
    # breakpoint. It's byte-identical across every turn of the session, so on
    # turn 2+ the provider bills it at the cheap cache-read rate.
    msgs = [rag.cached_system(system)]
    for h in history[-8:]:
        if h["role"] == "user":
            msgs.append(HumanMessage(content=h["content"]))
        else:
            msgs.append(AIMessage(content=h["content"]))
    msgs.append(HumanMessage(content=fa_message))

    # The customer reply and the live coach run independently, so fire them in
    # parallel — total latency is max(reply, coach), not the sum. The coach is
    # gated to the pedagogically meaningful turns (see _should_coach) so most
    # filler/acknowledgement turns skip the second LLM call entirely.
    def _customer() -> str:
        try:
            out = rag.get_llm().invoke(msgs)
            return _clean_reply((out.content or "").strip())
        except Exception as e:
            log.exception("customer reply failed: %s", e)
            return "Maaf, ada gangguan koneksi sebentar. Bisa diulang?"

    want_coach = _should_coach(history, fa_message, focus)
    with ThreadPoolExecutor(max_workers=2) as pool:
        fut_text = pool.submit(_customer)
        fut_coach = (
            pool.submit(_coach_turn, history, fa_message, persona, focus)
            if want_coach else None
        )
        text = fut_text.result()
        coach = fut_coach.result() if fut_coach else None

    sessions.append(session_id, "user", fa_message)
    sessions.append(session_id, "assistant", text)

    return {
        "reply": text,
        "facts_referenced": _loaded_product_refs(),
        "coach": coach,
    }


def reply_stream(session_id: str, fa_message: str):
    """Streaming variant of reply(). Yields event dicts:
      {"type": "token", "v": <chunk>}      — incremental customer reply text
      {"type": "done", "reply", "coach", "facts_referenced"}  — final payload

    Token cost is identical to reply() — same model, same prompt — this is a
    pure-UX change so the FA sees the customer "typing" instead of a dead pause.
    The live coach runs in a background thread (gated the same way) and is
    attached to the final 'done' event."""
    session = sessions.get(session_id)
    if not session:
        raise KeyError("session not found or expired")

    persona = _session_persona(session)
    history = session["history"]
    focus = session.get("focus_dimension")

    system = persona["persona_prompt"] + _CUSTOMER_RULES_FOOTER.format(
        product_facts=_product_facts_block(),
    )
    msgs = [rag.cached_system(system)]
    for h in history[-8:]:
        if h["role"] == "user":
            msgs.append(HumanMessage(content=h["content"]))
        else:
            msgs.append(AIMessage(content=h["content"]))
    msgs.append(HumanMessage(content=fa_message))

    want_coach = _should_coach(history, fa_message, focus)
    pool = ThreadPoolExecutor(max_workers=1)
    fut_coach = (
        pool.submit(_coach_turn, history, fa_message, persona, focus)
        if want_coach else None
    )

    parts: List[str] = []
    try:
        for chunk in rag.get_llm().stream(msgs):
            tok = chunk.content or ""
            if tok:
                parts.append(tok)
                yield {"type": "token", "v": tok}
    except Exception as e:
        log.exception("streaming customer reply failed: %s", e)
        if not parts:
            fallback = "Maaf, ada gangguan koneksi sebentar. Bisa diulang?"
            parts.append(fallback)
            yield {"type": "token", "v": fallback}

    text = _clean_reply("".join(parts).strip())
    coach = fut_coach.result() if fut_coach else None
    pool.shutdown(wait=False)

    sessions.append(session_id, "user", fa_message)
    sessions.append(session_id, "assistant", text)

    yield {
        "type": "done",
        "reply": text,
        "facts_referenced": _loaded_product_refs(),
        "coach": coach,
    }


# -----------------------------------------------------------------------------
# Live per-turn coaching
# -----------------------------------------------------------------------------

# Cheap Python heuristics that decide whether a turn is worth spending an LLM
# call on. The goal: coach the moments that actually teach something (questions,
# objection responses, price/closing talk) and skip pure acknowledgements/filler.
# Cuts live-coach LLM calls by roughly 60-70% with no loss at the moments that
# matter.
_OBJECTION_RX = re.compile(
    r"\b(mahal|ragu|pikir|nanti|belum|tidak|nggak|gak|enggak|udah punya|"
    r"sudah punya|keberatan|takut|khawatir|riba|bunga|repot|sibuk|gausah|"
    r"nggak butuh|tidak butuh|mikir|tunggu)\b",
    re.IGNORECASE,
)
_CLOSING_RX = re.compile(
    r"\b(ketemu|jadwal|janji|daftar|proposal|lanjut|follow.?up|tanda.?tangan|"
    r"ttd|aplikasi|formulir|polis|setuju|deal|next step|langkah berikut|"
    r"kapan|minggu depan|besok)\b",
    re.IGNORECASE,
)
_PRICE_RX = re.compile(
    r"\b(harga|biaya|premi|bayar|juta|ribu|\brp\b|murah|mahal|diskon|cicil|"
    r"angsur|budget)\b",
    re.IGNORECASE,
)


def _should_coach(history: List[Dict], fa_message: str, focus: Optional[str]) -> bool:
    """Gate the live coach to meaningful moments. Returns True when the FA turn
    is worth a coaching call, False to skip the LLM entirely."""
    fa_turns_before = sum(1 for h in history if h["role"] == "user")
    # Always coach the opening turn — it sets the rapport tone.
    if fa_turns_before == 0:
        return True
    msg = fa_message or ""
    # A discovery question, price talk, or a closing move is always teachable.
    if "?" in msg or _PRICE_RX.search(msg) or _CLOSING_RX.search(msg):
        return True
    # FA is responding right after the customer raised an objection.
    last_customer = ""
    for h in reversed(history):
        if h["role"] == "assistant":
            last_customer = h["content"]
            break
    if _OBJECTION_RX.search(last_customer):
        return True
    # Drill mode is focused practice — stay a bit more attentive.
    if focus:
        return True
    # Otherwise sample lightly so the coach never goes fully silent.
    return fa_turns_before % 4 == 0


_COACH_SYSTEM = """Kamu sales coach BCA Life yang memantau latihan FA secara live.
Kamu dikasih giliran terakhir percakapan dan satu pesan FA untuk dinilai cepat.

Tugas: kasih SATU micro-feedback singkat (maksimal 12 kata) atas pesan FA itu.

Output WAJIB JSON valid persis:
{"verdict": "good|watch|tip", "dimension": "rapport|discovery|product_knowledge|objection_handling|closing", "note": "<feedback super singkat, Bahasa Indonesia>"}

Aturan:
- "good" = FA melakukan sesuatu dengan baik. "watch" = ada yang kurang/keliru. "tip" = saran perbaikan cepat.
- note HARUS singkat, spesifik, actionable. Bukan kalimat panjang.
- Kalau pesan FA cuma basa-basi/sapaan, verdict "tip" dengan dorongan ringan.
- JANGAN output apa pun di luar JSON."""


def _coach_turn(
    history: List[Dict],
    fa_message: str,
    persona: Dict,
    focus: Optional[str],
) -> Optional[Dict]:
    """Best-effort live coaching on the FA's latest message. Returns None on
    any failure so it can never break the conversation."""
    try:
        last_customer = ""
        for h in reversed(history):
            if h["role"] == "assistant":
                last_customer = h["content"]
                break
        focus_line = (
            f"\nFOKUS DRILL: utamakan dimensi '{focus}'." if focus else ""
        )
        user = (
            f"Persona nasabah: {persona['name']} — {persona['summary']}{focus_line}\n\n"
            f"Nasabah barusan bilang: \"{last_customer}\"\n"
            f"FA menjawab: \"{fa_message}\"\n\n"
            "Nilai pesan FA itu. Output JSON."
        )
        out = rag.get_coach_llm().invoke([
            rag.cached_system(_COACH_SYSTEM),
            HumanMessage(content=user),
        ])
        data = _extract_json((out.content or "").strip())
        if not data or "note" not in data:
            return None
        verdict = data.get("verdict", "tip")
        if verdict not in ("good", "watch", "tip"):
            verdict = "tip"
        return {
            "verdict": verdict,
            "dimension": data.get("dimension"),
            "note": str(data.get("note", "")).strip()[:120],
        }
    except Exception as e:
        log.warning("coach turn failed: %s", e)
        return None


# -----------------------------------------------------------------------------
# End-session feedback
# -----------------------------------------------------------------------------

EVAL_SYSTEM = """Kamu adalah sales coach senior BCA Life yang sedang mengevaluasi sesi latihan seorang financial advisor (FA).

Kamu akan dikasih:
- Profil calon nasabah yang dimainkan (persona)
- FAKTA_PRODUK (referensi kebenaran dari brosur)
- Transkrip percakapan (FA dan customer)

Tugasmu: kasih evaluasi yang FAIR, SPESIFIK, dan ACTIONABLE.

Dimensi penilaian (skor 1-10 per dimensi). Pakai anchor ini supaya skor konsisten:
1. rapport — Membangun hubungan sebelum jualan.
   1-3: langsung jualan, tanpa basa-basi. 4-6: sapaan seadanya. 7-8: hangat & personal. 9-10: bangun kepercayaan tulus, sebut nama, dengarkan.
2. discovery — Menggali kebutuhan, kekhawatiran, situasi finansial nasabah.
   1-3: tidak bertanya sama sekali. 4-6: 1-2 pertanyaan dangkal. 7-8: gali kebutuhan + situasi. 9-10: pertanyaan terbuka berlapis, konfirmasi pemahaman.
3. product_knowledge — Akurasi klaim & angka vs FAKTA_PRODUK.
   1-3: ada angka/klaim SALAH. 4-6: benar tapi minim/umum. 7-8: detail akurat. 9-10: detail akurat + dikaitkan ke kebutuhan nasabah. (Jika tidak ada produk disebut: skor 5.)
4. objection_handling — Menjawab keberatan dengan empati & substansi.
   1-3: defensif/abaikan keberatan. 4-6: jawab tapi tanpa empati. 7-8: akui dulu lalu jawab fakta. 9-10: empati + fakta + cek apakah keberatan teratasi. (Jika tidak ada keberatan muncul: skor 5.)
5. closing — Mengarahkan ke next step jelas tanpa memaksa.
   1-3: tidak ada ajakan lanjut. 4-6: ajakan samar. 7-8: next step jelas (proposal/follow-up). 9-10: next step jelas + komitmen waktu, tidak memaksa.

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


def end_session(
    session_id: str,
    fa_id: Optional[str] = None,
    profile: Optional[Dict] = None,
) -> Dict:
    session = sessions.get(session_id)
    if not session:
        raise KeyError("session not found or expired")

    persona = _session_persona(session)
    history = session["history"]
    drill_id = session.get("drill_id")
    focus_dimension = session.get("focus_dimension")

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

    report = None
    last_error = ""
    for attempt in range(3):
        try:
            out = rag.get_eval_llm().invoke([
                rag.cached_system(EVAL_SYSTEM),
                HumanMessage(content=user_block),
            ])
            raw = (out.content or "").strip()
        except Exception as e:
            log.warning("eval LLM attempt %d failed: %s", attempt + 1, e)
            last_error = str(e)
            continue

        report = _extract_json(raw)
        if report and "scores" in report:
            break
        log.warning("eval JSON parse attempt %d failed; raw=%r", attempt + 1, raw[:300])
        last_error = raw[:800]
        report = None

    if not report:
        log.error("eval failed after 3 attempts; last_error=%s", last_error[:200])
        fallback = _empty_report(persona, error="Evaluasi gagal setelah 3 percobaan. Coba akhiri sesi lagi.")
        fallback["turn_count"] = sum(1 for h in history if h["role"] == "user")
        if fa_id and fallback["turn_count"] >= 2:
            try:
                transcript = [
                    {"role": h["role"], "content": h["content"]} for h in history
                ]
                fallback["progress"] = progress.save_attempt(fa_id, fallback, transcript, profile)
            except Exception as e:
                log.exception("failed to persist fallback attempt: %s", e)
        sessions.end(session_id)
        return fallback

    scores = report.get("scores", {})
    for dim in ("rapport", "discovery", "product_knowledge", "objection_handling", "closing"):
        val = scores.get(dim)
        if not isinstance(val, (int, float)) or val < 1 or val > 10:
            scores[dim] = 5

    report["persona"] = {
        "id": persona["id"],
        "name": persona["name"],
        "title": persona["title"],
        "summary": persona["summary"],
        "challenge": persona["challenge"],
        "accent": persona["accent"],
    }
    report["turn_count"] = sum(1 for h in history if h["role"] == "user")
    report["drill_id"] = drill_id
    report["focus_dimension"] = focus_dimension

    # Persist for progress tracking + gamification, then attach the deltas
    # (XP earned, streak, new badges) so the UI can celebrate them.
    if fa_id:
        try:
            transcript = [
                {"role": h["role"], "content": h["content"]} for h in history
            ]
            report["progress"] = progress.save_attempt(fa_id, report, transcript, profile)
        except Exception as e:
            log.exception("failed to persist attempt: %s", e)

    sessions.end(session_id)
    return report


def _empty_report(persona: Dict, error: Optional[str] = None) -> Dict:
    is_error = bool(error)
    return {
        "scores": {
            "rapport": 0,
            "discovery": 0,
            "product_knowledge": 0,
            "objection_handling": 0,
            "closing": 0,
        },
        "overall_score": 0,
        "eval_failed": is_error,
        "strengths": [],
        "improvements": ["Sesi terlalu singkat untuk dievaluasi."] if not error else [error],
        "next_focus": "Mulai sesi baru dan ajak nasabah ngobrol lebih lama." if not error else "Coba akhiri sesi sekali lagi untuk mendapatkan evaluasi.",
        "persona": {
            "id": persona["id"],
            "name": persona["name"],
            "title": persona["title"],
            "summary": persona["summary"],
            "challenge": persona["challenge"],
            "accent": persona["accent"],
            "gender": persona.get("gender", "f"),
        },
        "turn_count": 0,
    }
