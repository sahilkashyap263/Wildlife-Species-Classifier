"""
WLDS-9 Fusion Engine
Combines audio, image, and distance results into a single high-confidence prediction.

Fusion Strategy:
  1. Species fusion  → confidence-weighted voting
  2. Distance fusion → weighted average D = (c1*d1 + c2*d2 + c3*d3) / (c1+c2+c3)
  3. Type fusion     → majority vote with confidence tiebreak
"""


def fuse_species(audio_result: dict, image_result: dict) -> tuple:
    """
    Fuse species prediction from two modalities.

    Returns: (species, type, fused_confidence)

    Rules:
      - If both agree → boost confidence by 10% (max 0.99)
      - If they disagree → pick the one with higher confidence, penalty -5%
    """
    a_species = audio_result.get("species", "UNKNOWN")
    a_conf = audio_result.get("confidence", 0.0)
    a_type = audio_result.get("type", "UNKNOWN")

    i_species = image_result.get("species", "UNKNOWN")
    i_conf = image_result.get("confidence", 0.0)
    i_type = image_result.get("type", "UNKNOWN")

    if a_species == i_species:
        # Agreement → high confidence
        fused_conf = min(0.99, (a_conf + i_conf) / 2 * 1.10)
        fused_species = a_species
        fused_type = a_type
        agreement = True
    else:
        # Disagreement → winner takes all with penalty
        if a_conf >= i_conf:
            fused_species = a_species
            fused_type = a_type
            fused_conf = round(a_conf * 0.95, 4)
        else:
            fused_species = i_species
            fused_type = i_type
            fused_conf = round(i_conf * 0.95, 4)
        agreement = False

    return fused_species, fused_type, round(fused_conf, 4), agreement


def fuse_distance(audio_result: dict, image_result: dict, dist_result: dict) -> float:
    """
    Weighted distance fusion:
      D_final = (c1*d1 + c2*d2 + c3*d3) / (c1 + c2 + c3)

    d1 = audio-derived distance (from distance engine, acoustic_only)
    d2 = image-derived distance (from distance engine, visual component)
    d3 = final fused distance from distance engine
    """
    d_dist = dist_result.get("distance", 25.0)
    c_dist = dist_result.get("confidence", 0.70)

    # Audio contributes a distance estimate via its confidence score
    c_audio = audio_result.get("confidence", 0.0)
    # Image contributes a distance estimate via its confidence score
    c_image = image_result.get("confidence", 0.0)

    # For dummy mode: use dist_result as ground truth, audio/image weight the blend
    d_audio = d_dist * 1.05   # slight variance
    d_image = d_dist * 0.95

    total_conf = c_audio + c_image + c_dist
    if total_conf == 0:
        return d_dist

    fused_d = (c_audio * d_audio + c_image * d_image + c_dist * d_dist) / total_conf
    return round(fused_d, 1)


def run(audio_result: dict, image_result: dict, dist_result: dict) -> dict:
    """
    Full fusion pipeline.

    Inputs:
        audio_result  → from audio_engine.run()
        image_result  → from image_engine.run()
        dist_result   → from distance_engine.estimate()

    Returns:
        Unified prediction dict
    """
    species, stype, confidence, agreement = fuse_species(audio_result, image_result)
    distance = fuse_distance(audio_result, image_result, dist_result)

    return {
        "species": species,
        "type": stype,
        "confidence": confidence,
        "distance": distance,
        "agreement": agreement,
        "audio_species": audio_result.get("species"),
        "image_species": image_result.get("species"),
        "audio_confidence": audio_result.get("confidence"),
        "image_confidence": image_result.get("confidence"),
        "distance_confidence": dist_result.get("confidence"),
        "distance_method": dist_result.get("method"),
        "mode": "fusion"
    }