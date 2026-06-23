# Deployment Guide

Frontend deploys to **Vercel**. Backend deploys to **Render** as an always-on
Docker container (any platform that runs a Dockerfile works too). Persistent data
lives in **Firestore**; users authenticate with **Firebase (Google sign-in)**. The
backend is stateless — no persistent disk is needed.

## 0. Firebase (one-time)

1. Create a project at https://console.firebase.google.com.
2. **Build → Authentication → Sign-in method →** enable **Google**.
3. **Build → Firestore Database →** create a database (production mode). Since only
   the backend touches Firestore (via the Admin SDK), keep the security rules denying
   all client access.
4. **Project settings → Service accounts → Generate new private key** → download the
   JSON. This is the backend's `FIREBASE_SERVICE_ACCOUNT`.
5. **Project settings → Your apps → Web app** → copy the config object. These are the
   frontend's `NEXT_PUBLIC_FIREBASE_*` values.
6. Under Authentication → Settings → **Authorized domains**, add your Vercel domain.

## 1. Backend — Render

Render builds `backend/Dockerfile` from the [`render.yaml`](render.yaml) blueprint
at the repo root. No volume is needed — all state is in Firestore. The Dockerfile
binds to `$PORT` (which Render injects), falling back to 8000 locally.

> **Push first.** Render's Blueprint reads `render.yaml` from GitHub, so commit and
> push it before importing:
> ```bash
> git add render.yaml backend/Dockerfile DEPLOY.md
> git commit -m "Add Render blueprint for backend deploy"
> git push
> ```

### Steps

1. Go to https://dashboard.render.com → **New +** → **Blueprint**.
2. Connect the GitHub repo `Kenrockender/bima-chatbot`. Render reads `render.yaml`
   and creates the `bima-backend` web service (region: Singapore, free plan).
3. Render prompts for the 4 secret env vars (the ones marked `sync: false`):

   | Variable | Value |
   |---|---|
   | `OPENROUTER_API_KEY` | your key from https://openrouter.ai/keys |
   | `FIREBASE_SERVICE_ACCOUNT` | the service-account JSON from step 0.4 (one line; `jq -c . file.json` to minify) |
   | `ADMIN_EMAILS` | comma-separated admin emails (or set the `admin:true` claim instead) |
   | `CORS_ORIGINS` | leave as `http://localhost:3000` for now — update in step 3 once you have the Vercel URL |

   The non-secret vars (`OPENROUTER_BASE_URL`, `OPENROUTER_CHAT_MODEL`,
   `ALLOWED_EMAIL_DOMAINS`, `SEED_DIR`, `UPLOAD_DIR`) are already set in `render.yaml`.

4. Click **Apply**. The first Docker build takes a few minutes.
5. Copy the service URL (e.g. `https://bima-backend.onrender.com`).
6. Smoke test: open `https://<your-backend>/health` → should return `{"status":"ok"}`,
   or `/docs` for the FastAPI Swagger UI.

### Seeding the initial dataset (automatic)

The curated seed corpus ships **inside the backend image**: `backend/seed/<Insurer>/*.txt`
is copied in by the Dockerfile and `SEED_DIR=/app/seed` is baked in too. On first
startup the backend ingests it into Firestore automatically, tagging each document
with its insurer from the subfolder name (BCA Life = our products, others =
competitors for comparison). **No manual upload is required** for the seed set.

The ingest is idempotent — it skips documents whose name already exists, so
redeploys won't create duplicates.

To change the seed corpus: drop/replace PDFs under `dataset/<Insurer>/`, regenerate
the text, and redeploy:

```powershell
backend\.venv\Scripts\python.exe scripts\extract_dataset.py   # dataset/*.pdf -> backend/seed/*.txt
git add backend/seed dataset && git commit -m "update seed" && git push
```

You can still add extra one-off PDFs at runtime via `/admin` (those are tagged
`BCA Life`).

## 2. Frontend — Vercel

The frontend is a Next.js app in `frontend/`. It proxies `/api/*` calls to the backend via the env var `BACKEND_URL` (see [frontend/app/api/[...path]/route.ts](frontend/app/api/[...path]/route.ts)).

### Steps

1. In the Vercel dashboard, open your project → **Settings**.
2. **General** → **Root Directory** → set to `frontend`.
3. **Environment Variables** → add:

   | Variable | Value |
   |---|---|
   | `BACKEND_URL` | the Render URL from step 1.5 (no trailing slash) |
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | from the Firebase web config (step 0.5) |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `<project>.firebaseapp.com` |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | your Firebase project id |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `<project>.appspot.com` |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | from the web config |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | from the web config |

4. **Deployments** → trigger a redeploy (or push a new commit).
5. Smoke test:
   - Open the Vercel URL → Google sign-in screen → sign in → chat UI loads.
   - Open `/admin` with an admin account → upload a PDF → wait for status `ready` → ask a question on `/`.

## Troubleshooting

- **CORS error in browser console:** make sure `CORS_ORIGINS` on Render includes the exact Vercel URL (with `https://`, no trailing slash). Also confirm your Vercel domain is in Firebase → Authentication → Authorized domains.
- **Backend cold start is slow:** Render's free tier sleeps after 15 min of inactivity. The first request after sleep can take ~50s. Upgrade to the **Starter** plan ($7/mo) for always-on, or hit `/health` on a schedule to keep it warm.
- **Google login fails on the deployed site:** add your Vercel domain under Firebase → Authentication → Settings → Authorized domains.
