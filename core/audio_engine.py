"""
WLDS-9 Audio Engine
Processes audio input → extracts features → predicts species.

DUMMY MODE: Returns realistic synthetic predictions.
Replace predict_species() internals with real model inference in Stage 2.
"""

import os
import random

# ── Species pool (India-focused, 20 birds + 10 mammals) ──────────────────────
BIRD_SPECIES = [
    "Indian Peacock", "Indian Sparrow", "Common Myna", "Rose-ringed Parakeet",
    "Asian Koel", "Black Drongo", "Red-vented Bulbul", "Oriental Magpie-Robin",
    "Barn Swallow", "White-throated Kingfisher", "Jungle Babbler",
    "Common Tailorbird", "Purple Sunbird", "Indian Robin", "Shikra",
    "Indian Roller", "Pied Kingfisher", "Greater Coucal", "Spotted Owlet",
    "Common Hoopoe"
]

MAMMAL_SPECIES = [
    "Indian Fox", "Bengal Tiger", "Indian Leopard", "Sloth Bear",
    "Golden Jackal", "Striped Hyena", "Indian Wild Boar",
    "Chital Deer", "Sambar Deer", "Indian Mongoose"
]

# ── Confidence bands per species (realistic variance) ────────────────────────
CONFIDENCE_RANGE = (0.72, 0.97)


def preprocess_audio(audio_path: str) -> dict:
    """
    Load audio and extract features.
    DUMMY: Returns synthetic feature dict.
    REAL: Use librosa to compute mel-spectrogram, MFCC, RMS, spectral centroid.
    """
    features = {
        "rms": round(random.uniform(0.01, 0.25), 4),
        "spectral_centroid": round(random.uniform(1200, 8000), 2),
        "mfcc_mean": [round(random.uniform(-200, 200), 2) for _ in range(13)],
        "mel_shape": [128, 87],   # placeholder shape
        "duration_s": round(random.uniform(2.5, 5.0), 2)
    }
    return features


def predict_species(features: dict) -> dict:
    """
    Run species classification on extracted features.
    DUMMY: Weighted random from species pool.
    REAL: Load audio_model.pt → forward pass → argmax → map to species label.
    """
    # Bias 70% toward birds (audio is strongest for birds)
    if random.random() < 0.70:
        species = random.choice(BIRD_SPECIES)
        stype = "BIRD"
    else:
        species = random.choice(MAMMAL_SPECIES)
        stype = "MAMMAL"

    confidence = round(random.uniform(*CONFIDENCE_RANGE), 4)

    return {
        "species": species,
        "type": stype,
        "confidence": confidence,
        "features": features
    }


def run(audio_path: str = None) -> dict:
    """
    Full audio inference pipeline.
    audio_path: path to uploaded audio file (None in dummy mode).
    """
    features = preprocess_audio(audio_path)
    result = predict_species(features)
    return result