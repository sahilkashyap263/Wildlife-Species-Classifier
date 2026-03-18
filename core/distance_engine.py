"""
WLDS-9 Distance Engine
Estimates distance to detected species using acoustic + simulated TDOA inputs.

DUMMY MODE: Returns synthetic distance estimates.
Replace estimate() internals with real regression model in Stage 2.

Formula reference (inverse square law approximation):
  D ≈ D_ref × 10^((L_ref - L_measured) / 20)
  Where D_ref = 1m, L_ref = baseline SPL, L_measured = RMS-derived SPL.
"""

import random
import math

# Distance confidence is typically lower than classification confidence
DISTANCE_CONFIDENCE_RANGE = (0.65, 0.82)

# Realistic distance range for wildlife in the wild (meters)
DISTANCE_RANGE_M = (3.0, 120.0)


def estimate_from_rms(rms: float) -> float:
    """
    Rough distance estimate from RMS loudness using inverse square law.
    DUMMY: Randomized physics-inspired estimate.
    REAL: distance_model.pt regression → input [rms, spectral_centroid, tdoa_sim] → distance.
    """
    # Simulated: louder signal = closer animal
    # RMS range ~0.01 (far) to 0.25 (close)
    # Map to ~3m (loud) to ~120m (quiet)
    if rms <= 0:
        return round(random.uniform(40, 80), 1)

    base = 1.0 / (rms + 0.001)
    distance = min(max(base * 2.5, DISTANCE_RANGE_M[0]), DISTANCE_RANGE_M[1])

    # Add realistic sensor noise
    noise = random.uniform(-3.0, 3.0)
    distance = round(distance + noise, 1)
    return max(DISTANCE_RANGE_M[0], distance)


def simulate_tdoa() -> float:
    """
    Simulated Time Difference Of Arrival (microseconds).
    REAL: Read from multi-mic hardware array.
    """
    return round(random.uniform(0.0, 850.0), 2)


def estimate(audio_features: dict = None, image_features: dict = None) -> dict:
    """
    Full distance estimation pipeline.

    Inputs:
        audio_features: dict from audio_engine.preprocess_audio()
        image_features: dict from image_engine.preprocess_image()

    Returns:
        {distance: float (meters), confidence: float, method: str}
    """
    # Use RMS from audio if available
    rms = 0.05  # default fallback
    if audio_features and "rms" in audio_features:
        rms = audio_features["rms"]

    tdoa = simulate_tdoa()
    distance_acoustic = estimate_from_rms(rms)

    # If image is also available, blend with a visual estimate (object size heuristic)
    if image_features:
        # Simulated visual distance: smaller apparent size → farther away
        visual_distance = round(random.uniform(10, 80), 1)
        # Weighted blend: acoustic 60%, visual 40%
        final_distance = round(0.6 * distance_acoustic + 0.4 * visual_distance, 1)
        method = "acoustic+visual"
    else:
        final_distance = distance_acoustic
        method = "acoustic_only"

    confidence = round(random.uniform(*DISTANCE_CONFIDENCE_RANGE), 4)

    return {
        "distance": final_distance,
        "confidence": confidence,
        "method": method,
        "tdoa_us": tdoa,
        "rms_used": rms
    }