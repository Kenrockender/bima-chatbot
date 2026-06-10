# Deployment Guide

Frontend deploys to **Vercel**. Backend deploys to **Railway** (or any platform that runs a Dockerfile). Persistent data lives in **Firestore**; users authenticate with **Firebase (Google sign-in)**.

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

## 1. Backend — Railway

Railway builds the Dockerfile in `backend/`. No volume is needed — all state is in Firestore.

### Steps

1. Sign up at https://railway.app → **New Project** → **Deploy from GitHub repo** → pick this repo.
2. After Railway detects the repo, open the service settings:
   - **Root Directory:** `backend`
   - **Build:** Railway auto-detects the Dockerfile.
   - **Start command:** leave empty (Dockerfile `CMD` handles it).
3. Set environment variables (Variables tab):

   | Variable | Value |
   |---|---|
   | `OPENROUTER_API_KEY` | your key from https://openrouter.ai/keys |
   | `FIREBASE_SERVICE_ACCOUNT` | the service-account JSON from step 0.4 (paste as one line) |
   | `ADMIN_EMAILS` | comma-separated admin emails (or set the `admin:true` claim instead) |
   | `ALLOWED_EMAIL_DOMAINS` | e.g. `bcalife.co.id` — restricts who may sign in (empty = any) |
   | `CORS_ORIGINS` | your Vercel URL (e.g. `https://bima.vercel.app`) — comma-separated if multiple |

4. **Networking** tab → **Generate Domain**. Note the URL (e.g. `https://bima-backend.up.railway.app`).
5. Smoke test: open `https://<your-backend>/docs` — should show FastAPI Swagger UI.

### Seeding the initial dataset

Firestore starts empty. After the backend and frontend are live:

1. Open the frontend at `https://<your-vercel-url>/admin`.
2. Sign in with an account listed in `ADMIN_EMAILS` (or carrying the `admin:true` claim).
3. Drag & drop the PDFs from `dataset/` into the upload area.

## 2. Frontend — Vercel

The frontend is a Next.js app in `frontend/`. It proxies `/api/*` calls to the backend via the env var `BACKEND_URL` (see [frontend/app/api/[...path]/route.ts](frontend/app/api/[...path]/route.ts)).

### Steps

1. In the Vercel dashboard, open your project → **Settings**.
2. **General** → **Root Directory** → set to `frontend`.
3. **Environment Variables** → add:

   | Variable | Value |
   |---|---|
   | `BACKEND_URL` | the Railway URL from step 1.4 (no trailing slash) |
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

- **CORS error in browser console:** make sure `CORS_ORIGINS` on Railway includes the exact Vercel URL (with `https://`, no trailing slash).
- **Backend cold start is slow:** Railway free tier sleeps after inactivity. The first request after sleep can take 10–30s. Upgrade to a paid plan or use a keep-alive ping if this matters.
- **Uploaded PDFs disappear after redeploy:** the Railway volume wasn't mounted at `/app/data`. Check the volume mount path in service settings.
