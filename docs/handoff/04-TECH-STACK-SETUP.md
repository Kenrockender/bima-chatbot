# Tech Stack & Setup Guide

## 1. Ringkasan Stack

| Layer | Teknologi | Catatan |
|---|---|---|
| Frontend framework | Next.js 16 (App Router) | React 19, TypeScript |
| Styling | Tailwind CSS 4 | via `@tailwindcss/postcss` |
| Frontend hosting | Vercel | auto-deploy dari `master` |
| Auth (client) | Firebase Auth (Google Sign-In) | `frontend/lib/firebase.ts` |
| Data fetching | SWR | `frontend/lib/swr.ts` |
| Markdown rendering | `react-markdown` + `remark-gfm` | untuk jawaban chat |
| Backend framework | FastAPI (Python) | ASGI, `uvicorn` |
| Backend hosting | Hugging Face Spaces (Docker) | dipilih karena PaaS lain butuh kartu kredit |
| LLM provider | OpenRouter (OpenAI-compatible API) | model default: `anthropic/claude-haiku-4.5` |
| LLM client lib | `langchain-openai` + `langchain-core` | dipakai untuk invoke/stream, bukan chains kompleks |
| Auth (server) | `firebase-admin` | verifikasi ID token, custom claim `admin` |
| Database | Cloud Firestore | satu-satunya penyimpanan persisten |
| PDF/PPTX extraction | `pdfplumber`, `python-pptx` | ekstraksi teks saat upload admin |
| URL scraping | `beautifulsoup4` + `requests` | untuk sumber berbasis URL |
| Deteksi bahasa | `langdetect` | toggle EN/ID otomatis di chat |
| TTS | ElevenLabs API (`eleven_turbo_v2_5`) | suara berbeda per gender persona |
| STT | Groq Whisper (`whisper-large-v3`) | fallback saat Web Speech API tak tersedia (iOS/Safari) |
| Container | Docker | `docker-compose.yml` (prod-like) & `docker-compose.local.yml` (dev) |

## 2. Prasyarat

- Node.js ≥ 20 (untuk Next.js 16 + React 19)
- Python ≥ 3.11 (kode diuji jalan sampai 3.14)
- Akun [OpenRouter](https://openrouter.ai/keys) dengan API key
- Project Firebase (Firestore + Authentication diaktifkan)
- (Opsional) Akun [ElevenLabs](https://elevenlabs.io/) untuk voice TTS natural
- (Opsional) Akun [Groq](https://console.groq.com/) untuk server-side STT
- Docker + Docker Compose (kalau mau jalankan lewat container, bukan wajib)

## 3. Setup Firebase (wajib untuk fitur training/auth)

1. Buat project di [Firebase Console](https://console.firebase.google.com/).
2. Aktifkan **Authentication → Sign-in method → Google**.
3. Aktifkan **Firestore Database** (mode production atau test, sesuai kebutuhan).
4. Buat **Service Account**: Project Settings → Service Accounts → Generate new private key → unduh file JSON. Ini dipakai backend untuk `firebase-admin` (jangan pernah commit file ini ke git — sudah di `.gitignore`).
5. Ambil **Web App config** (Project Settings → General → Your apps → Web app) untuk env `NEXT_PUBLIC_FIREBASE_*` di frontend.
6. (Opsional) Set custom claim `admin: true` pada akun tertentu via Admin SDK, ATAU cukup daftarkan emailnya di env `ADMIN_EMAILS` (lebih sederhana, tidak perlu script custom claim).

## 4. Environment Variables

### 4.1 Root `.env` (dipakai `docker-compose.yml` / `run-local.ps1`)

```bash
# OpenRouter — wajib
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_CHAT_MODEL=anthropic/claude-haiku-4.5
OPENROUTER_COACH_MODEL=      # kosong = pakai OPENROUTER_CHAT_MODEL
OPENROUTER_EVAL_MODEL=       # kosong = pakai OPENROUTER_CHAT_MODEL

# Firebase Admin (backend)
FIREBASE_SERVICE_ACCOUNT=          # inline JSON, ATAU
FIREBASE_SERVICE_ACCOUNT_FILE=     # path ke file JSON (lokal dev)
ADMIN_EMAILS=you@company.com
ALLOWED_EMAIL_DOMAINS=bcalife.co.id   # kosongkan untuk izinkan email apa saja

ESCALATION_WHATSAPP=+62 812-0000-0000
ESCALATION_EMAIL=hr-it@bcalife.co.id
```

### 4.2 `backend/.env` (tambahan, lihat `backend/app/config.py` untuk daftar lengkap default)

```bash
MAX_DOCS_BLOCK_CHARS=120000     # safety valve token budget dokumen produk
LLM_MAX_RETRIES=2

LEADERBOARD_HIDDEN=Kenneth Gunawan   # nama/email yang disembunyikan dari leaderboard (bukan dihapus)
UPLOAD_DIR=./data/uploads
SEED_DIR=                        # path ke backend/seed saat startup untuk auto-ingest

# Server-side STT (Groq Whisper) — opsional
STT_API_KEY=
STT_BASE_URL=https://api.groq.com/openai/v1
STT_MODEL=whisper-large-v3

# ElevenLabs TTS — opsional (tanpa ini, frontend fallback ke Web Speech API browser)
ELEVENLABS_API_KEY=
ELEVENLABS_BASE_URL=https://api.elevenlabs.io/v1
ELEVENLABS_MODEL=eleven_turbo_v2_5
ELEVENLABS_VOICE_FEMALE=21m00Tcm4TlvDq8ikWAM   # Rachel
ELEVENLABS_VOICE_MALE=pNInz6obpgDQGcFmaJgB     # Adam

CORS_ORIGINS=http://localhost:3000
```

### 4.3 `frontend/.env.local`

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

> Cek isi aktual `frontend/lib/firebase.ts` dan `frontend/lib/appConfig.ts` untuk nama variabel persis yang dibaca — daftar di atas adalah pola standar Firebase Web SDK.

## 5. Setup Lokal — Langkah demi Langkah

```bash
# 1. Clone & masuk folder
git clone <repo-url> && cd "AI Chatbot"

# 2. Siapkan env
cp .env.example .env
# isi OPENROUTER_API_KEY minimal; isi FIREBASE_* kalau mau test auth/training

# 3. Backend
cd backend
python -m venv .venv
.venv\Scripts\activate              # Windows; source .venv/bin/activate di Unix
pip install -r requirements.txt
cp .env.example .env                # kalau ada; atau buat manual sesuai §4.2
uvicorn app.main:app --reload       # jalan di :8000, docs di /docs

# 4. Frontend (terminal terpisah)
cd frontend
npm install
cp .env.local.example .env.local    # kalau ada; atau buat manual sesuai §4.3
npm run dev                          # jalan di :3000
```

Windows one-shot (menjalankan backend + frontend sekaligus): `.\run-local.ps1`.

## 6. Setup via Docker

```bash
cp .env.example .env
# edit .env

docker compose up -d
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000/docs (Swagger UI otomatis dari FastAPI)

`docker-compose.local.yml` tersedia untuk variasi dev-mode (hot reload volume mount).

## 7. Menyiapkan Knowledge Base (dataset produk)

```
dataset/<Insurer>/*.pdf     ← sumber asli (human source of truth)
backend/seed/<Insurer>/*.txt   ← hasil ekstraksi, di-commit, auto-seed saat startup
```

Regenerasi `.txt` setelah menambah/mengganti PDF:

```powershell
backend\.venv\Scripts\python.exe scripts\extract_dataset.py
```

Untuk recommender, tambahkan fact sheet `.md` terkondensasi di folder yang sama dengan nama file sama (`<stem>.md`) supaya recommender pakai versi hemat-token itu, bukan brosur penuh (lihat `backend/app/recommender.py::_factsheet_for`).

## 8. Testing

```bash
cd backend
pytest              # semua test di backend/tests/
```

Frontend: type-check via `npx tsc --noEmit` (tidak ada test runner terpasang saat ini).

## 9. Deploy Production

### Backend → Hugging Face Spaces (Docker SDK)
```powershell
.\scripts\deploy-backend.ps1
```
Push isi `backend/` (via `git subtree split`) ke remote `hf-space`. Secrets (OPENROUTER_API_KEY, FIREBASE_SERVICE_ACCOUNT, dll.) diisi di Space Settings → Variables and secrets, **bukan** file `.env` (tidak ikut ter-deploy). Dockerfile backend sudah siap; Space hanya menerima outbound port 80/443/8080 — OpenRouter/Firebase/ElevenLabs/Groq semua pakai HTTPS (443), jadi aman.

### Frontend → Vercel
Auto-deploy dari branch `master`. Set env `NEXT_PUBLIC_*` di Vercel Project Settings → Environment Variables (harus persis sama nilainya dengan yang dipakai backend untuk Firebase project ID, dsb).

`render.yaml` masih disimpan sebagai fallback berbayar kalau suatu saat pindah dari HF Spaces.

Detail lengkap & troubleshooting deploy: lihat `DEPLOY.md` di root repo.

## 10. Catatan Biaya (penting untuk operasional)

- **OpenRouter (Claude Haiku 4.5):** murah, dan prompt system yang stabil (persona + fakta produk) dipakai sebagai prefix cache-friendly — turn ke-2+ dalam sesi yang sama dibilling lebih murah lewat automatic prompt caching provider.
- **ElevenLabs TTS:** dibilling **per karakter** — di-cache in-memory (LRU, 128 entri) per kombinasi (voice, model, speed, teks) supaya replay/kalimat berulang tidak bayar dua kali. Tetap pantau volume kalau trafik naik signifikan.
- **Groq STT:** tier gratis untuk Whisper — hanya aktif kalau `STT_API_KEY` diisi.
- Live coaching di-gate secara heuristik (`_should_coach` di `training.py`) supaya tidak setiap giliran memicu panggilan LLM tambahan — mengurangi ~60-70% panggilan coach tanpa kehilangan momen penting.
