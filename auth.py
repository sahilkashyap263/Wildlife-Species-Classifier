import sqlite3
import hashlib
import os
from functools import wraps
from flask import session, redirect, url_for, flash, jsonify, request
from core.logger import DB_PATH


# ──────────────────────────────────────────────
# DB bootstrap
# ──────────────────────────────────────────────

def init_users_table():
    """Create the users table and seed the default admin if needed."""
    conn = sqlite3.connect(DB_PATH)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT    NOT NULL UNIQUE,
            email    TEXT    NOT NULL UNIQUE,
            password TEXT    NOT NULL,
            role     TEXT    NOT NULL DEFAULT 'user',
            created  TEXT    DEFAULT (datetime('now'))
        )
    """)

    # Add 'user_id' column to detection_logs if it doesn't exist yet
    # (safe to run on existing DBs — will silently fail if already present)
    try:
        conn.execute("ALTER TABLE detection_logs ADD COLUMN user_id INTEGER REFERENCES users(id)")
    except Exception:
        pass  # column already exists

    # Add 'username_snapshot' so we can show "logged by X" even if user is deleted
    try:
        conn.execute("ALTER TABLE detection_logs ADD COLUMN logged_by TEXT")
    except Exception:
        pass

    conn.commit()

    # ── Seed default admin account ──
    existing = conn.execute("SELECT id FROM users WHERE role='admin' LIMIT 1").fetchone()
    if not existing:
        hashed, salt = _hash_password("admin123")
        stored = f"{salt}:{hashed}"
        try:
            conn.execute(
                "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)",
                ("admin", "admin@wlds9.local", stored, "admin"),
            )
            conn.commit()
            print("[WLDS-9 Auth] Default admin created  →  username: admin  |  password: admin123")
            print("[WLDS-9 Auth] ⚠️  Change the admin password after first login!")
        except sqlite3.IntegrityError:
            pass  # already exists under a different seeding run

    conn.close()


# ──────────────────────────────────────────────
# Password helpers  (SHA-256 + random salt)
# ──────────────────────────────────────────────

def _hash_password(password: str, salt: str = None):
    if salt is None:
        salt = os.urandom(16).hex()
    hashed = hashlib.sha256((salt + password).encode()).hexdigest()
    return hashed, salt


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt, expected_hash = stored.split(":", 1)
    except ValueError:
        return False
    actual_hash, _ = _hash_password(password, salt)
    return actual_hash == expected_hash


# ──────────────────────────────────────────────
# Register / Login
# ──────────────────────────────────────────────

def register_user(username: str, email: str, password: str) -> dict:
    if not username or not email or not password:
        return {"ok": False, "error": "All fields are required."}
    if len(password) < 6:
        return {"ok": False, "error": "Password must be at least 6 characters."}

    hashed, salt = _hash_password(password)
    stored = f"{salt}:{hashed}"

    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'user')",
            (username.strip(), email.strip().lower(), stored),
        )
        conn.commit()
        conn.close()
        return {"ok": True}
    except sqlite3.IntegrityError as e:
        if "username" in str(e):
            return {"ok": False, "error": "Username already taken."}
        if "email" in str(e):
            return {"ok": False, "error": "Email already registered."}
        return {"ok": False, "error": "Registration failed."}


def login_user(username_or_email: str, password: str) -> dict:
    if not username_or_email or not password:
        return {"ok": False, "error": "Please fill in all fields."}

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT * FROM users WHERE username = ? OR email = ?",
        (username_or_email.strip(), username_or_email.strip().lower()),
    ).fetchone()
    conn.close()

    if row is None:
        return {"ok": False, "error": "Invalid username / email or password."}
    if not _verify_password(password, row["password"]):
        return {"ok": False, "error": "Invalid username / email or password."}

    return {"ok": True, "user": dict(row)}


# ──────────────────────────────────────────────
# Get all users (admin panel helper)
# ──────────────────────────────────────────────

def get_all_users() -> list:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT id, username, email, role, created FROM users ORDER BY id"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ──────────────────────────────────────────────
# Route protection decorators
# ──────────────────────────────────────────────

def login_required(f):
    """Redirect to /login if the user is not in session."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """Block non-admins. Returns 403 JSON for API routes, redirect for page routes."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("login"))
        if session.get("role") != "admin":
            if request.accept_mimetypes.best == "application/json" or request.path.startswith("/logs"):
                return jsonify({"error": "Admin access required."}), 403
            return redirect(url_for("index"))
        return f(*args, **kwargs)
    return decorated
