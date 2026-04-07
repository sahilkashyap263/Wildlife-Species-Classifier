"""
fusion_engine.py  —  WLDS-9 Multi-Modal Fusion Engine
------------------------------------------------------
Combines outputs from audio_engine, image_engine, and distance_engine
into a single weighted result.

Strategy
--------
1.  Agreement check  — do both modalities predict the same species?
2.  Weighted fusion  — image confidence weighted slightly higher than audio
    (visual features are generally more discriminative for still subjects).
3.  Confidence penalty  — applied when modalities disagree, rewarding
    consistent multi-modal predictions.
4.  Distance passthrough  — distance result from distance_engine is attached
    directly (audio-derived, optionally blended with image body_coverage).

Called by inference.py as:
    result = fusion_engine.run(audio_result, image_result, dist_result)
"""

import numpy as np


# ── Fusion weights ─────────────────────────────────────────────────────────────
# Image features tend to be more discriminative for still subjects;
# audio is better for partially-visible or distant animals.
_WEIGHT_AUDIO = 0.42
_WEIGHT_IMAGE = 0.58

# Confidence multiplier applied when the two modalities disagree on species.
_DISAGREEMENT_PENALTY = 0.72


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _weighted_confidence(audio_conf: float, image_conf: float) -> float:
    """Return a single fused confidence score (0–1)."""
    fused = _WEIGHT_AUDIO * audio_conf + _WEIGHT_IMAGE * image_conf
    return round(float(np.clip(fused, 0.0, 1.0)), 4)


def _pick_winner(audio_result: dict, image_result: dict,
                 fused_conf: float) -> tuple[str, str, bool]:
    """
    Decide which species to report and whether the two modalities agree.

    Returns
    -------
    (species, animal_type, agreement)
        agreement = True  → both predicted the same species (case-insensitive)
        agreement = False → conflict; highest-confidence modality wins,
                            but fused_conf is penalised downstream.
    """
    audio_species = (audio_result.get("species") or "").strip()
    image_species = (image_result.get("species") or "").strip()

    agree = audio_species.lower() == image_species.lower()

    if agree:
        # Both agree — use image result (slightly higher weight)
        return image_species, image_result.get("type", "Unknown"), True

    # Conflict — pick the modality with higher confidence
    audio_conf = float(audio_result.get("confidence", 0))
    image_conf = float(image_result.get("confidence", 0))

    if image_conf >= audio_conf:
        return image_species, image_result.get("type", "Unknown"), False
    else:
        return audio_species, audio_result.get("type", "Unknown"), False


# ─────────────────────────────────────────────────────────────────────────────
# Public API  —  run() is called by inference.py
# ─────────────────────────────────────────────────────────────────────────────

def run(audio_result: dict, image_result: dict, dist_result: dict) -> dict:
    """
    Fuse audio, image, and distance results into a single prediction.

    Parameters
    ----------
    audio_result : dict   — output of audio_engine.run()
    image_result : dict   — output of image_engine.run()
    dist_result  : dict   — output of distance_engine.estimate()

    Returns
    -------
    dict with keys consumed by inference.py / the Flask routes / the UI:
        species           – winning common name
        type              – Mammal / Bird / Amphibian / Unknown
        confidence        – fused confidence (penalised on disagreement)
        audio_confidence  – raw audio CNN confidence
        image_confidence  – raw image CNN confidence
        distance          – range string, e.g. "10–30 meters"
        distance_label    – "Near" | "Medium" | "Far"
        distance_method   – "gbr_audio" | "gbr_audio+image"
        audio_species     – species predicted by audio modality (for UI modal)
        image_species     – species predicted by image modality (for UI modal)
        agreement         – True | False
        habitat_zone      – from image_engine (if available)
        activity_level    – from image_engine (if available)
        size_class        – from image_engine (if available)
        body_coverage     – from image_engine (for UI frame-coverage card)
        time_of_day       – from image_engine
    """
    audio_conf = float(audio_result.get("confidence", 0))
    image_conf = float(image_result.get("confidence", 0))

    # ── 1. Weighted confidence ─────────────────────────────────────────────
    fused_conf = _weighted_confidence(audio_conf, image_conf)

    # ── 2. Species selection & agreement check ─────────────────────────────
    species, animal_type, agreement = _pick_winner(
        audio_result, image_result, fused_conf
    )

    # ── 3. Penalty on disagreement ─────────────────────────────────────────
    if not agreement:
        fused_conf = round(float(np.clip(fused_conf * _DISAGREEMENT_PENALTY, 0.0, 1.0)), 4)
        print(
            f"[fusion_engine] ⚠ Conflict — "
            f"audio={audio_result.get('species')} ({audio_conf:.3f}) vs "
            f"image={image_result.get('species')} ({image_conf:.3f}) — "
            f"winner={species}, penalised conf={fused_conf}"
        )
    else:
        print(
            f"[fusion_engine] ✔ Agreement — "
            f"{species} | fused_conf={fused_conf}"
        )

    # ── 4. Assemble final result ───────────────────────────────────────────
    return {
        # Core identification
        "species":          species,
        "type":             animal_type,
        "confidence":       fused_conf,

        # Per-modality confidences (shown in Model Confidence Breakdown)
        "audio_confidence": round(audio_conf, 4),
        "image_confidence": round(image_conf, 4),

        # Distance (passed through from distance_engine)
        "distance":         dist_result.get("distance",        "—"),
        "distance_label":   dist_result.get("distance_label",  "—"),
        "distance_method":  dist_result.get("method",          "gbr_audio"),

        # Modality detail (shown in History modal when mode == fusion)
        "audio_species":    audio_result.get("species", "—"),
        "image_species":    image_result.get("species", "—"),
        "agreement":        agreement,

        # Visual metadata from image_engine (used by ResultsHandler._updateSpeciesInfo)
        "habitat_zone":     image_result.get("habitat_zone",   "—"),
        "activity_level":   image_result.get("activity_level", "—"),
        "size_class":       image_result.get("size_class",     "—"),
        "body_coverage":    image_result.get("body_coverage",  0),
        "time_of_day":      image_result.get("time_of_day",    "N/A"),
    }