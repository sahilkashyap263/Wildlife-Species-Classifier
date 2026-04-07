import os
import uuid
from flask import Blueprint, request, jsonify, session, current_app
from auth import login_required
from core.inference import run_pipeline

analyze_bp = Blueprint("analyze", __name__)


def _current_user() -> dict:
    return {
        "id":       session.get("user_id"),
        "username": session.get("username"),
    }


def _save_upload(file_obj, prefix: str = "file") -> str | None:
    """Save an uploaded file with a UUID filename. Returns the saved path or None."""
    if not (file_obj and file_obj.filename):
        return None

    ext = os.path.splitext(file_obj.filename)[1].lower() or ".bin"
    filename = f"{prefix}_{uuid.uuid4().hex[:8]}{ext}"
    path = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
    file_obj.save(path)
    return path


@analyze_bp.route("/analyze/audio", methods=["POST"])
@login_required
def analyze_audio():
    u = _current_user()
    audio_path = _save_upload(request.files.get("audio"), prefix="audio")
    result = run_pipeline(
        mode="audio",
        audio_path=audio_path,
        user_id=u["id"],
        logged_by=u["username"],
    )
    return jsonify(result)


@analyze_bp.route("/analyze/image", methods=["POST"])
@login_required
def analyze_image():
    u = _current_user()
    image_path = _save_upload(request.files.get("image"), prefix="image")
    result = run_pipeline(
        mode="image",
        image_path=image_path,
        user_id=u["id"],
        logged_by=u["username"],
    )
    return jsonify(result)


@analyze_bp.route("/analyze/fusion", methods=["POST"])
@login_required
def analyze_fusion():
    u = _current_user()
    audio_path = _save_upload(request.files.get("audio"), prefix="audio")
    image_path = _save_upload(request.files.get("image"), prefix="image")
    result = run_pipeline(
        mode="fusion",
        audio_path=audio_path,
        image_path=image_path,
        user_id=u["id"],
        logged_by=u["username"],
    )
    return jsonify(result)