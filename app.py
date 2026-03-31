import os
import uuid
import sqlite3
import logging
from flask import (
    Flask, render_template, request, jsonify,
    session, redirect, url_for, flash
)
from core.inference import run_pipeline
from core.logger import fetch_logs, fetch_stats, DB_PATH
from auth import (
    init_users_table, register_user, login_user,
    login_required, admin_required, get_all_users
)

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "wlds9-change-me-in-production-abc123xyz")
app.config["SESSION_PERMANENT"] = False

# ── Suppress werkzeug request logs ───────────────────────────────────────────
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

init_users_table()


def save_upload(file_obj, prefix="file"):
    if file_obj and file_obj.filename:
        ext = os.path.splitext(file_obj.filename)[1] or '.bin'
        filename = f"{prefix}_{uuid.uuid4().hex[:8]}{ext}"
        path = os.path.join(UPLOAD_FOLDER, filename)
        file_obj.save(path)
        return path
    return None


def current_user():
    return {
        "id":       session.get("user_id"),
        "username": session.get("username"),
        "role":     session.get("role", "user"),
        "is_admin": session.get("role") == "admin",
    }


# ── Auth routes ───────────────────────────────────────────────────────────────

@app.route("/login", methods=["GET", "POST"])
def login():
    if "user_id" in session:
        return redirect(url_for("index"))
    if request.method == "POST":
        result = login_user(request.form.get("identifier", ""), request.form.get("password", ""))
        if result["ok"]:
            u = result["user"]
            session["user_id"]  = u["id"]
            session["username"] = u["username"]
            session["role"]     = u["role"]
            session["show_welcome"] = True
            return redirect(url_for("index"))
        flash(result["error"], "danger")
    return render_template("auth.html", mode="login")


@app.route("/register", methods=["GET", "POST"])
def register():
    if "user_id" in session:
        return redirect(url_for("index"))
    if request.method == "POST":
        pw  = request.form.get("password", "")
        cpw = request.form.get("confirm_password", "")
        if pw != cpw:
            flash("Passwords do not match.", "danger")
            return render_template("auth.html", mode="register")
        email = request.form.get("email", "").strip()
        auto_username = email.split("@")[0] if email else ""
        result = register_user(auto_username, email, pw)
        if result["ok"]:
            flash("Account created! You can now log in.", "success")
            return render_template("auth.html", mode="login")
        flash(result["error"], "danger")
        return render_template("auth.html", mode="register")
    return render_template("auth.html", mode="register")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ── Page routes ───────────────────────────────────────────────────────────────

@app.route("/")
@login_required
def index():
    u = current_user()
    show_welcome = session.pop("show_welcome", False)
    return render_template("index.html", username=u["username"], is_admin=u["is_admin"], show_welcome=show_welcome)


@app.route("/history")
@login_required
def history():
    u = current_user()
    users = get_all_users() if u["is_admin"] else []
    return render_template(
        "history.html",
        username=u["username"],
        is_admin=u["is_admin"],
        all_users=users,
    )


# ── Analysis API routes ───────────────────────────────────────────────────────

@app.route("/analyze/audio", methods=["POST"])
@login_required
def analyze_audio():
    u = current_user()
    audio_path = save_upload(request.files.get("audio"), prefix="audio")
    result = run_pipeline(mode="audio", audio_path=audio_path,
                          user_id=u["id"], logged_by=u["username"])
    return jsonify(result)


@app.route("/analyze/image", methods=["POST"])
@login_required
def analyze_image():
    u = current_user()
    image_path = save_upload(request.files.get("image"), prefix="image")
    result = run_pipeline(mode="image", image_path=image_path,
                          user_id=u["id"], logged_by=u["username"])
    return jsonify(result)


@app.route("/analyze/fusion", methods=["POST"])
@login_required
def analyze_fusion():
    u = current_user()
    audio_path = save_upload(request.files.get("audio"), prefix="audio")
    image_path = save_upload(request.files.get("image"), prefix="image")
    result = run_pipeline(mode="fusion", audio_path=audio_path, image_path=image_path,
                          user_id=u["id"], logged_by=u["username"])
    return jsonify(result)


# ── Logs API routes ───────────────────────────────────────────────────────────

@app.route("/logs", methods=["GET"])
@login_required
def get_logs():
    u        = current_user()
    limit    = int(request.args.get("limit", 50))
    mode     = request.args.get("mode", None)
    errors   = request.args.get("errors", "0") == "1"
    filter_uid = request.args.get("filter_user", None)
    if u["is_admin"] and filter_uid and filter_uid != "all":
        logs = fetch_logs(limit=limit, mode=mode, errors_only=errors,
                          user_id=int(filter_uid), is_admin=False)
    else:
        logs = fetch_logs(limit=limit, mode=mode, errors_only=errors,
                          user_id=u["id"], is_admin=u["is_admin"])
    return jsonify(logs)


@app.route("/logs/stats", methods=["GET"])
@login_required
def get_stats():
    u = current_user()
    return jsonify(fetch_stats(user_id=u["id"], is_admin=u["is_admin"]))


@app.route("/logs/clear", methods=["POST"])
@admin_required
def clear_logs():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM detection_logs")
    conn.commit()
    deleted = conn.execute("SELECT changes()").fetchone()[0]
    conn.close()
    return jsonify({"cleared": True, "rows_deleted": deleted})


if __name__ == "__main__":
    print("\n  WLDS-9 Online")
    print(f"  Scanner  →  http://127.0.0.1:5000")
    print(f"  History  →  http://127.0.0.1:5000/history")
    print("  Press CTRL+C to quit\n")
    app.run(debug=False)