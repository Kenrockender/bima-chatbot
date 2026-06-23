FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Curated seed corpus (per-insurer .txt). Baked into the image so the backend
# auto-seeds Firestore on first start with no volume mount (Railway-friendly).
COPY seed ./seed

ENV PYTHONUNBUFFERED=1
ENV SEED_DIR=/app/seed
EXPOSE 8000

# Bind to $PORT when the host provides one (Render/Railway inject it); fall back
# to 8000 for local `docker run`. Shell form so the variable is expanded.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
