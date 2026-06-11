# BIMA — BCA Life Onboarding Chatbot

BIMA (BCA Life Intelligent Mobile Assistant) is a chatbot for new BCA Life staff onboarding. It answers questions exclusively from a curated set of product PDFs.

See [docs/superpowers/specs/2026-05-25-bima-onboarding-chatbot-design.md](docs/superpowers/specs/2026-05-25-bima-onboarding-chatbot-design.md) for the original design (predates the cloud-only rewrite below).

## Stack

- **Frontend:** Next.js 14 + Tailwind CSS
- **Backend:** FastAPI
- **LLM:** DeepSeek via [OpenRouter](https://openrouter.ai/) (no local model)
- **Knowledge base:** PDFs held in process memory, full text stuffed into every prompt
- **Metadata:** SQLite (source list + statuses)

The dataset is small (a handful of product brochures, ~30k tokens total) so we skip embeddings and vector search entirely. Every prompt includes the full DOCUMENTS block as a stable prefix, which DeepSeek's automatic prompt cache picks up — cached input tokens are billed at ~10% of the normal rate and skip re-processing, so follow-up turns are much faster than the first one.

## Seed data

The `dataset/` folder is automatically ingested on first backend startup (controlled by `SEED_DIR`). On subsequent startups the existing sources from Firestore are re-hydrated into memory.

### Layout — one subfolder per insurer

```
dataset/
  BCA Life/      <- our products (recommended)
    heritage-platinum-protection-....pdf
    heritage-platinum-protection-....txt   <- curated, preferred
  Manulife/      <- competitor reference
  Prudential/    <- competitor reference
```

The **subfolder name becomes the document's `insurer` tag**. BIMA groups the DOCUMENTS block by issuer (`PENERBIT: BCA Life (PRODUK KAMI)` vs `… (KOMPETITOR)`), which is what lets it **compare products side by side while staying biased toward BCA Life** — competitor facts are described fairly, then the answer is steered back to the closest BCA Life product.

### Pre-extracted `.txt` (why, and how)

The seeder prefers a curated `.txt` next to each `.pdf` and only falls back to the PDF when no `.txt` twin exists. We commit the `.txt` because:

- **Faster, lighter seeding** — no pdfplumber on the startup path for the seed corpus.
- **Reviewable & deterministic** — the `.txt` is exactly what the LLM reads, git-diffable, with no per-run extraction variance.
- **Hand-correctable** — several competitor brochures extract poorly (doubled-glyph headers, two-column merges, image-only pages); a committed `.txt` can be fixed once.

Regenerate the `.txt` files after adding/replacing PDFs:

```powershell
backend\.venv\Scripts\python.exe scripts\extract_dataset.py
```

> Live admin uploads (`/admin`) still extract PDFs through pdfplumber and are tagged `BCA Life`.

## Quick start (Docker)

```bash
cp .env.example .env
# edit .env — set OPENROUTER_API_KEY (get one at https://openrouter.ai/keys)
# and change ADMIN_PASSWORD

docker compose up -d
```

Then:
- Chat UI: http://localhost:3000
- Admin panel: http://localhost:3000/admin (use `ADMIN_PASSWORD` from `.env`)
- Backend API: http://localhost:8000/docs

## Local dev (without Docker)

### Windows one-shot
```powershell
.\run-local.ps1
```
This installs deps and starts backend + frontend. Reads `OPENROUTER_API_KEY` from `.env` or the environment.

### Manual — Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows
pip install -r requirements.txt
cp .env.example .env              # set OPENROUTER_API_KEY
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Workflow

1. IT opens `/admin`, signs in with the admin password.
2. Upload PDFs (drag & drop) or add URLs. Each source goes `processing → ready` once its text has been loaded into the in-memory store.
3. Staff visit `/`, toggle EN/ID, and ask questions.
4. BIMA grounds answers in the loaded documents and cites them inline. If nothing matches, an escalation card with WhatsApp + email is shown.

## API surface

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/chat` | Send a question + history, get an answer + sources |
| `POST` | `/api/admin/verify` | Verify admin password |
| `GET` | `/api/admin/sources` | List sources |
| `POST` | `/api/admin/sources/pdf` | Upload one or more PDFs |
| `POST` | `/api/admin/sources/url` | Add a URL source |
| `DELETE` | `/api/admin/sources/{id}` | Remove a source |
| `POST` | `/api/admin/sources/{id}/reindex` | Re-process a source |

All `/api/admin/*` routes require header `X-Admin-Password: <pw>`.
