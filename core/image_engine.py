"""
WLDS-9 Image Engine
Processes image input → extracts CNN features → predicts species.

DUMMY MODE: Returns realistic synthetic predictions.
Replace predict_species() internals with real MobileNet/ResNet inference in Stage 2.
"""

import os
import random

# ── Same species pool as audio engine ────────────────────────────────────────
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

CONFIDENCE_RANGE = (0.75, 0.98)


def preprocess_image(image_path: str) -> dict:
    """
    Load image and extract features.
    DUMMY: Returns synthetic CNN embedding metadata.
    REAL: PIL → resize 224×224 → normalize → MobileNet embedding → 1280-dim vector.
    """
    features = {
        "width": 224,
        "height": 224,
        "embedding_dim": 1280,
        "embedding_sample": [round(random.uniform(-1, 1), 4) for _ in range(8)],  # truncated
        "brightness": round(random.uniform(80, 200), 1),
        "has_motion_blur": random.choice([True, False])
    }
    return features


def predict_species(features: dict) -> dict:
    """
    Run species classification on image features.
    DUMMY: Weighted random from species pool.
    REAL: Load image_model.pt → softmax over species classes → top-1 label + confidence.
    """
    # Bias 65% toward birds (visible during daylight)
    if random.random() < 0.65:
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


def run(image_path: str = None) -> dict:
    """
    Full image inference pipeline.
    image_path: path to uploaded image file (None in dummy mode).
    """
    features = preprocess_image(image_path)
    result = predict_species(features)
    return result