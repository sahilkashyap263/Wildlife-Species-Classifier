"""
WLDS-9 Logger — SQLite Backend
All inference runs and errors are stored in wlds9.db
No more scattered JSON files in /logs.

DB location: project/wlds9.db
Table: detection_logs
"""

import json
import sqlite3
import os
from datetime import datetime

# DB_PATH is always the folder containing this logger.py's parent (the project root).
# os.path.abspath + __file__ makes this work from ANY working directory.
# You can also override with env var: export WLDS9_DB=/custom/path/wlds9.db
DB_PATH = os.environ.get(
    'WLDS9_DB',
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'wlds9.db')
)
DB_PATH = os.path.abspath(DB_PATH)


def _get_conn() -> sqlite3.Connection:
    """Open a connection and ensure the table exists."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row   # allows dict-like row access
    conn.execute("""
        CREATE TABLE IF NOT EXISTS detection_logs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp   TEXT    NOT NULL,
            mode        TEXT    NOT NULL,
            species     TEXT,
            confidence  REAL,
            distance    REAL,
            type        TEXT,
            agreement   INTEGER,              -- 1/0/NULL for fusion mode
            audio_path  TEXT,
            image_path  TEXT,
            full_result TEXT    NOT NULL,     -- full JSON blob
            is_error    INTEGER DEFAULT 0,
            error_msg   TEXT
        )
    """)
    conn.commit()
    return conn


def log_run(mode: str, inputs: dict, result: dict) -> dict:
    """
    Persist an inference run to SQLite.
    Returns the entry dict (same contract as before).
    """
    timestamp = datetime.utcnow().isoformat()

    conn = _get_conn()
    conn.execute("""
        INSERT INTO detection_logs
            (timestamp, mode, species, confidence, distance, type,
             agreement, audio_path, image_path, full_result, is_error)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
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
        json.dumps(result)
    ))
    conn.commit()
    conn.close()

    print(f"[WLDS-9 DB] Logged → {mode.upper()} | {result.get('species')} | {timestamp}")

    return {
        "timestamp": timestamp,
        "mode": mode,
        "inputs": inputs,
        "result": result
    }


def log_error(mode: str, error: str) -> dict:
    """Persist an error entry to SQLite."""
    timestamp = datetime.utcnow().isoformat()

    conn = _get_conn()
    conn.execute("""
        INSERT INTO detection_logs
            (timestamp, mode, full_result, is_error, error_msg)
        VALUES (?, ?, ?, 1, ?)
    """, (
        timestamp,
        mode,
        json.dumps({"error": error}),
        error
    ))
    conn.commit()
    conn.close()

    print(f"[WLDS-9 DB ERROR] {mode} | {error}")
    return {"timestamp": timestamp, "mode": mode, "error": error}


def fetch_logs(limit: int = 50, mode: str = None, errors_only: bool = False) -> list:
    """
    Query logs from SQLite.

    Args:
        limit      : max rows to return (default 50, newest first)
        mode       : filter by 'audio' | 'image' | 'fusion' (optional)
        errors_only: if True, return only error rows
    """
    conn = _get_conn()

    query = "SELECT * FROM detection_logs WHERE 1=1"
    params = []

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


def fetch_stats() -> dict:
    """Return aggregate stats for the dashboard."""
    conn = _get_conn()

    stats = conn.execute("""
        SELECT
            COUNT(*)                            AS total_scans,
            COUNT(CASE WHEN is_error=0 THEN 1 END) AS successful_scans,
            COUNT(CASE WHEN is_error=1 THEN 1 END) AS error_count,
            AVG(CASE WHEN is_error=0 THEN confidence END) AS avg_confidence,
            AVG(CASE WHEN is_error=0 THEN distance END)   AS avg_distance,
            MAX(timestamp)                      AS last_scan
        FROM detection_logs
    """).fetchone()

    top_species = conn.execute("""
        SELECT species, COUNT(*) as count
        FROM detection_logs
        WHERE is_error = 0 AND species IS NOT NULL
        GROUP BY species
        ORDER BY count DESC
        LIMIT 5
    """).fetchall()

    conn.close()

    return {
        **dict(stats),
        "top_species": [dict(r) for r in top_species]
    }