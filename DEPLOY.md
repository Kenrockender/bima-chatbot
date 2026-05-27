# Deployment Guide

Frontend deploys to **Vercel**. Backend deploys to **Railway** (or any platform that supports a Dockerfile + persistent volume).

## 1. Backend — Railway

Railway can build the Dockerfile in `backend/` and provides a persistent volume for SQLite + uploaded PDFs.

### Steps

1. Sign up at https://railway.app → **New Project** → **Deploy from GitHub repo** → pick this repo.
2. After Railway detects the repo, open the service settings:
   - **Root Directory:** `backend`
   - **Build:** Railway auto-detects the Dockerfile.
   - **Start command:** leave empty (Dockerfile `CMD` handles it).
3. Add a **Volume**: mount path `/app/data` (matches `./data/...` in `backend/app/config.py`).
4. Set environment variables (Variables tab):

   | Variable | Value |
   |---|---|
   | `OPENROUTER_API_KEY` | your key from https://openrouter.ai/keys |
   | `ADMIN_PASSWORD` | something strong, not `changeme` |
   | `CORS_ORIGINS` | your Vercel URL (e.g. `https://bima.vercel.app`) — comma-separated if multiple |
   | `SQLITE_PATH` | `/app/data/bima.db` |
   | `UPLOAD_DIR` | `/app/data/uploads` |
   | `SEED_DIR` | leave empty (dataset is not copied into the container) |

5. **Networking** tab → **Generate Domain**. Note the URL (e.g. `https://bima-backend.up.railway.app`).
6. Smoke test: open `https://<your-backend>/docs` — should show FastAPI Swagger UI.

### Seeding the initial dataset

The `dataset/` folder isn't shipped to Railway. After the backend is live:

1. Open the frontend at `https://<your-vercel-url>/admin`.
2. Sign in with `ADMIN_PASSWORD`.
3. Drag & drop the PDFs from `dataset/` into the upload area.

## 2. Frontend — Vercel

The frontend is a Next.js app in `frontend/`. It proxies `/api/*` calls to the backend via the env var `BACKEND_URL` (see [frontend/app/api/[...path]/route.ts](frontend/app/api/[...path]/route.ts)).

### Steps

1. In the Vercel dashboard, open your project → **Settings**.
2. **General** → **Root Directory** → set to `frontend`.
3. **Environment Variables** → add:

   | Variable | Value |
   |---|---|
   | `BACKEND_URL` | the Railway URL from step 1.5 (no trailing slash) |

4. **Deployments** → trigger a redeploy (or push a new commit).
5. Smoke test:
   - Open the Vercel URL → chat UI loads.
   - Open `/admin` → sign in with `ADMIN_PASSWORD` → upload a PDF → wait for status `ready` → ask a question on `/`.

## Troubleshooting

- **CORS error in browser console:** make sure `CORS_ORIGINS` on Railway includes the exact Vercel URL (with `https://`, no trailing slash).
- **Backend cold start is slow:** Railway free tier sleeps after inactivity. The first request after sleep can take 10–30s. Upgrade to a paid plan or use a keep-alive ping if this matters.
- **Uploaded PDFs disappear after redeploy:** the Railway volume wasn't mounted at `/app/data`. Check the volume mount path in service settings.
