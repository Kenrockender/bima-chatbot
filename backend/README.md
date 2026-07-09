---
title: Sera Backend
emoji: 🛡️
colorFrom: blue
colorTo: green
sdk: docker
app_port: 8000
pinned: false
---

# Sera Backend (FastAPI)

This folder doubles as a **Hugging Face Space** (Docker SDK) so the backend can be
hosted free, with no credit card. The metadata block above is what HF reads:
`sdk: docker` builds the `Dockerfile`, and `app_port: 8000` tells HF the app
listens on 8000 (matching the Dockerfile's `--port ${PORT:-8000}` fallback).

The same image runs anywhere a Dockerfile runs — see [`../DEPLOY.md`](../DEPLOY.md)
for the full deploy guide (Hugging Face Spaces is the primary, card-free path).

Set secrets in the Space **Settings → Variables and secrets**, not in `.env`
(which is gitignored and never pushed).
