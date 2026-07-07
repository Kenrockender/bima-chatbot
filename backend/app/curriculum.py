"""Learning Path — a structured, progressive curriculum on top of the roleplay
engine.

A *module* is a themed practice unit that reuses the drill mechanics: it pins a
persona and injects a `focus_note` so the customer applies extra pressure on one
skill. On top of that a module adds a **mastery gate** — the score bar an FA must
clear to "pass" it — and modules unlock in order, so the path teaches the sales
cycle step by step (rapport → discovery → product → objection → closing).

Everything is derived from the same `attempts` collection progress.py already
maintains. When a session is started from a module we stamp `module_id` on the
attempt, so completion is exact (not a heuristic match on persona/dimension).
"""
from typing import Dict, List, Optional


# Ordered list of modules. `stage` groups them for the UI; `order` is the global
# unlock sequence. A module passes when the attempt's `gate.dimension` score
# reaches `gate.min_score` (and `overall_min`, when set). `focus_note` mirrors
# the drill focus notes — it tells the customer to stress-test that one skill.
MODULES: List[Dict] = [
    # ── Stage 1 · Fondasi ────────────────────────────────────────────────────
    {
        "id": "m_rapport_open",
        "stage": "Fondasi",
        "order": 1,
        "title": "Membuka dengan Hangat",
        "dimension": "rapport",
        "persona_id": "cautious_mom",
        "summary": "Ibu Sari baru terbuka ke advisor yang membangun kepercayaan dulu. Pelan-pelan, bangun koneksi.",
        "objective": (
            "Bangun rapport tulus dengan Ibu Sari sebelum menyentuh produk — "
            "sapa personal, tunjukkan perhatian, dengarkan situasinya."
        ),
        "focus_note": (
            "DRILL FOKUS: RAPPORT. Tunjukkan minat hanya kalau FA membangun "
            "hubungan hangat dulu. Kalau FA langsung teknis/jualan tanpa "
            "basa-basi tulus, tetap jaga jarak dan minta dia kenalan dulu."
        ),
        "gate": {"dimension": "rapport", "min_score": 7},
    },
    {
        "id": "m_discovery_basics",
        "stage": "Fondasi",
        "order": 2,
        "title": "Bertanya Sebelum Menjual",
        "dimension": "discovery",
        "persona_id": "newlywed_career",
        "summary": "Mbak Dina bingung mulai dari mana. Gali kebutuhannya dengan pertanyaan terbuka sebelum menawarkan apa pun.",
        "objective": (
            "Gali situasi & kebutuhan Mbak Dina lewat pertanyaan terbuka. "
            "Jangan tawarkan produk sampai kamu paham konteksnya."
        ),
        "focus_note": (
            "DRILL FOKUS: DISCOVERY. Jangan mau dengar produk sampai FA "
            "benar-benar bertanya soal situasi & kebutuhanmu. Kalau FA mulai "
            "jualan sebelum bertanya, arahkan balik: minta dia tanya dulu."
        ),
        "gate": {"dimension": "discovery", "min_score": 7},
    },
    # ── Stage 2 · Menggali Kebutuhan ─────────────────────────────────────────
    {
        "id": "m_discovery_deep",
        "stage": "Menggali Kebutuhan",
        "order": 3,
        "title": "Menggali Nasabah Sulit",
        "dimension": "discovery",
        "persona_id": "skeptical_owner",
        "summary": "Pak Budi defensif dan trauma klaim. Hanya terbuka kalau kamu benar-benar menggali ceritanya dulu.",
        "objective": (
            "Bikin Pak Budi bercerita: gali kekhawatiran & pengalaman buruknya "
            "lewat pertanyaan berlapis sebelum menyinggung produk."
        ),
        "focus_note": (
            "DRILL FOKUS: DISCOVERY (SULIT). Kamu defensif dan trauma klaim. "
            "3-4 turn pertama jangan mau dengar produk apa pun — push FA untuk "
            "menggali cerita & kekhawatiranmu dulu. Kalau FA langsung jualan, "
            "balas dingin: 'Bapak belum dengarin cerita saya.'"
        ),
        "gate": {"dimension": "discovery", "min_score": 8},
    },
    # ── Stage 3 · Produk & Angka ─────────────────────────────────────────────
    {
        "id": "m_product_numbers",
        "stage": "Produk & Angka",
        "order": 4,
        "title": "Menguasai Angka Produk",
        "dimension": "product_knowledge",
        "persona_id": "young_executive",
        "summary": "Andi cuma peduli angka — IRR, premi, surrender value. Jawab akurat sesuai fakta produk, jangan ngarang.",
        "objective": (
            "Jawab setiap pertanyaan angka Andi dengan akurat sesuai "
            "FAKTA_PRODUK. Kalau tidak yakin, akui dan janji cek — jangan ngarang."
        ),
        "focus_note": (
            "DRILL FOKUS: PRODUCT KNOWLEDGE. Tanya angka spesifik terus "
            "(IRR after tax, premi, surrender value tahun ke-5, expense ratio). "
            "Kalau FA salah atau ngarang vs FAKTA_PRODUK, tegur langsung."
        ),
        "gate": {"dimension": "product_knowledge", "min_score": 7},
    },
    # ── Stage 4 · Menangani Keberatan ────────────────────────────────────────
    {
        "id": "m_objection_basics",
        "stage": "Menangani Keberatan",
        "order": 5,
        "title": "Menjawab Keberatan Umum",
        "dimension": "objection_handling",
        "persona_id": "middle_employee",
        "summary": "Mas Riko merasa BPJS sudah cukup dan budget-nya ketat. Tunjukkan gap-nya dengan empati, bukan menakut-nakuti.",
        "objective": (
            "Tangani keberatan 'BPJS sudah cukup' & 'mending ditabung' dengan "
            "empati dulu lalu value konkret sesuai situasi Riko."
        ),
        "focus_note": (
            "DRILL FOKUS: OBJECTION HANDLING. Bandingkan terus dengan BPJS dan "
            "budget ketat ('mending saya tabung sendiri'). Uji apakah FA "
            "menjawab dengan empati DAN gap yang relevan, bukan menakut-nakuti."
        ),
        "gate": {"dimension": "objection_handling", "min_score": 7},
    },
    {
        "id": "m_objection_hard",
        "stage": "Menangani Keberatan",
        "order": 6,
        "title": "Keberatan Tingkat Lanjut",
        "dimension": "objection_handling",
        "persona_id": "busy_entrepreneur",
        "summary": "Pak Teguh merasa sudah self-insured. Butuh value-add (business continuity, estate planning), bukan fear-based.",
        "objective": (
            "Patahkan keberatan 'saya sudah punya aset' dengan menunjukkan "
            "blind spot yang belum dipikirkan Pak Teguh — bukan menakut-nakuti."
        ),
        "focus_note": (
            "DRILL FOKUS: OBJECTION HANDLING (SULIT). Kamu merasa sudah "
            "self-insured ('asuransi untuk yang belum mapan'). Tolak pitch "
            "fear-based. Baru dengarkan kalau FA tunjukkan blind spot konkret "
            "(business continuity, estate freeze, pajak warisan)."
        ),
        "gate": {"dimension": "objection_handling", "min_score": 8},
    },
    # ── Stage 5 · Menutup & Siklus Penuh ─────────────────────────────────────
    {
        "id": "m_closing",
        "stage": "Menutup & Siklus Penuh",
        "order": 7,
        "title": "Menutup Tanpa Memaksa",
        "dimension": "closing",
        "persona_id": "young_executive",
        "summary": "Andi tertarik tapi belum memutuskan. Arahkan ke next step yang jelas tanpa terkesan memaksa.",
        "objective": (
            "Arahkan Andi ke satu next step jelas (proposal/jadwal) dan kunci "
            "komitmen waktunya — tanpa memaksa."
        ),
        "focus_note": (
            "DRILL FOKUS: CLOSING. Kamu cukup tertarik tapi belum memutuskan. "
            "Beri ruang FA mengarahkan ke next step jelas; kalau FA tidak "
            "menutup atau malah memaksa, tunjukkan keraguan."
        ),
        "gate": {"dimension": "closing", "min_score": 7},
    },
    {
        "id": "m_full_cycle",
        "stage": "Menutup & Siklus Penuh",
        "order": 8,
        "title": "Ujian Akhir: Siklus Penuh",
        "dimension": "closing",
        "persona_id": "legacy_planner",
        "summary": "Pak Hendra sophisticated dan detail. Jalankan siklus penuh — rapport, discovery, produk, keberatan, closing — dengan mulus.",
        "objective": (
            "Tuntaskan siklus penuh dengan Pak Hendra: bangun kredibilitas, "
            "gali kebutuhan legacy, jawab detail teknis akurat, dan tutup ke "
            "proposal tertulis. Skor keseluruhan harus tinggi."
        ),
        "focus_note": (
            "DRILL FOKUS: SIKLUS PENUH. Kamu sophisticated & detail. Mulai "
            "dengan pertanyaan teknis tajam. Uji FA di semua dimensi — "
            "kredibilitas, penggalian kebutuhan legacy, akurasi angka, dan "
            "closing ke proposal tertulis. Jangan mudah terkesan."
        ),
        "gate": {"dimension": "closing", "min_score": 7, "overall_min": 7},
    },
]


_BY_ID = {m["id"]: m for m in MODULES}


def get_module(module_id: str) -> Dict:
    return _BY_ID[module_id]


def get_module_safe(module_id: Optional[str]) -> Optional[Dict]:
    if not module_id:
        return None
    return _BY_ID.get(module_id)


# -----------------------------------------------------------------------------
# Per-module completion, derived from an FA's attempt rows
# -----------------------------------------------------------------------------

def _attempt_passes(row: Dict, gate: Dict) -> bool:
    dim = gate["dimension"]
    if int(row.get(dim, 0) or 0) < int(gate["min_score"]):
        return False
    overall_min = gate.get("overall_min")
    if overall_min is not None and int(row.get("overall_score", 0) or 0) < int(overall_min):
        return False
    return True


def attempt_clears_gate(module: Dict, scores: Dict, overall_score: int) -> bool:
    """Does a single set of scores clear this module's mastery gate? Used at
    end-of-session to celebrate the moment a module is mastered."""
    row = dict(scores)
    row["overall_score"] = overall_score
    return _attempt_passes(row, module["gate"])


def _module_state(module: Dict, rows: List[Dict]) -> Dict:
    """Best-effort completion stats for one module from the FA's attempts.

    Only attempts stamped with this module_id count toward passing, so a module
    is cleared by deliberately practising it — not by an incidental high score
    on a free roleplay with the same persona."""
    gate = module["gate"]
    dim = gate["dimension"]
    mine = [r for r in rows if r.get("module_id") == module["id"]]
    attempts = len(mine)
    best = max((int(r.get(dim, 0) or 0) for r in mine), default=0)
    passed = any(_attempt_passes(r, gate) for r in mine)
    return {"attempts": attempts, "best_score": best, "passed": passed}


def build_path(rows: List[Dict]) -> Dict:
    """Return the full learning path with per-module lock/pass state for one FA.

    Unlock rule: a module is unlocked once the previous module in `order` has
    been passed. The first module is always unlocked."""
    ordered = sorted(MODULES, key=lambda m: m["order"])
    states = {m["id"]: _module_state(m, rows) for m in ordered}

    modules_out: List[Dict] = []
    prev_passed = True  # first module is always unlocked
    passed_count = 0
    for m in ordered:
        st = states[m["id"]]
        unlocked = prev_passed
        if st["passed"]:
            passed_count += 1
        modules_out.append({
            "id": m["id"],
            "stage": m["stage"],
            "order": m["order"],
            "title": m["title"],
            "dimension": m["dimension"],
            "persona_id": m["persona_id"],
            "summary": m["summary"],
            "objective": m["objective"],
            "gate": {
                "dimension": m["gate"]["dimension"],
                "min_score": m["gate"]["min_score"],
                "overall_min": m["gate"].get("overall_min"),
            },
            "attempts": st["attempts"],
            "best_score": st["best_score"],
            "passed": st["passed"],
            "unlocked": unlocked,
        })
        prev_passed = st["passed"]

    total = len(ordered)
    # The next actionable module: first unlocked-but-not-passed.
    next_module_id = next(
        (m["id"] for m in modules_out if m["unlocked"] and not m["passed"]),
        None,
    )
    return {
        "modules": modules_out,
        "total_modules": total,
        "passed_modules": passed_count,
        "percent_complete": round(passed_count / total * 100) if total else 0,
        "completed": passed_count == total,
        "next_module_id": next_module_id,
    }
