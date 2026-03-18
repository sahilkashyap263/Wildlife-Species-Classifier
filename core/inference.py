"""
WLDS-9 Core Inference Engine
The "device brain" — orchestrates all engines and returns structured JSON.

Usage (CLI test):
    python core/inference.py --mode audio
    python core/inference.py --mode image
    python core/inference.py --mode fusion

Flask calls:
    from core.inference import run_pipeline
    result = run_pipeline(mode='fusion', audio_path=..., image_path=...)
"""

import sys
import json
import os

# Add project root to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core import audio_engine, image_engine, distance_engine, fusion_engine, logger


def run_pipeline(mode: str, audio_path: str = None, image_path: str = None) -> dict:
    """
    Main inference entry point.

    Args:
        mode        : 'audio' | 'image' | 'fusion'
        audio_path  : path to audio file (optional)
        image_path  : path to image file (optional)

    Returns:
        Structured result dict with species, confidence, distance, mode, etc.
    """

    inputs_log = {"mode": mode, "audio_path": audio_path, "image_path": image_path}

    try:
        if mode == 'audio':
            result = _run_audio(audio_path)

        elif mode == 'image':
            result = _run_image(image_path)

        elif mode == 'fusion':
            result = _run_fusion(audio_path, image_path)

        else:
            result = {"error": f"Unknown mode: {mode}"}

        # Ensure mode is always in result
        result["mode"] = mode

        # Log the run
        logger.log_run(mode=mode, inputs=inputs_log, result=result)
        return result

    except Exception as e:
        err = logger.log_error(mode=mode, error=str(e))
        return {"error": str(e), "mode": mode}


# ── Private pipeline runners ──────────────────────────────────────────────────

def _run_audio(audio_path: str) -> dict:
    """Audio-only pipeline."""
    audio_result = audio_engine.run(audio_path)
    audio_features = audio_result.get("features", {})

    dist_result = distance_engine.estimate(audio_features=audio_features)

    return {
        "species": audio_result["species"],
        "type": audio_result["type"],
        "confidence": audio_result["confidence"],
        "distance": dist_result["distance"],
        "distance_confidence": dist_result["confidence"],
        "distance_method": dist_result["method"]
    }


def _run_image(image_path: str) -> dict:
    """Image-only pipeline — returns visual metadata instead of distance."""
    image_result = image_engine.run(image_path)

    return {
        "species":        image_result["species"],
        "type":           image_result["type"],
        "confidence":     image_result["confidence"],
        "habitat_zone":   image_result.get("habitat_zone", "—"),
        "activity_level": image_result.get("activity_level", "—"),
        "size_class":     image_result.get("size_class", "—"),
        "body_coverage":  image_result.get("body_coverage", 0),
        "time_of_day":    image_result.get("time_of_day", "—"),
    }


def _run_fusion(audio_path: str, image_path: str) -> dict:
    """Full fusion pipeline: audio + image + distance."""
    audio_result = audio_engine.run(audio_path)
    image_result = image_engine.run(image_path)

    audio_features = audio_result.get("features", {})
    image_features = image_result.get("features", {})

    dist_result = distance_engine.estimate(
        audio_features=audio_features,
        image_features=image_features
    )

    fused = fusion_engine.run(audio_result, image_result, dist_result)
    return fused


# ── CLI Test Entrypoint ───────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="WLDS-9 CLI Inference Test")
    parser.add_argument("--mode", choices=["audio", "image", "fusion"], default="fusion")
    parser.add_argument("--audio", default=None, help="Path to audio file")
    parser.add_argument("--image", default=None, help="Path to image file")
    args = parser.parse_args()

    print(f"\n{'='*50}")
    print(f"  WLDS-9 Inference — Mode: {args.mode.upper()}")
    print(f"{'='*50}\n")

    result = run_pipeline(mode=args.mode, audio_path=args.audio, image_path=args.image)

    print(json.dumps(result, indent=2))
    print(f"\n{'='*50}")
    print(f"  Species   : {result.get('species', 'N/A')}")
    print(f"  Type      : {result.get('type', 'N/A')}")
    print(f"  Confidence: {result.get('confidence', 0) * 100:.1f}%")
    print(f"  Distance  : {result.get('distance', 'N/A')} m")
    print(f"{'='*50}\n")