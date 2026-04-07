from flask import Blueprint, render_template, session
from auth import login_required, get_all_users

main_bp = Blueprint("main", __name__)


def _current_user() -> dict:
    return {
        "id":       session.get("user_id"),
        "username": session.get("username"),
        "role":     session.get("role", "user"),
        "is_admin": session.get("role") == "admin",
    }


@main_bp.route("/")
def landing():
    """Public landing page — no login required."""
    return render_template("landing.html")


@main_bp.route("/scanner")
@login_required
def index():
    u = _current_user()
    show_welcome = session.pop("show_welcome", False)
    return render_template(
        "index.html",
        username=u["username"],
        is_admin=u["is_admin"],
        show_welcome=show_welcome,
    )


@main_bp.route("/history")
@login_required
def history():
    u = _current_user()
    users = get_all_users() if u["is_admin"] else []
    return render_template(
        "history.html",
        username=u["username"],
        is_admin=u["is_admin"],
        all_users=users,
    )