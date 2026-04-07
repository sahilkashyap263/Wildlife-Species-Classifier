import sqlite3
from flask import current_app
from .utils import hash_password, verify_password


def _get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(current_app.config["DB_PATH"])
    conn.row_factory = sqlite3.Row
    return conn


# ── Bootstrap ─────────────────────────────────────────────────────────────────

def init_users_table() -> None:
    """Create tables and seed the default admin account if needed."""
    import os
    from config import Config          # used before app context exists
    conn = sqlite3.connect(Config.DB_PATH)

    # Users table
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

    # Detection logs table — add columns safely if upgrading an existing DB
    conn.execute("""
        CREATE TABLE IF NOT EXISTS detection_logs (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp    TEXT    DEFAULT (datetime('now')),
            mode         TEXT,
            species      TEXT,
            type         TEXT,
            confidence   REAL,
            distance     REAL,
            agreement    INTEGER,
            is_error     INTEGER DEFAULT 0,
            error_msg    TEXT,
            full_result  TEXT,
            user_id      INTEGER REFERENCES users(id),
            logged_by    TEXT
        )
    """)

    for col, definition in [
        ("user_id",   "INTEGER REFERENCES users(id)"),
        ("logged_by", "TEXT"),
    ]:
        try:
            conn.execute(f"ALTER TABLE detection_logs ADD COLUMN {col} {definition}")
        except Exception:
            pass   # column already exists

    conn.commit()

    # Seed default admin
    existing = conn.execute(
        "SELECT id FROM users WHERE role='admin' LIMIT 1"
    ).fetchone()

    if not existing:
        hashed, salt = hash_password("admin123")
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
            pass

    conn.close()


# ── User CRUD ─────────────────────────────────────────────────────────────────

def register_user(username: str, email: str, password: str) -> dict:
    if not username or not email or not password:
        return {"ok": False, "error": "All fields are required."}
    if len(password) < 6:
        return {"ok": False, "error": "Password must be at least 6 characters."}

    hashed, salt = hash_password(password)
    stored = f"{salt}:{hashed}"

    try:
        conn = _get_db()
        conn.execute(
            "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'user')",
            (username.strip(), email.strip().lower(), stored),
        )
        conn.commit()
        conn.close()
        return {"ok": True}
    except sqlite3.IntegrityError as e:
        msg = str(e)
        if "username" in msg:
            return {"ok": False, "error": "Username already taken."}
        if "email" in msg:
            return {"ok": False, "error": "Email already registered."}
        return {"ok": False, "error": "Registration failed."}


def login_user(username_or_email: str, password: str) -> dict:
    if not username_or_email or not password:
        return {"ok": False, "error": "Please fill in all fields."}

    conn = _get_db()
    identifier = username_or_email.strip()
    row = conn.execute(
        "SELECT * FROM users WHERE username = ? OR email = ?",
        (identifier, identifier.lower()),
    ).fetchone()
    conn.close()

    if row is None or not verify_password(password, row["password"]):
        return {"ok": False, "error": "Invalid username / email or password."}

    return {"ok": True, "user": dict(row)}


def get_all_users() -> list:
    conn = _get_db()
    rows = conn.execute(
        "SELECT id, username, email, role, created FROM users ORDER BY id"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]