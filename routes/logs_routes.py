import sqlite3
from flask import Blueprint, request, jsonify, session, current_app
from auth import login_required, admin_required
from core.logger import fetch_logs, fetch_stats

logs_bp = Blueprint("logs", __name__)


def _current_user() -> dict:
    return {
        "id":       session.get("user_id"),
        "is_admin": session.get("role") == "admin",
    }


@logs_bp.route("/logs", methods=["GET"])
@login_required
def get_logs():
    u        = _current_user()
    limit    = int(request.args.get("limit", 50))
    mode     = request.args.get("mode") or None
    errors   = request.args.get("errors", "0") == "1"
    filter_uid = request.args.get("filter_user") or None

    if u["is_admin"] and filter_uid and filter_uid != "all":
        logs = fetch_logs(
            limit=limit, mode=mode, errors_only=errors,
            user_id=int(filter_uid), is_admin=False,
        )
    else:
        logs = fetch_logs(
            limit=limit, mode=mode, errors_only=errors,
            user_id=u["id"], is_admin=u["is_admin"],
        )

    return jsonify(logs)


@logs_bp.route("/logs/stats", methods=["GET"])
@login_required
def get_stats():
    u = _current_user()
    return jsonify(fetch_stats(user_id=u["id"], is_admin=u["is_admin"]))


@logs_bp.route("/logs/clear", methods=["POST"])
@admin_required
def clear_logs():
    db_path = current_app.config["DB_PATH"]
    conn = sqlite3.connect(db_path)
    conn.execute("DELETE FROM detection_logs")
    conn.commit()
    deleted = conn.execute("SELECT changes()").fetchone()[0]
    conn.close()
    return jsonify({"cleared": True, "rows_deleted": deleted})