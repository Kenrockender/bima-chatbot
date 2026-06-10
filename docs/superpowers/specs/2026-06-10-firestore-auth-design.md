# Firestore + Firebase Auth — Design

**Date:** 2026-06-10
**Status:** Approved (Phase 1 scope)

## Goal

Move BIMA's training scores off the per-device SQLite store and into Firestore,
keyed by an authenticated user, and add Google Sign-In so a trainee's progress
follows their account across devices. Admin access (PDF management) moves to the
same Firebase identity via a role claim / email allow-list, retiring the shared
`X-Admin-Password`.

## Scope

**In (Phase 1):**
- Google Sign-In for trainees (FAs) and admins, via Firebase Authentication.
- Backend verification of Firebase ID tokens; `uid` replaces the anonymous `fa_id`.
- Admin authorization via Firebase custom claim `admin:true` **or** an email allow-list.
- Email-domain restriction (only configured domains, e.g. `bcalife.co.id`, may sign in).
- All persistent data moves from SQLite to Firestore: training `attempts` and PDF `sources`.
- Display the signed-in user's Google name/photo in the UI.

**Deferred (Phase 2 — separate spec):**
- Team leaderboard (rank FAs by XP/level).
- Manager dashboard (aggregate progress across all FAs).

**Out of scope:**
- Migrating existing anonymous SQLite attempts. That data is per-device and cannot
  be mapped to accounts, so we start fresh. The old `bima.db` is abandoned, not imported.

## Architecture — backend-mediated

The frontend uses Firebase **only for authentication**. It never reads or writes
Firestore directly. Every data operation goes through the FastAPI backend, which
holds the Firebase Admin SDK and is the sole Firestore client. This keeps the
scoring logic (XP, badges, streaks) server-side and authoritative, hides the data
model from the client, and lets us lock Firestore to deny all client access as
defense-in-depth.

```
Browser (Next.js / Vercel)
  └─ Firebase Auth (Google) → ID token
       │  Authorization: Bearer <token>
       ▼
API proxy (app/api/[...path]/route.ts)  ── forwards Authorization header
       ▼
FastAPI (Railway)
  ├─ firebase-admin: verify ID token → uid, email, claims
  └─ Firestore (Admin SDK): users/{uid}/attempts, sources/{id}
```

## Authentication flow

1. Unauthenticated browser shows a sign-in gate (Google button).
2. `signInWithPopup(googleProvider)` returns a Firebase user; the client gets an
   ID token via `user.getIdToken()` and stores nothing else.
3. Every API call attaches `Authorization: Bearer <idToken>`. The token is short-lived;
   the client refreshes it through the Firebase SDK automatically.
4. Backend dependency `get_current_user` verifies the token with
   `firebase_admin.auth.verify_id_token`, returning `{uid, email, name, picture}`.
   - It rejects tokens whose email domain is not in `ALLOWED_EMAIL_DOMAINS`.
5. Admin routes use `require_admin`, which allows the request when the token has
   custom claim `admin == true` **or** the email is in `ADMIN_EMAILS`.

## Firestore data model

- `sources/{sourceId}` — PDF/URL knowledge sources.
  Fields: `name`, `type` (`pdf|url`), `origin`, `status` (`processing|ready|failed`),
  `error`, `page_count`, `text` (extracted full text), `created_at`, `updated_at`.
  PDF text is small (≈100–150 KB), well under Firestore's 1 MiB document limit.
- `users/{uid}/attempts/{attemptId}` — one finished roleplay session.
  Fields mirror today's `attempts` columns: `persona_id`, `persona_name`, `drill_id`,
  `focus_dimension`, the five dimension scores, `overall_score`, `strengths`,
  `improvements`, `next_focus`, `transcript`, `turn_count`, `xp_earned`, `created_at`.
- `users/{uid}` — profile cache: `email`, `name`, `picture`, `last_seen`.

Progress (streaks, XP, level, badges) stays **derived on read** from the attempts
subcollection — no denormalized counters — exactly as `progress.py` does today.

## Backend changes

- **New `app/firebase.py`** — lazy singleton initializing `firebase-admin` from the
  `FIREBASE_SERVICE_ACCOUNT` env (JSON). Exposes `fs()` (Firestore client) and
  `verify_token(id_token)`.
- **`app/auth.py`** — add `get_current_user` (Bearer → user dict, with domain check)
  and rewrite `require_admin` to use claims/allow-list. Remove password header auth.
- **`app/config.py`** — add `firebase_service_account: str`, `admin_emails: str` (csv),
  `allowed_email_domains: str` (csv). Remove `sqlite_path`, `upload_dir`, `admin_password`.
- **`app/db.py`** — delete SQLite schema/connection; replaced by `firebase.fs()`.
- **`app/progress.py`** — rewrite reads/writes against `users/{uid}/attempts`.
  Public function signatures keep `fa_id` as the parameter name but it now carries `uid`.
- **`app/rag.py`** — the `_DOCS` in-memory cache loads from the `sources` collection at
  startup; `_store`/`delete_source` write through to Firestore. The "stuff all docs into
  the prompt" RAG behavior is unchanged.
- **`app/recommender.py`** — `list_ready_products` reads `sources` where `status == ready`.
- **Routes** — `routes_chat`, `routes_training`, `routes_recommender` swap the `X-FA-Id`
  input for `get_current_user`; `routes_admin` and the progress routes use the new
  `require_admin` / `get_current_user`.
- **`app/main.py`** — replace `init_db()` with Firebase init + initial `sources` cache load.
- **`requirements.txt`** — add `firebase-admin`.

## Frontend changes

- **`lib/firebase.ts`** — initialize the Firebase app + Auth from `NEXT_PUBLIC_FIREBASE_*`.
- **`hooks/useAuth.ts`** — expose `user`, `loading`, `signInWithGoogle()`, `signOut()`,
  and an `authedFetch()` helper that attaches the bearer token.
- **Login gate** — a client `AuthProvider` mounted in `app/layout.tsx` exposes auth state
  via context; a wrapper renders the Google sign-in screen while unauthenticated and the
  app (with the user's name/photo in the header) once signed in.
- **API calls** — route all `/api/*` fetches through `authedFetch`; drop `X-FA-Id`.
- **Admin page** — sign in with Google instead of the password prompt; non-admins get a
  "not authorized" message.
- **Proxy `route.ts`** — add `authorization` to the forwarded-header allow-list; remove
  `x-fa-id` and `x-admin-password`.

## Configuration / secrets

- **Frontend (public, `NEXT_PUBLIC_`):** `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`,
  `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID` (+ `MESSAGING_SENDER_ID`, `STORAGE_BUCKET`).
- **Backend (secret):** `FIREBASE_SERVICE_ACCOUNT` (service-account JSON), `ADMIN_EMAILS`
  (csv), `ALLOWED_EMAIL_DOMAINS` (csv, e.g. `bcalife.co.id`).
- Document all of these in `.env.example` and `DEPLOY.md` (Railway + Vercel sections).

## Error handling

- Missing/invalid/expired token → `401` from `get_current_user`; client redirects to sign-in.
- Authenticated but wrong domain → `403` with a clear message; client shows "use your
  company account".
- Non-admin hitting an admin route → `403`.
- Firestore unavailable → `503` with a logged cause; the chat LLM path degrades the same
  way the current `_fallback` does.
- Firebase Admin not configured (no service account) → backend fails fast at startup with
  an explicit error, mirroring today's missing-`OPENROUTER_API_KEY` behavior.

## Verification

- Backend: unit-level check that `get_current_user` rejects bad domains and that
  `require_admin` honors both the claim and the allow-list (token verification stubbed).
- End-to-end via the dev server + live backend: sign in with Google, finish a roleplay,
  confirm the attempt appears under `users/{uid}/attempts` and the progress page reflects
  it; sign in on a second browser with the same account and see the same progress.
- Admin: a whitelisted account can upload a PDF and see it reach `status: ready`; a
  non-admin account is refused.

## Rollout

1. Create the Firebase project, enable Google sign-in, generate a service account.
2. Set env vars on Railway (backend) and Vercel (frontend).
3. Deploy backend, then frontend. First sign-in seeds `users/{uid}`.
4. Re-upload the product PDFs through the admin page (knowledge base starts empty in
   Firestore).
