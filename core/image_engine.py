"""
WLDS-9 Image Engine
Processes image input → extracts CNN features → predicts species.

DUMMY MODE: Returns realistic synthetic predictions.
Replace predict_species() internals with real MobileNet/ResNet inference in Stage 2.

Image-specific fields (replace distance which requires acoustic data):
  - habitat_zone   : inferred biome from species + visual context
  - activity_level : ACTIVE / RESTING / FORAGING / ALERT
  - size_class     : SMALL / MEDIUM / LARGE / APEX
  - body_coverage  : estimated % of frame the animal occupies
  - time_of_day    : DAY / DUSK / NIGHT (from brightness)
"""

import random

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

# ── Species metadata maps ─────────────────────────────────────────────────────

HABITAT_MAP = {
    "Indian Peacock":          "Deciduous Forest",
    "Indian Sparrow":          "Urban / Grassland",
    "Common Myna":             "Urban / Scrubland",
    "Rose-ringed Parakeet":    "Woodland / Urban",
    "Asian Koel":              "Dense Canopy Forest",
    "Black Drongo":            "Open Farmland",
    "Red-vented Bulbul":       "Scrubland / Garden",
    "Oriental Magpie-Robin":   "Riverside Forest",
    "Barn Swallow":            "Open Wetland",
    "White-throated Kingfisher":"Riverine / Wetland",
    "Jungle Babbler":          "Dry Deciduous Forest",
    "Common Tailorbird":       "Dense Shrubland",
    "Purple Sunbird":          "Flowering Woodland",
    "Indian Robin":            "Rocky Scrubland",
    "Shikra":                  "Light Forest / Urban",
    "Indian Roller":           "Open Woodland",
    "Pied Kingfisher":         "Freshwater Wetland",
    "Greater Coucal":          "Dense Undergrowth",
    "Spotted Owlet":           "Urban / Open Forest",
    "Common Hoopoe":           "Open Grassland",
    "Indian Fox":              "Arid Scrubland",
    "Bengal Tiger":            "Dense Tiger Reserve",
    "Indian Leopard":          "Mixed Forest / Hills",
    "Sloth Bear":              "Dry Deciduous Forest",
    "Golden Jackal":           "Open Scrubland",
    "Striped Hyena":           "Arid / Semi-arid Zone",
    "Indian Wild Boar":        "Riverine Forest",
    "Chital Deer":             "Grassland / Forest Edge",
    "Sambar Deer":             "Dense Moist Forest",
    "Indian Mongoose":         "Scrubland / Farmland",
}

SIZE_MAP = {
    "Bengal Tiger": "APEX", "Indian Leopard": "APEX", "Sloth Bear": "LARGE",
    "Sambar Deer": "LARGE", "Indian Wild Boar": "LARGE", "Chital Deer": "MEDIUM",
    "Striped Hyena": "MEDIUM", "Golden Jackal": "MEDIUM", "Indian Fox": "MEDIUM",
    "Indian Mongoose": "SMALL", "Indian Peacock": "LARGE", "Shikra": "SMALL",
    "White-throated Kingfisher": "SMALL", "Pied Kingfisher": "SMALL",
}

ACTIVITY_LEVELS = ["ACTIVE", "RESTING", "FORAGING", "ALERT"]


def preprocess_image(image_path: str) -> dict:
    """
    Load image and extract features.
    DUMMY: Returns synthetic CNN embedding metadata.
    REAL: PIL → resize 224×224 → normalize → MobileNet embedding → 1280-dim vector.
    """
    brightness = round(random.uniform(40, 220), 1)
    features = {
        "width": 224,
        "height": 224,
        "embedding_dim": 1280,
        "embedding_sample": [round(random.uniform(-1, 1), 4) for _ in range(8)],
        "brightness": brightness,
        "has_motion_blur": random.choice([True, False]),
        "edge_density": round(random.uniform(0.1, 0.9), 3),
        "body_coverage_pct": round(random.uniform(5, 75), 1),
    }
    return features


def predict_species(features: dict) -> dict:
    """
    Run species classification on image features.
    DUMMY: Weighted random from species pool.
    REAL: Load image_model.pt → softmax over species classes → top-1 label + confidence.
    """
    if random.random() < 0.65:
        species = random.choice(BIRD_SPECIES)
        stype = "BIRD"
    else:
        species = random.choice(MAMMAL_SPECIES)
        stype = "MAMMAL"

    confidence = round(random.uniform(*CONFIDENCE_RANGE), 4)

    # ── Derive visual metadata from species + image features ──────────────────
    brightness = features.get("brightness", 128)
    if brightness > 160:
        time_of_day = "DAY"
    elif brightness > 80:
        time_of_day = "DUSK"
    else:
        time_of_day = "NIGHT"

    habitat_zone   = HABITAT_MAP.get(species, "Mixed Wilderness")
    size_class     = SIZE_MAP.get(species, "SMALL" if stype == "BIRD" else "MEDIUM")
    activity_level = random.choice(ACTIVITY_LEVELS)
    body_coverage  = features.get("body_coverage_pct", round(random.uniform(5, 75), 1))

    return {
        "species":        species,
        "type":           stype,
        "confidence":     confidence,
        "habitat_zone":   habitat_zone,
        "activity_level": activity_level,
        "size_class":     size_class,
        "body_coverage":  body_coverage,
        "time_of_day":    time_of_day,
        "features":       features
    }


def run(image_path: str = None) -> dict:
    features = preprocess_image(image_path)
    result   = predict_species(features)
    return result