import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class Config:
    # ── Security ──────────────────────────────────────────────────────────────
    SECRET_KEY         = os.environ.get("SECRET_KEY", "wlds9-change-me-in-production-abc123xyz")
    SESSION_PERMANENT  = False

    # ── Database ──────────────────────────────────────────────────────────────
    DB_PATH            = os.path.join(BASE_DIR, "wlds9.db")

    # ── Uploads ───────────────────────────────────────────────────────────────
    UPLOAD_FOLDER      = os.path.join(BASE_DIR, "static", "uploads")
    ALLOWED_AUDIO_EXT  = {".wav", ".mp3", ".m4a", ".webm", ".ogg"}
    ALLOWED_IMAGE_EXT  = {".jpg", ".jpeg", ".png", ".webp"}