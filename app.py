"""
WLDS-9 Flask API Layer
Routes only — no ML logic here.
All intelligence lives in core/inference.py
"""

import os
import uuid
import sqlite3
from flask import Flask, render_template, request, jsonify
from core.inference import run_pipeline
from core.logger import fetch_logs, fetch_stats, DB_PATH

app = Flask(__name__)

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def save_upload(file_obj, prefix="file"):
    if file_obj and file_obj.filename:
        ext = os.path.splitext(file_obj.filename)[1] or '.bin'
        filename = f"{prefix}_{uuid.uuid4().hex[:8]}{ext}"
        path = os.path.join(UPLOAD_FOLDER, filename)
        file_obj.save(path)
        return path
    return None


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/history")
def history():
    return render_template("history.html")


@app.route("/analyze/audio", methods=["POST"])
def analyze_audio():
    audio_path = save_upload(request.files.get("audio"), prefix="audio")
    result = run_pipeline(mode="audio", audio_path=audio_path)
    return jsonify(result)


@app.route("/analyze/image", methods=["POST"])
def analyze_image():
    image_path = save_upload(request.files.get("image"), prefix="image")
    result = run_pipeline(mode="image", image_path=image_path)
    return jsonify(result)


@app.route("/analyze/fusion", methods=["POST"])
def analyze_fusion():
    audio_path = save_upload(request.files.get("audio"), prefix="audio")
    image_path = save_upload(request.files.get("image"), prefix="image")
    result = run_pipeline(mode="fusion", audio_path=audio_path, image_path=image_path)
    return jsonify(result)


@app.route("/logs", methods=["GET"])
def get_logs():
    limit       = int(request.args.get("limit", 50))
    mode        = request.args.get("mode", None)
    errors_only = request.args.get("errors", "0") == "1"
    return jsonify(fetch_logs(limit=limit, mode=mode, errors_only=errors_only))


@app.route("/logs/stats", methods=["GET"])
def get_stats():
    return jsonify(fetch_stats())


@app.route("/logs/clear", methods=["POST"])
def clear_logs():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM detection_logs")
    conn.commit()
    deleted = conn.execute("SELECT changes()").fetchone()[0]
    conn.close()
    return jsonify({"cleared": True, "rows_deleted": deleted})


if __name__ == "__main__":
    print("=" * 50)
    print("  WLDS-9 Server Starting")
    print("  Open: http://127.0.0.1:5000")
    print(f"  DB:   {DB_PATH}")
    print(f"  DB exists: {os.path.exists(DB_PATH)}")
    print("=" * 50)
    app.run(debug=True)