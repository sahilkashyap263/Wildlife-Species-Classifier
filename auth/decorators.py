from functools import wraps
from flask import session, redirect, url_for, request, jsonify


def login_required(f):
    """Redirect to /login if the user is not in session."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """Block non-admins. Returns 403 JSON for API routes, redirect for page routes."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("auth.login"))
        if session.get("role") != "admin":
            if request.accept_mimetypes.best == "application/json" \
                    or request.path.startswith("/logs"):
                return jsonify({"error": "Admin access required."}), 403
            return redirect(url_for("main.index"))
        return f(*args, **kwargs)
    return decorated