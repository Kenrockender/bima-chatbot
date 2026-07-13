# Sera — AI Sales-Coaching & Product-Knowledge Platform (BCA Life)

> Catatan: ini adalah README konsolidasi yang mencerminkan kondisi kode **saat ini** (2026-07-13), termasuk fitur roleplay training yang belum tercermin di [README.md](../../README.md) versi lama di root repo (yang masih menjelaskan versi awal "chatbot onboarding Q&A saja"). Gunakan dokumen ini sebagai referensi utama; README root bisa disinkronkan kemudian.

Sera (dahulu bernama **BIMA**) adalah aplikasi dua-in-satu untuk Financial Advisor (FA) BCA Life:

1. **Chatbot Tanya-Jawab** — jawab pertanyaan produk dari brosur/RIPLAY BCA Life & kompetitor yang di-*stuff* penuh ke prompt (tanpa vector DB — knowledge base masih kecil).
2. **Simulator Roleplay Sales Training** — FA berlatih pitching ke 7+1 persona nasabah AI, dapat live coaching per giliran dan laporan evaluasi 5-dimensi di akhir sesi, dengan progress/streak/leaderboard/manager dashboard di atasnya.

## Fitur Utama

| Fitur | Rute Frontend | Endpoint Utama |
|---|---|---|
| Chat Q&A produk | `/` (mode chat) | `POST /api/chat` |
| Roleplay training + drill | `/` (mode latihan) | `POST /api/training/start`, `/chat`, `/chat/stream`, `/end` |
| Progress & badge FA | `/progress` | `GET /api/training/progress`, `/history`, `/next` |
| Leaderboard tim | `/leaderboard` | `GET /api/training/leaderboard` |
| Manager dashboard | `/manager` (admin) | `GET /api/admin/overview` |
| Recommender produk & skrip jualan | `/recommend` | `POST /api/recommender/recommend` |
| Perbandingan vs kompetitor | `/recommend` | `POST /api/recommender/compare`, `/compare-upload` |
| Kelola sumber dokumen | `/admin` (admin) | `GET/POST/DELETE /api/admin/sources*` |
| Voice input/output | (inline di `/`) | `POST /api/training/tts`, `/stt/transcribe` |

Fitur **Learning Path / Kurikulum** (8 modul progresif dengan mastery gate) ada di backend (`app/curriculum.py`, `GET /api/training/curriculum`) tapi UI-nya (`/learn`) sengaja dihapus dari navigasi pada 2026-07-07 — bisa dihidupkan lagi tanpa perubahan backend.

## Stack Singkat

- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind CSS 4, deploy ke Vercel.
- **Backend:** FastAPI (Python), deploy ke Hugging Face Spaces (Docker).
- **LLM:** Claude Haiku 4.5 via [OpenRouter](https://openrouter.ai/) — single-model default, prompt-caching-friendly.
- **Data:** Firestore (Firebase) — backend-mediated (frontend tidak pernah bicara langsung ke Firestore).
- **Auth:** Firebase Google Sign-In; admin ditentukan via custom claim `admin` atau `ADMIN_EMAILS`.
- **Voice:** ElevenLabs (TTS, per-persona-gender voice) + Groq Whisper (STT, fallback iOS/Safari).

Detail lengkap ada di [04-TECH-STACK-SETUP.md](04-TECH-STACK-SETUP.md).

## Menjalankan Secara Lokal (ringkas)

```bash
# Backend
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # isi OPENROUTER_API_KEY, FIREBASE_SERVICE_ACCOUNT_FILE, dst.
uvicorn app.main:app --reload

# Frontend (terminal terpisah)
cd frontend
npm install
npm run dev
```

Atau di Windows: `.\run-local.ps1` (menjalankan keduanya sekaligus). Lihat [04-TECH-STACK-SETUP.md](04-TECH-STACK-SETUP.md) untuk env var lengkap dan setup Firebase/ElevenLabs/Groq.

## Data Produk (Knowledge Base)

`dataset/` menyimpan PDF asli per-insurer (`BCA Life/`, `Manulife/`, `Prudential/`, `AIA/`, `MSIG Life/`). `scripts/extract_dataset.py` mengonversinya jadi `.txt` terkurasi di `backend/seed/`, yang di-*commit* ke git dan di-seed otomatis saat backend start (`SEED_DIR`). Recommender lebih memilih fact sheet `.md` terkondensasi (kalau ada) daripada teks brosur penuh untuk menghemat token — lihat `backend/app/recommender.py` fungsi `_factsheet_for`.

## Struktur Data (Firestore)

Lihat [03-DATABASE-SCHEMA.md](03-DATABASE-SCHEMA.md) untuk skema lengkap koleksi `sources`, `training_sessions`, `users/{uid}`, dan `users/{uid}/attempts`.

## Deploy

- Backend → Hugging Face Spaces (Docker, git subtree dari `backend/`) via `scripts/deploy-backend.ps1`. Dipilih karena Render/Koyeb/Fly/Railway semuanya mensyaratkan kartu kredit yang gagal untuk kartu Indonesia milik pemilik proyek.
- Frontend → Vercel (auto-deploy dari branch `master`).
- Detail lengkap & troubleshooting: lihat `DEPLOY.md` di root repo.

## Testing

```bash
cd backend
pytest
```

Test tersedia untuk kurikulum, rate limiter, RAG helper, sessions, dan cache TTS (`backend/tests/`).

## Dokumen Terkait dalam Paket Ini

1. [01-PRD.md](01-PRD.md) — kebutuhan produk & keputusan yang mengikat
2. **02-README.md** — dokumen ini
3. [03-DATABASE-SCHEMA.md](03-DATABASE-SCHEMA.md) — skema Firestore lengkap
4. [04-TECH-STACK-SETUP.md](04-TECH-STACK-SETUP.md) — stack & panduan setup dari nol
5. [05-FOLDER-STRUCTURE.md](05-FOLDER-STRUCTURE.md) — peta direktori beranotasi
6. [06-AI-GENERATION-PROMPT.md](06-AI-GENERATION-PROMPT.md) — prompt bertahap untuk membangun ulang aplikasi ini dengan AI coding agent
