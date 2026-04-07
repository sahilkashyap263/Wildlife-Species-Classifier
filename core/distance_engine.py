"""
distance_engine.py  —  WLDS-9 Real ML Distance Estimation
-----------------------------------------------------------
GradientBoostingRegressor trained on:
  mel_mean, mel_std, mfcc_mean, mfcc_std,
  rms_mean, rms_std, rms_max, rms_min,
  spectral_centroid, zcr

Target: d2_log = log10( 10^((Db_1m - rms_mean) / 20) )
Buckets: Near / Medium / Far  (dynamic percentile thresholds)

Model artefacts (relative to project root):
  models/gbr_distance.pkl
  models/scaler_distance.pkl
  models/thresholds.pkl

Called by inference.py as:
    dist_result = distance_engine.estimate(audio_features=audio_features)
    dist_result = distance_engine.estimate(audio_features=audio_features,
                                           image_features=image_features)
"""

import os
import pickle
import numpy as np

# ── Paths ─────────────────────────────────────────────────────────────────────
_BASE_DIR      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_GBR_PATH      = os.path.join(_BASE_DIR, "models", "gbr_distance.pkl")
_SCALER_PATH   = os.path.join(_BASE_DIR, "models", "scaler_distance.pkl")
_THRESH_PATH   = os.path.join(_BASE_DIR, "models", "thresholds.pkl")

# ── Lazy-loaded globals ───────────────────────────────────────────────────────
_model      = None
_scaler     = None
_thresholds = None

# ── Distance Range Mapping ────────────────────────────────────────────────────
DISTANCE_MAP = {
    "Near":   "10–30 meters",
    "Medium": "31–60 meters",
    "Far":    "61–90 meters",
}


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _load_artefacts():
    """Load GBR model, scaler, and thresholds once; cache in module globals."""
    global _model, _scaler, _thresholds
    if _model is not None:
        return

    for path, label in [(_GBR_PATH, "GBR model"),
                         (_SCALER_PATH, "Scaler"),
                         (_THRESH_PATH, "Thresholds")]:
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"[distance_engine] {label} not found at {path}"
            )

    with open(_GBR_PATH,    "rb") as f: _model      = pickle.load(f)
    with open(_SCALER_PATH, "rb") as f: _scaler     = pickle.load(f)
    with open(_THRESH_PATH, "rb") as f: _thresholds = pickle.load(f)

    print("[distance_engine] Artefacts loaded ✓")


def _build_feature_vector(audio_features: dict) -> np.ndarray:
    """
    Build the 10-element feature vector that the GBR was trained on.

    Required keys in audio_features (all produced by audio_engine.run):
        mel_mean, mel_std, mfcc_mean, mfcc_std,
        rms_mean, rms_std, rms_max, rms_min,
        spectral_centroid, zcr
    """
    keys = [
        "mel_mean", "mel_std",
        "mfcc_mean", "mfcc_std",
        "rms_mean",  "rms_std", "rms_max", "rms_min",
        "spectral_centroid", "zcr",
    ]
    missing = [k for k in keys if k not in audio_features]
    if missing:
        raise ValueError(
            f"[distance_engine] Missing audio features: {missing}"
        )

    return np.array([[audio_features[k] for k in keys]], dtype=np.float32)


def _predict_distance(feature_vector: np.ndarray) -> dict:
    """Run the GBR and return distance label and confidence (score is internal only)."""
    near_thresh = _thresholds["near"]
    far_thresh  = _thresholds["far"]

    feat_sc      = _scaler.transform(feature_vector)
    y_pred_log   = _model.predict(feat_sc)[0]
    _score       = float(10 ** y_pred_log)   # internal only — never exposed

    # ── Label ──────────────────────────────────────────────────────────────
    if _score >= near_thresh:
        label = "Near"
    elif _score >= far_thresh:
        label = "Medium"
    else:
        label = "Far"

    # ── Confidence (logged internally, not shown in final output) ──────────
    dist_to_boundary = min(
        abs(_score - near_thresh),
        abs(_score - far_thresh)
    )
    confidence = dist_to_boundary / (near_thresh - far_thresh + 1e-6)
    confidence = float(np.clip(confidence, 0.05, 0.95))

    return {
        "label":      label,
        "confidence": round(confidence, 3),
        # _score intentionally excluded from return value
    }


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def estimate(audio_features: dict,
             image_features: dict = None) -> dict:
    """
    Estimate animal distance from audio (and optional image) features.

    Parameters
    ----------
    audio_features : dict
        Feature dict produced by audio_engine.run() → result["features"].
        Must contain the 10 acoustic keys the GBR was trained on.
    image_features : dict, optional
        Feature dict from image_engine.run() → result["features"].
        Currently used only to extract body_coverage for a lightweight
        blended confidence; the core prediction is audio-only.

    Returns
    -------
    dict with keys:
        distance          – human-readable range string, e.g. "10–30 meters"
        distance_label    – "Near" | "Medium" | "Far"
        method            – "gbr_audio" | "gbr_audio+image"

    Note: Raw numeric score and confidence are kept internal (logs only).
    """
    _load_artefacts()

    feature_vector = _build_feature_vector(audio_features)
    result         = _predict_distance(feature_vector)

    method = "gbr_audio"

    # ── Optional image blend ───────────────────────────────────────────────
    # body_coverage boosts confidence internally; does not affect distance_label.
    if image_features:
        body_coverage = image_features.get("body_coverage", 0.0)
        if isinstance(body_coverage, (int, float)) and body_coverage > 0:
            blend_factor = float(np.clip(body_coverage / 100.0, 0.0, 1.0))
            blended_conf = result["confidence"] + blend_factor * (0.95 - result["confidence"]) * 0.25
            result["confidence"] = round(float(np.clip(blended_conf, 0.05, 0.95)), 3)
            method = "gbr_audio+image"

    # ── Log internally (for debugging/monitoring only) ─────────────────────
    print(
        f"[distance_engine] label={result['label']} | "
        f"confidence={result['confidence']} | method={method}"
    )

    # ── Map label → human-readable range ──────────────────────────────────
    distance_range = DISTANCE_MAP[result["label"]]

    return {
        "distance":       distance_range,
        "distance_label": result["label"],
        "method":         method,
    }