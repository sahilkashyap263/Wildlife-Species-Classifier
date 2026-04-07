"""
WLDS-9 Core Inference Engine
Orchestrates audio, image, distance, and fusion engines.

CLI usage:
    python core/inference.py --mode audio  --audio path/to/file.wav
    python core/inference.py --mode image  --image path/to/file.jpg
    python core/inference.py --mode fusion --audio path/to/file.wav --image path/to/file.jpg

Flask usage:
    from core.inference import run_pipeline
    result = run_pipeline(mode="fusion", audio_path=..., image_path=...)
"""

import sys
import json
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core import audio_engine, image_engine, distance_engine, fusion_engine, logger


def run_pipeline(mode: str, audio_path: str = None, image_path: str = None,
                 user_id: int = None, logged_by: str = None) -> dict:
    """
    Main inference entry point.

    Args:
        mode       : 'audio' | 'image' | 'fusion'
        audio_path : path to audio file (required for audio/fusion)
        image_path : path to image file (required for image/fusion)

    Returns:
        Structured result dict — always includes 'mode'.
    """
    inputs_log = {"mode": mode, "audio_path": audio_path, "image_path": image_path}

    try:
        if mode == "audio":
            result = _run_audio(audio_path)
        elif mode == "image":
            result = _run_image(image_path)
        elif mode == "fusion":
            result = _run_fusion(audio_path, image_path)
        else:
            result = {"error": f"Unknown mode: {mode}"}

        result["mode"] = mode
        logger.log_run(mode=mode, inputs=inputs_log, result=result,
                       user_id=user_id, logged_by=logged_by)
        return result

    except Exception as e:
        logger.log_error(mode=mode, error=str(e), user_id=user_id, logged_by=logged_by)
        return {"error": str(e), "mode": mode}


def _run_audio(audio_path: str) -> dict:
    audio_result   = audio_engine.run(audio_path)
    audio_features = audio_result.get("features", {})
    dist_result    = distance_engine.estimate(audio_features=audio_features)

    return {
        "species":         audio_result["species"],
        "type":            audio_result["type"],
        "confidence":      audio_result["confidence"],
        "audio_confidence":audio_result["audio_confidence"],
        "distance":        dist_result["distance"],
        "distance_label":  dist_result["distance_label"],
        "distance_method": dist_result["method"],
    }


def _run_image(image_path: str) -> dict:
    image_result = image_engine.run(image_path)

    return {
        "species":         image_result["species"],
        "type":            image_result["type"],
        "confidence":      image_result["confidence"],
        "image_confidence":image_result["image_confidence"],
        "habitat_zone":    image_result.get("habitat_zone",   "—"),
        "activity_level":  image_result.get("activity_level", "—"),
        "size_class":      image_result.get("size_class",     "—"),
        "body_coverage":   image_result.get("body_coverage",  0),
        "time_of_day":     image_result.get("time_of_day",    "N/A"),
    }


def _run_fusion(audio_path: str, image_path: str) -> dict:
    audio_result   = audio_engine.run(audio_path)
    image_result   = image_engine.run(image_path)
    audio_features = audio_result.get("features", {})
    image_features = image_result.get("features", {})

    dist_result = distance_engine.estimate(
        audio_features=audio_features,
        image_features=image_features,
    )

    return fusion_engine.run(audio_result, image_result, dist_result)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="WLDS-9 CLI Inference Test")
    parser.add_argument("--mode",  choices=["audio", "image", "fusion"], default="fusion")
    parser.add_argument("--audio", default=None)
    parser.add_argument("--image", default=None)
    args = parser.parse_args()

    print(f"\n{'='*50}")
    print(f"  WLDS-9 — Mode: {args.mode.upper()}")
    print(f"{'='*50}\n")

    result = run_pipeline(mode=args.mode, audio_path=args.audio, image_path=args.image)

    print(json.dumps(result, indent=2))
    print(f"\n{'='*50}")
    print(f"  Species  : {result.get('species', 'N/A')}")
    print(f"  Type     : {result.get('type', 'N/A')}")
    print(f"  Conf     : {result.get('confidence', 0) * 100:.1f}%")
    if args.mode != "image":
        print(f"  Distance : {result.get('distance', 'N/A')}  [{result.get('distance_label', '')}]")
    else:
        print(f"  Coverage : {result.get('body_coverage', 0)}%")
    print(f"{'='*50}\n")