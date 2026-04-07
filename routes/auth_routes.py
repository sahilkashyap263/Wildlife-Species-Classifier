from flask import (
    Blueprint, render_template, request,
    session, redirect, url_for, flash
)
from auth import register_user, login_user

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if "user_id" in session:
        return redirect(url_for("main.index"))

    if request.method == "POST":
        result = login_user(
            request.form.get("identifier", ""),
            request.form.get("password", ""),
        )
        if result["ok"]:
            u = result["user"]
            session["user_id"]      = u["id"]
            session["username"]     = u["username"]
            session["role"]         = u["role"]
            session["show_welcome"] = True
            return redirect(url_for("main.index"))
        flash(result["error"], "danger")

    return render_template("auth.html", mode="login")


@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if "user_id" in session:
        return redirect(url_for("main.index"))

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
            return redirect(url_for("main.landing"))

        flash(result["error"], "danger")
        return redirect(url_for("main.landing") + "?tab=register")

    return render_template("auth.html", mode="register")


@auth_bp.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("main.landing"))