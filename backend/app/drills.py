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
        "title": "Menggali Kebutuhan",
        "dimension": "discovery",
        "persona_id": "skeptical_owner",
        "summary": "Pak Budi tidak mau dengar pitch sebelum kamu paham ceritanya. Bertanya, jangan menjual.",
        "objective": (
            "Gali situasi, kekhawatiran, dan kebutuhan Pak Budi lewat pertanyaan "
            "terbuka dulu — jangan tawarkan produk apa pun sampai kamu benar-benar "
            "paham ceritanya."
        ),
        "focus_note": (
            "DRILL FOKUS: DISCOVERY. Jangan mau dengar produk apa pun sampai FA "
            "benar-benar menggali situasi, kekhawatiran, dan kebutuhanmu lewat "
            "pertanyaan. Kalau FA mulai jualan sebelum bertanya, tolak dan minta "
            "dia tanya dulu."
        ),
    },
    {
        "id": "objection_gauntlet",
        "title": "Menangani Keberatan",
        "dimension": "objection_handling",
        "persona_id": "skeptical_owner",
        "summary": "Keberatan bertubi-tubi soal klaim dan kepercayaan. Tetap empatik dan substansial.",
        "objective": (
            "Tanggapi tiap keberatan dengan empati dulu, lalu fakta yang substansial. "
            "Pastikan keberatannya benar-benar teratasi sebelum lanjut, bukan sekadar "
            "ditenangkan."
        ),
        "focus_note": (
            "DRILL FOKUS: OBJECTION HANDLING. Lempar keberatan bertubi-tubi soal "
            "klaim, kepercayaan, dan risiko. Uji apakah FA menjawab dengan empati "
            "DAN substansi, bukan sekadar menenangkan."
        ),
    },
    {
        "id": "numbers_drill",
        "title": "Pengetahuan Produk",
        "dimension": "product_knowledge",
        "persona_id": "young_executive",
        "summary": "Andi hanya peduli angka. Pastikan IRR, premi, dan surrender value-nya tepat.",
        "objective": (
            "Jawab tiap pertanyaan angka Andi dengan akurat — IRR, premi, surrender "
            "value, biaya — sesuai FAKTA_PRODUK. Jangan mengarang; kalau tidak tahu, "
            "akui dan janji cek."
        ),
        "focus_note": (
            "DRILL FOKUS: PRODUCT KNOWLEDGE. Tanya angka spesifik terus-menerus "
            "(IRR, premi, surrender value, biaya). Kalau FA salah atau ngarang vs "
            "FAKTA_PRODUK, tegur langsung."
        ),
    },
    {
        "id": "closing_drill",
        "title": "Latihan Closing",
        "dimension": "closing",
        "persona_id": "young_executive",
        "summary": "Andi tertarik tapi belum memutuskan. Arahkan ke next step yang jelas tanpa memaksa.",
        "objective": (
            "Arahkan Andi ke satu next step yang jelas (proposal/jadwal ketemu) tanpa "
            "memaksa, lalu kunci komitmen waktunya."
        ),
        "focus_note": (
            "DRILL FOKUS: CLOSING. Kamu sebenarnya cukup tertarik tapi belum "
            "memutuskan. Beri ruang buat FA mengarahkan ke next step yang jelas; "
            "kalau FA tidak menutup atau malah memaksa, tunjukkan keraguan."
        ),
    },
    {
        "id": "rapport_warmup",
        "title": "Membangun Relationship",
        "dimension": "rapport",
        "persona_id": "cautious_mom",
        "summary": "Ibu Sari hanya terbuka pada advisor yang membangun kepercayaan dulu. Pelan-pelan dan bangun relationship.",
        "objective": (
            "Bangun kepercayaan Ibu Sari dulu lewat obrolan yang hangat dan tulus "
            "sebelum masuk ke produk atau angka."
        ),
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
            "objective": d.get("objective"),
        }
        for d in DRILLS
    ]
