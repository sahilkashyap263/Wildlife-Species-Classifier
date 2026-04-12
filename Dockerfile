# ── Base image ────────────────────────────────────────────────────────────────
FROM python:3.11-slim

# ── System dependencies (required by librosa & soundfile) ─────────────────────
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# ── Working directory ─────────────────────────────────────────────────────────
WORKDIR /app

# ── Python dependencies (cached layer) ───────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Copy project files ────────────────────────────────────────────────────────
COPY . .

# ── Create uploads directory ──────────────────────────────────────────────────
RUN mkdir -p static/uploads

# ── Cloud Run injects PORT at runtime ────────────────────────────────────────
ENV PORT=8080
EXPOSE 8080

# ── Start with gunicorn ───────────────────────────────────────────────────────
CMD ["gunicorn", "--bind", "0:8080", "--workers", "1", "--timeout", "120", "app:create_app()"]
