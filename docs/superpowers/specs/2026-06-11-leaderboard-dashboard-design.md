# Leaderboard + Manager Dashboard — Design (Phase 2)

**Date:** 2026-06-11
**Status:** Implemented
**Builds on:** [2026-06-10-firestore-auth-design.md](2026-06-10-firestore-auth-design.md)

## Goal

Now that scores are centralized per-account in Firestore, surface two team views:
a **leaderboard** that ranks FAs by XP (motivation) and a **manager dashboard**
that aggregates progress across all FAs (coaching).

## Data approach — denormalized user summary

Reading every user's attempts to build these views would mean a collection-group
scan on each request. Instead, `progress.save_attempt` now maintains a
`users/{uid}` summary document after each finished session:

- `name`, `email`, `picture` (from the Google profile in the ID token)
- `total_sessions`, `total_xp`, `level`
- `averages` (per dimension), `last_overall`, `weakest_dimension`, `updated_at`

Both views read the single `users` collection — no per-attempt scanning. The
attempts subcollection remains the source of truth; the summary is derived and
refreshed on write, so it can always be rebuilt.

## Backend

- `progress._update_summary(uid, profile, stats)` — upsert the summary (merge).
- `progress.leaderboard(current_uid, limit=20)` — users with ≥1 session sorted by
  total XP; flags the caller's row and includes their entry even if outside the top N.
- `progress.team_overview()` — team averages per dimension, totals, weakest team
  dimension, and a per-member list.
- Routes: `GET /api/training/leaderboard` (any signed-in user) and
  `GET /api/admin/overview` (require_admin). The profile flows
  `/end → training.end_session → save_attempt` so the summary captures name/photo.

## Frontend

- `app/leaderboard/page.tsx` — ranked list with medals for the top 3, avatars,
  level/sessions, and XP; highlights the current user. Linked from the home header
  ("Peringkat" / "Leaderboard") and the progress page.
- `app/manager/page.tsx` — admin-gated (verifies via `/api/admin/overview`): KPI
  cards, per-dimension team averages, and a member table. Linked from the admin
  console header.

## Out of scope

- Time-windowed boards (weekly/monthly), badges on the leaderboard, CSV export,
  and per-member drill-down. Revisit if asked.
