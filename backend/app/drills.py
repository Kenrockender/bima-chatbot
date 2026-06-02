"""Bite-sized skill drills — short, focused reps targeting one dimension.

A drill is a thin wrapper over a persona: it reuses the persona's roleplay
prompt but pins a single coaching focus so the customer applies extra pressure
on that one skill, and the end-of-session report highlights it. Think of these
as the "2-minute practice" format rather than a full open roleplay.
"""
from typing import Dict, List, Optional


DRILLS: List[Dict] = [
    {
        "id": "discovery_sprint",
        "title": "Discovery Sprint",
        "dimension": "discovery",
        "persona_id": "skeptical_owner",
        "summary": "Pak Budi won't hear a pitch until you've understood his story. Ask, don't sell.",
        "focus_note": (
            "DRILL FOKUS: DISCOVERY. Jangan mau dengar produk apa pun sampai FA "
            "benar-benar menggali situasi, kekhawatiran, dan kebutuhanmu lewat "
            "pertanyaan. Kalau FA mulai jualan sebelum bertanya, tolak dan minta "
            "dia tanya dulu."
        ),
    },
    {
        "id": "objection_gauntlet",
        "title": "Objection Gauntlet",
        "dimension": "objection_handling",
        "persona_id": "skeptical_owner",
        "summary": "Rapid-fire objections about claims and trust. Stay empathetic and substantive.",
        "focus_note": (
            "DRILL FOKUS: OBJECTION HANDLING. Lempar keberatan bertubi-tubi soal "
            "klaim, kepercayaan, dan risiko. Uji apakah FA menjawab dengan empati "
            "DAN substansi, bukan sekadar menenangkan."
        ),
    },
    {
        "id": "numbers_drill",
        "title": "The Numbers Test",
        "dimension": "product_knowledge",
        "persona_id": "young_executive",
        "summary": "Andi only cares about figures. Get the IRR, premiums, and surrender values right.",
        "focus_note": (
            "DRILL FOKUS: PRODUCT KNOWLEDGE. Tanya angka spesifik terus-menerus "
            "(IRR, premi, surrender value, biaya). Kalau FA salah atau ngarang vs "
            "FAKTA_PRODUK, tegur langsung."
        ),
    },
    {
        "id": "closing_drill",
        "title": "Closing Practice",
        "dimension": "closing",
        "persona_id": "young_executive",
        "summary": "You're warm but undecided. Make the advisor land a clear, non-pushy next step.",
        "focus_note": (
            "DRILL FOKUS: CLOSING. Kamu sebenarnya cukup tertarik tapi belum "
            "memutuskan. Beri ruang buat FA mengarahkan ke next step yang jelas; "
            "kalau FA tidak menutup atau malah memaksa, tunjukkan keraguan."
        ),
    },
    {
        "id": "rapport_warmup",
        "title": "Rapport Warm-up",
        "dimension": "rapport",
        "persona_id": "cautious_mom",
        "summary": "Ibu Sari opens up only to advisors who build trust first. Slow down and connect.",
        "focus_note": (
            "DRILL FOKUS: RAPPORT. Tunjukkan minat hanya kalau FA membangun "
            "hubungan dengan hangat dulu. Kalau FA langsung teknis/jualan tanpa "
            "basa-basi yang tulus, tetap jaga jarak."
        ),
    },
]


def get_drill(drill_id: str) -> Dict:
    for d in DRILLS:
        if d["id"] == drill_id:
            return d
    raise KeyError(drill_id)


def get_drill_safe(drill_id: Optional[str]) -> Optional[Dict]:
    if not drill_id:
        return None
    try:
        return get_drill(drill_id)
    except KeyError:
        return None


def list_public() -> List[Dict]:
    return [
        {
            "id": d["id"],
            "title": d["title"],
            "dimension": d["dimension"],
            "persona_id": d["persona_id"],
            "summary": d["summary"],
        }
        for d in DRILLS
    ]
