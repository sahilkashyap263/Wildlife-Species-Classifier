"""
WLDS-9 Logger — SQLite Backend
All inference runs and errors are stored in wlds9.db

DB location: project/wlds9.db
Tables: detection_logs, users
"""

import json
import sqlite3
import os
from datetime import datetime

DB_PATH = os.environ.get(
    'WLDS9_DB',
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'wlds9.db')
)
DB_PATH = os.path.abspath(DB_PATH)


def _get_conn() -> sqlite3.Connection:
    """Open a connection and ensure the table exists."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS detection_logs (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp       TEXT    NOT NULL,
            mode            TEXT    NOT NULL,
            species         TEXT,
            confidence      REAL,
            distance        REAL,
            type            TEXT,
            agreement       INTEGER,
            audio_path      TEXT,
            image_path      TEXT,
            full_result     TEXT    NOT NULL,
            is_error        INTEGER DEFAULT 0,
            error_msg       TEXT,
            user_id         INTEGER,
            logged_by       TEXT
        )
    """)
    conn.commit()
    return conn


def log_run(mode: str, inputs: dict, result: dict,
            user_id: int = None, logged_by: str = None) -> dict:
    """Persist an inference run to SQLite."""
    timestamp = datetime.utcnow().isoformat()

    conn = _get_conn()
    conn.execute("""
        INSERT INTO detection_logs
            (timestamp, mode, species, confidence, distance, type,
             agreement, audio_path, image_path, full_result, is_error,
             user_id, logged_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    """, (
        timestamp,
        mode,
        result.get("species"),
        result.get("confidence"),
        result.get("distance"),
        result.get("type"),
        1 if result.get("agreement") is True else (0 if result.get("agreement") is False else None),
        inputs.get("audio_path"),
        inputs.get("image_path"),
        json.dumps(result),
        user_id,
        logged_by,
    ))
    conn.commit()
    conn.close()

    print(f"[WLDS-9 DB] Logged → {mode.upper()} | {result.get('species')} | {timestamp} | user={logged_by}")
    return {"timestamp": timestamp, "mode": mode, "inputs": inputs, "result": result}


def log_error(mode: str, error: str,
              user_id: int = None, logged_by: str = None) -> dict:
    """Persist an error entry to SQLite."""
    timestamp = datetime.utcnow().isoformat()

    conn = _get_conn()
    conn.execute("""
        INSERT INTO detection_logs
            (timestamp, mode, full_result, is_error, error_msg, user_id, logged_by)
        VALUES (?, ?, ?, 1, ?, ?, ?)
    """, (timestamp, mode, json.dumps({"error": error}), error, user_id, logged_by))
    conn.commit()
    conn.close()

    print(f"[WLDS-9 DB ERROR] {mode} | {error} | user={logged_by}")
    return {"timestamp": timestamp, "mode": mode, "error": error}


def fetch_logs(limit: int = 50, mode: str = None,
               errors_only: bool = False,
               user_id: int = None,
               is_admin: bool = False) -> list:
    """
    Query logs from SQLite.

    - is_admin=True  → returns ALL users' logs
    - is_admin=False → returns only logs where user_id matches
    """
    conn = _get_conn()

    query = "SELECT * FROM detection_logs WHERE 1=1"
    params = []

    # Role-based filtering
    # Include rows with NULL user_id (old data before auth was added) for backward compat
    if not is_admin and user_id is not None:
        query += " AND (user_id = ? OR user_id IS NULL)"
        params.append(user_id)

    if mode:
        query += " AND mode = ?"
        params.append(mode)

    if errors_only:
        query += " AND is_error = 1"
    else:
        query += " AND is_error = 0"

    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)

    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def fetch_stats(user_id: int = None, is_admin: bool = False) -> dict:
    """Return aggregate stats — scoped to user unless admin."""
    conn = _get_conn()

    where = ""
    params_stats = []
    params_species = []

    if not is_admin and user_id is not None:
        where = "WHERE user_id = ?"
        params_stats = [user_id]
        params_species = [user_id]

    stats = conn.execute(f"""
        SELECT
            COUNT(*)                               AS total_scans,
            COUNT(CASE WHEN is_error=0 THEN 1 END) AS successful_scans,
            COUNT(CASE WHEN is_error=1 THEN 1 END) AS error_count,
            AVG(CASE WHEN is_error=0 THEN confidence END) AS avg_confidence,
            AVG(CASE WHEN is_error=0 THEN distance END)   AS avg_distance,
            MAX(timestamp)                         AS last_scan
        FROM detection_logs {where}
    """, params_stats).fetchone()

    species_where = (where + " AND is_error=0 AND species IS NOT NULL") if where else "WHERE is_error=0 AND species IS NOT NULL"
    top_species = conn.execute(f"""
        SELECT species, COUNT(*) as count
        FROM detection_logs {species_where}
        GROUP BY species ORDER BY count DESC LIMIT 5
    """, params_species).fetchall()

    conn.close()
    return {**dict(stats), "top_species": [dict(r) for r in top_species]}
