# Struktur Folder (Beranotasi)

```
AI Chatbot/                              ← root repo
├── .env.example                         # Template env untuk docker-compose / run-local.ps1
├── DEPLOY.md                            # Panduan deploy lengkap (HF Spaces + Vercel) & troubleshooting
├── README.md                            # README utama (perlu sinkron — lihat docs/handoff/02-README.md)
├── docker-compose.yml                   # Compose untuk mode "prod-like"
├── docker-compose.local.yml             # Compose untuk dev (hot reload)
├── render.yaml                          # Config fallback Render.com (berbayar, tidak dipakai default)
├── run-local.ps1                        # One-shot: install deps + start backend & frontend (Windows)
├── bca-life-logo.svg                    # Logo co-brand BCA Life (dipakai di sidebar/mobile drawer/sign-in)
│
├── dataset/                             # PDF/PPTX ASLI produk, satu subfolder per insurer (source of truth manusia)
│   ├── BCA Life/                          # Produk kami — direkomendasikan
│   ├── Manulife/                          # Kompetitor
│   ├── Prudential/                        # Kompetitor
│   ├── AIA/                               # Kompetitor
│   └── MSIG Life/                         # Kompetitor
│
├── scripts/                             # Skrip operasional (PowerShell + Python)
│   ├── extract_dataset.py                 # dataset/*.pdf → backend/seed/*.txt
│   ├── deploy-backend.ps1                 # git subtree push backend/ → HF Space
│   ├── smoke-test.ps1                     # Smoke test cepat endpoint utama
│   ├── start.ps1 / stop.ps1               # Kontrol proses lokal
│   └── logs.ps1                           # Tail log lokal
│
├── docs/                                # Dokumentasi non-kode
│   ├── superpowers/specs/                  # Spec desain historis (mis. desain awal, Firestore/Auth migration)
│   └── handoff/                            # ← PAKET DOKUMEN INI (PRD, schema, setup, dst.)
│
├── backend/                             # FastAPI app
│   ├── Dockerfile                          # Image backend (dipakai lokal & HF Spaces)
│   ├── README.md                           # Metadata khusus HF Spaces (sdk: docker, app_port, dst.)
│   ├── requirements.txt / requirements-dev.txt
│   ├── pytest.ini
│   ├── seed/                               # .txt terkurasi per insurer — di-commit, auto-seed saat startup
│   │   ├── BCA Life/  Manulife/  Prudential/  AIA/  MSIG Life/
│   │   └── <stem>.md (opsional)            # Fact sheet kondensasi khusus recommender (hemat token)
│   ├── data/uploads/                       # Temp dir upload PDF admin (dibersihkan setelah ekstraksi)
│   ├── tests/                              # pytest — curriculum, ratelimit, rag helpers, sessions, tts cache
│   └── app/
│       ├── main.py                           # Entry FastAPI: lifespan (seed + rehydrate sources), CORS, routers
│       ├── config.py                         # Semua Settings (pydantic-settings) — SATU sumber kebenaran env
│       ├── firebase.py                       # Bootstrap firebase-admin (lazy, thread-safe) + verify_token()
│       ├── auth.py                           # get_current_user() & require_admin() dari Bearer token
│       ├── db.py                             # CRUD koleksi Firestore `sources`
│       ├── rag.py                            # LLM client, prompt cache helper, chat Q&A (/api/chat), extract PDF/PPTX/URL
│       ├── ratelimit.py                      # Rate limiter in-memory per key
│       ├── schemas.py                        # Pydantic model untuk /api/chat & /api/admin/sources
│       │
│       ├── personas.py                       # 7 persona nasabah tetap + build_custom() untuk persona ad-hoc
│       ├── drills.py                         # 5 drill fokus (persona + dimensi + focus_note)
│       ├── curriculum.py                     # Learning Path 8-modul + mastery gate (backend hidup, UI dorman)
│       ├── sessions.py                       # Session store roleplay (in-memory + write-through Firestore)
│       ├── training.py                       # Engine roleplay: start/reply/reply_stream/end, live coach, eval akhir sesi
│       ├── progress.py                       # Streak/XP/level/badge (derived-on-read), leaderboard, manager overview
│       ├── recommender.py                    # Rekomendasi produk + skrip jualan + head-to-head/complementary compare
│       │
│       ├── routes_chat.py                    # POST /api/chat
│       ├── routes_admin.py                   # /api/admin/* (sources CRUD, overview) — semua @require_admin
│       ├── routes_training.py                # /api/training/* (persona/drill/start/chat/end/progress/tts/stt)
│       ├── routes_recommender.py             # /api/recommender/* (recommend/compare/compare-upload/competitors)
│       └── seed.py                           # seed_from_dir() — auto-ingest backend/seed/ saat startup
│
└── frontend/                            # Next.js app (App Router)
    ├── Dockerfile
    ├── package.json                        # Next 16, React 19, Tailwind 4, firebase, react-markdown
    ├── next.config.js / tailwind.config.ts / postcss.config.js / tsconfig.json
    ├── public/                             # Aset statis (ikon, logo)
    │
    ├── lib/
    │   ├── api.ts                           # Wrapper fetch ke backend (attach Bearer token)
    │   ├── appConfig.ts                     # Baca NEXT_PUBLIC_* env
    │   ├── firebase.ts                      # Init Firebase client SDK (auth only)
    │   ├── swr.ts                           # Konfigurasi SWR + cache key prefetcher
    │   ├── i18n.ts                          # String EN/ID untuk chat
    │   ├── coaching.ts                      # Helper render live-coach chip
    │   └── productComparison.ts / recommender.ts   # Helper form & tipe untuk /recommend
    │
    ├── hooks/
    │   ├── useSpeech.ts                     # Web Speech API (browser TTS/STT default)
    │   ├── useServerTTS.ts                  # ElevenLabs via backend — menggantikan useSpeech saat key diset
    │   └── useServerSTT.ts                  # Groq Whisper via backend — fallback iOS/Safari
    │
    ├── components/
    │   ├── AppShell.tsx / AppSidebar.tsx    # Layout utama + navigasi (nav: chat, progress, leaderboard, manager*, recommend, admin*)
    │   ├── AuthProvider.tsx / AuthGate.tsx  # Context auth Firebase + proteksi rute
    │   ├── ChatBubble.tsx / SubtitleDisplay.tsx / VoiceStage.tsx / AudioWaveform.tsx   # UI percakapan & voice
    │   ├── MicButton.tsx                    # Push-to-talk manual (TIDAK ada auto-send by silence)
    │   ├── CoachChip.tsx                    # Chip live-coaching per giliran
    │   ├── FeedbackReport.tsx               # Laporan akhir sesi (skor 5 dimensi, badge, banner modul)
    │   ├── PersonaCard.tsx                  # Kartu pilih persona/drill
    │   ├── EscalationCard.tsx               # Kartu WhatsApp/email saat chat Q&A tidak ketemu jawaban
    │   ├── SeraAvatar.tsx / icons.tsx / ThemeToggle.tsx / SectionTitle.tsx / ConfirmModal.tsx / FetchError.tsx
    │
    └── app/                                 # Routing (App Router)
        ├── layout.tsx / globals.css / manifest.ts / error.tsx / not-found.tsx
        ├── page.tsx                          # "/" — Chat Q&A + Roleplay training (persona picker, drill entry, module deep-link ?module=)
        ├── progress/page.tsx                 # "/progress" — streak, rata-rata dimensi, tren, badge, rekomendasi berikutnya
        ├── leaderboard/page.tsx              # "/leaderboard" — ranking rata-rata skor tim
        ├── manager/page.tsx                  # "/manager" — dashboard tim (admin-only)
        ├── recommend/page.tsx                # "/recommend" — form profil nasabah → rekomendasi & comparison
        ├── admin/page.tsx                    # "/admin" — kelola sources (admin-only)
        └── api/[...path]/route.ts            # Proxy Next.js → backend FastAPI (menghindari CORS/mixed-content di prod)
```

## Catatan Struktur yang Perlu Diketahui

1. **`frontend/app/learn/`** pernah ada (Learning Path UI) tapi **dihapus** pada commit `f892fe4` (2026-07-07) — kode backend pendukungnya (`curriculum.py`, endpoint `/api/training/curriculum`) **sengaja dibiarkan hidup** supaya bisa diaktifkan lagi tanpa perubahan backend.
2. **`bima-9c159-firebase-adminsdk-*.json`** di root — file service account Firebase. **Harus tetap di `.gitignore`**; kalau terlihat di git history, rotate key segera.
3. **`backend/seed/`** vs **`dataset/`**: `dataset/` adalah PDF asli (tidak ikut image Docker); `backend/seed/` adalah `.txt` hasil ekstraksi yang **ikut ter-commit dan ter-deploy** — ini yang benar-benar dibaca aplikasi saat runtime.
4. Setiap route admin-only (`/admin`, `/manager`) dan endpoint backend `@require_admin` bergantung pada custom claim Firebase `admin` ATAU keanggotaan `ADMIN_EMAILS` — bukan password terpisah (README lama menyebut `ADMIN_PASSWORD`, itu sudah usang sejak migrasi Firebase Auth).
