# Deployment Guide

Frontend deploys to **Vercel**. Backend deploys to **Hugging Face Spaces** as a
Docker container — the only major host left with a genuinely free tier that needs
**no credit card** (Render, Koyeb, Fly, and Railway all now require one). Any
platform that runs a Dockerfile works too; `render.yaml` is kept in the repo as a
paid alternative. Persistent data lives in **Firestore**; users authenticate with
**Firebase (Google sign-in)**. The backend is stateless — no persistent disk is
needed.

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

## 1. Backend — Hugging Face Spaces

A Space is its own git repo and builds a Docker image from the repo **root**, so
the deploy is: push the **contents of `backend/`** to a Space repo. Rather than
keep a second copy of the folder on disk, we push the `backend/` subtree straight
to the Space remote with `git subtree` — `backend/` stays the single source of
truth and there's no copy to keep in sync. The
[`backend/README.md`](backend/README.md) carries the HF metadata (`sdk: docker`,
`app_port: 8000`) and [`backend/.gitignore`](backend/.gitignore) keeps `.env` and
the service-account JSON out of the repo. The Dockerfile needs **no changes**.

Free **CPU Basic** hardware is 2 vCPU / 16 GB RAM, no credit card. It sleeps when
idle (first request after sleep is slow) and the disk is ephemeral — fine here
since all state lives in Firestore. Outbound calls to OpenRouter and Firebase go
over port 443, which Spaces allows.

### Steps

1. Create the Space: https://huggingface.co/new-space → name `bima-backend`,
   **SDK: Docker** → **Blank**, visibility **Private** (or **Protected** if you
   want the app reachable but the code hidden). No card is requested.
2. Add the Space as a git remote and push the `backend/` subtree to it. From the
   project root:
   ```bash
   # one-time: register the Space repo as a remote called "hf-space"
   git remote add hf-space https://huggingface.co/spaces/<your-hf-user>/bima-backend
   # split backend/ into a synthetic commit and push it as the Space repo's root
   git push hf-space "$(git subtree split --prefix=backend HEAD):refs/heads/main" --force
   ```
   The Space repo's own history is a throwaway deploy artifact unrelated to this
   subtree, so the push is a force-push. Only files tracked by git under `backend/`
   are pushed, so `.env`, the service-account JSON, `data/`, and `.venv/` (all
   gitignored) never leave your machine. There is no separate folder to maintain —
   `backend/` is the only copy.

   On Windows, [`scripts/deploy-backend.ps1`](scripts/deploy-backend.ps1) wraps
   this; run `.\scripts\deploy-backend.ps1` from the project root.

   (You'll be prompted for an HF **access token** as the password — create one at
   https://huggingface.co/settings/tokens with *write* scope.)
3. In the Space → **Settings → Variables and secrets**, add:

   | Name | Kind | Value |
   |---|---|---|
   | `OPENROUTER_API_KEY` | secret | your key from https://openrouter.ai/keys |
   | `FIREBASE_SERVICE_ACCOUNT` | secret | the service-account JSON from step 0.4 (one line; `jq -c . file.json` to minify) |
   | `ADMIN_EMAILS` | secret | comma-separated admin emails (or set the `admin:true` claim instead) |
   | `CORS_ORIGINS` | variable | leave as `http://localhost:3000` for now — change it to your Vercel URL once section 2 gives you one |
   | `OPENROUTER_BASE_URL` | variable | `https://openrouter.ai/api/v1` |
   | `OPENROUTER_CHAT_MODEL` | variable | `anthropic/claude-3.5-haiku` |
   | `ALLOWED_EMAIL_DOMAINS` | variable | `bcalife.co.id` |
   | `SEED_DIR` | variable | `/app/seed` |
   | `UPLOAD_DIR` | variable | `/app/data/uploads` |

   Adding a secret rebuilds the Space automatically.
4. Wait for the build (a few minutes). The app URL is
   `https://<your-hf-user>-bima-backend.hf.space`.
5. Smoke test: open `https://<your-hf-user>-bima-backend.hf.space/health` → should
   return `{"status":"ok"}`, or `/docs` for the FastAPI Swagger UI.

> **Future updates:** after committing changes to `backend/` in this repo, redeploy
> with a single command — `.\scripts\deploy-backend.ps1` (or the
> `git push hf-space "$(git subtree split --prefix=backend HEAD):refs/heads/main" --force`
> form above). No copy step, no second folder.

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
   | `BACKEND_URL` | the Space URL from step 1.4 (no trailing slash) |
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

- **CORS error in browser console:** make sure `CORS_ORIGINS` on the Space includes the exact Vercel URL (with `https://`, no trailing slash). Also confirm your Vercel domain is in Firebase → Authentication → Authorized domains.
- **Backend cold start:** the free Space sleeps after a period of inactivity, so the first request after sleep can take a while to wake. To keep it warm, hit `/health` on a schedule (e.g. a free cron-ping service) or pause it manually when not in use. 16 GB RAM means `pdfplumber` + `langchain` won't OOM.
- **Space build/runtime can't reach a service:** Spaces only allow outbound traffic on ports 80, 443, and 8080. OpenRouter and Firebase use 443, so they work; anything on a custom port would be blocked.
- **Google login fails on the deployed site:** add your Vercel domain under Firebase → Authentication → Settings → Authorized domains.
