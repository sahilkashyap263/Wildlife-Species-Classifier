# db.py  —  unified database connection
# Uses Supabase (PostgreSQL) on Cloud Run, SQLite locally
import os
import sqlite3

DATABASE_URL = os.environ.get("DATABASE_URL")

def get_connection():
    """Return a DB connection — PostgreSQL if DATABASE_URL is set, else SQLite."""
    if DATABASE_URL:
        import psycopg2
        import psycopg2.extras
        conn = psycopg2.connect(DATABASE_URL)
        conn.cursor_factory = psycopg2.extras.RealDictCursor
        return conn
    else:
        from config import Config
        conn = sqlite3.connect(Config.DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

def is_postgres():
    return DATABASE_URL is not None

def placeholder(n=1):
    """
    Returns the right SQL placeholder.
    PostgreSQL uses %s, SQLite uses ?
    """
    if is_postgres():
        return ",".join(["%s"] * n)
    return ",".join(["?"] * n)

def ph():
    """Single placeholder shorthand."""
    return "%s" if is_postgres() else "?"