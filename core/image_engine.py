"""
image_engine.py  —  WLDS-9 Real CNN Image Inference
----------------------------------------------------
Trained on 35 classes (scientific names), same label set as audio_engine.
Preprocessing mirrors the notebook exactly:
    PIL load → resize to (224, 224) → /255.0 → expand_dims → predict

Model artefacts (relative to project root):
    models/AnimalImages.keras          ← Keras SavedModel folder
    models/labels.json                 ← sorted list of 35 scientific names

Returns the 10 visual features expected by the rest of the pipeline:
    habitat_zone, activity_level, size_class, body_coverage,
    time_of_day, and image_confidence.

Called by inference.py as:
    image_result = image_engine.run(image_path)
"""

import os
import numpy as np

# ── Paths ─────────────────────────────────────────────────────────────────────
_BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_MODEL_PATH  = os.path.join(_BASE_DIR, "models", "AnimalImages.keras")
_LABELS_PATH = os.path.join(_BASE_DIR, "models", "labels.json")

# ── Lazy-loaded globals ───────────────────────────────────────────────────────
_model       = None
_label_names = None

# ── Input config (must match training exactly) ────────────────────────────────
TARGET_SIZE = (224, 224)

# ── Scientific name → Common name + Type (shared with audio_engine) ───────────
SPECIES_MAP = {
    "Anthus rubescens":          ("American Pipit",           "Bird"),
    "Anura":                     ("Frog",                     "Amphibian"),
    "Bos Taurus":                ("Cow",                      "Mammal"),
    "Canis Lupus":               ("Wolf / Dog",               "Mammal"),
    "Cardinalis cardinalis":     ("Northern Cardinal",        "Bird"),
    "Carduelis carduelis":       ("European Goldfinch",       "Bird"),
    "Cercopithecidae":           ("Monkey",                   "Mammal"),
    "Coccyzus erythropthalmus":  ("Black-billed Cuckoo",      "Bird"),
    "Contopus sordidulus":       ("Pacific-slope Flycatcher", "Bird"),
    "Corvus ossifragus":         ("Fish Crow",                "Bird"),
    "Dolichonyx oryzivorus":     ("Bobolink",                 "Bird"),
    "Dumetella carolinensis":    ("Gray Catbird",             "Bird"),
    "Elephas Maximus":           ("Asian Elephant",           "Mammal"),
    "Equus Asinus":              ("Donkey",                   "Mammal"),
    "Equus Caballus":            ("Horse",                    "Mammal"),
    "Euphagus carolinus":        ("Rusty Blackbird",          "Bird"),
    "Euphagus cyanocephalus":    ("Brewer's Blackbird",       "Bird"),
    "Felis Catus":               ("Cat",                      "Mammal"),
    "Gallus Gallus Domesticus":  ("Chicken",                  "Bird"),
    "Haemorhous purpureus":      ("Purple Finch",             "Bird"),
    "Icteria virens":            ("Yellow-breasted Chat",     "Bird"),
    "Icterus spurius":           ("Orchard Oriole",           "Bird"),
    "Larus californicus":        ("California Gull",          "Bird"),
    "Leucosticte tephrocotis":   ("Gray-crowned Rosy-Finch", "Bird"),
    "Myiarchus crinitus":        ("Great Crested Flycatcher", "Bird"),
    "Ovis Aries":                ("Sheep",                    "Mammal"),
    "Panthera Leo":              ("Lion",                     "Mammal"),
    "Passer domesticus":         ("House Sparrow",            "Bird"),
    "Passerina ciris":           ("Painted Bunting",          "Bird"),
    "Passerina cyanea":          ("Indigo Bunting",           "Bird"),
    "Pipilo erythrophthalmus":   ("Eastern Towhee",           "Bird"),
    "Riparia riparia":           ("Bank Swallow",             "Bird"),
    "Seiurus aurocapilla":       ("Ovenbird",                 "Bird"),
    "Selasphorus rufus":         ("Rufous Hummingbird",       "Bird"),
    "Ursidae":                   ("Bear",                     "Mammal"),
}

# ── Visual metadata derived from species classification ───────────────────────
# Used to populate habitat_zone, activity_level, size_class for the UI.
_VISUAL_META = {
    "Anthus rubescens":          ("Open Habitat",    "Diurnal",            "Small"),
    "Anura":                     ("Wetland",         "Nocturnal",          "Small"),
    "Bos Taurus":                ("Grassland",       "Diurnal",            "Large"),
    "Canis Lupus":               ("Forest/Urban",    "Diurnal/Nocturnal",  "Medium"),
    "Cardinalis cardinalis":     ("Woodland Edge",   "Diurnal",            "Small"),
    "Carduelis carduelis":       ("Open Woodland",   "Diurnal",            "Small"),
    "Cercopithecidae":           ("Tropical Forest", "Diurnal",            "Medium"),
    "Coccyzus erythropthalmus":  ("Deciduous Forest","Diurnal",            "Small"),
    "Contopus sordidulus":       ("Moist Forest",    "Diurnal",            "Small"),
    "Corvus ossifragus":         ("Coastal/Urban",   "Diurnal",            "Small"),
    "Dolichonyx oryzivorus":     ("Grassland",       "Diurnal",            "Small"),
    "Dumetella carolinensis":    ("Dense Shrub",     "Diurnal",            "Small"),
    "Elephas Maximus":           ("Tropical Forest", "Diurnal/Nocturnal",  "Apex"),
    "Equus Asinus":              ("Arid Region",     "Diurnal",            "Medium"),
    "Equus Caballus":            ("Grassland",       "Diurnal",            "Large"),
    "Euphagus carolinus":        ("Boreal Wetland",  "Diurnal",            "Small"),
    "Euphagus cyanocephalus":    ("Open Area/Urban", "Diurnal",            "Small"),
    "Felis Catus":               ("Urban/Forest",    "Crepuscular",        "Small"),
    "Gallus Gallus Domesticus":  ("Farmland",        "Diurnal",            "Small"),
    "Haemorhous purpureus":      ("Conifer Forest",  "Diurnal",            "Small"),
    "Icteria virens":            ("Dense Thicket",   "Diurnal",            "Small"),
    "Icterus spurius":           ("Open Woodland",   "Diurnal",            "Small"),
    "Larus californicus":        ("Coastal/Farmland","Diurnal",            "Medium"),
    "Leucosticte tephrocotis":   ("Alpine Zone",     "Diurnal",            "Small"),
    "Myiarchus crinitus":        ("Deciduous Forest","Diurnal",            "Small"),
    "Ovis Aries":                ("Grassland/Mountain","Diurnal",          "Medium"),
    "Panthera Leo":              ("Savanna",         "Crepuscular",        "Apex"),
    "Passer domesticus":         ("Urban/Farmland",  "Diurnal",            "Small"),
    "Passerina ciris":           ("Dense Brush",     "Diurnal",            "Small"),
    "Passerina cyanea":          ("Open Woodland",   "Diurnal",            "Small"),
    "Pipilo erythrophthalmus":   ("Dense Undergrowth","Diurnal",           "Small"),
    "Riparia riparia":           ("Riverbank",       "Diurnal",            "Small"),
    "Seiurus aurocapilla":       ("Mature Forest",   "Diurnal",            "Small"),
    "Selasphorus rufus":         ("Mountain Meadow", "Diurnal",            "Small"),
    "Ursidae":                   ("Forest/Mountain", "Diurnal/Crepuscular","Large"),
}


# ─────────────────────────────────────────────────────────────────────────────
# Build model architecture (mirrors notebook's build_model exactly)
# ─────────────────────────────────────────────────────────────────────────────

def _build_model(num_classes: int = 35):
    from tensorflow.keras import layers, models
    model = models.Sequential([
        layers.Input(shape=(224, 224, 3)),

        layers.Conv2D(32, (3, 3), activation="relu", padding="same"),
        layers.MaxPooling2D((2, 2)),
        layers.BatchNormalization(),
        layers.Dropout(0.2),

        layers.Conv2D(64, (3, 3), activation="relu", padding="same"),
        layers.MaxPooling2D((2, 2)),
        layers.BatchNormalization(),
        layers.Dropout(0.2),

        layers.Conv2D(128, (3, 3), activation="relu", padding="same"),
        layers.MaxPooling2D((2, 2)),
        layers.BatchNormalization(),
        layers.Dropout(0.4),

        layers.Conv2D(128, (3, 3), activation="relu", padding="same"),
        layers.MaxPooling2D((2, 2)),
        layers.BatchNormalization(),
        layers.Dropout(0.4),

        layers.Conv2D(256, (3, 3), activation="relu", padding="same"),
        layers.MaxPooling2D((2, 2)),
        layers.BatchNormalization(),
        layers.Dropout(0.4),

        layers.Flatten(),
        layers.Dense(256, activation="relu"),
        layers.Dropout(0.4),
        layers.Dense(num_classes, activation="softmax"),
    ])
    return model


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _load_model():
    """Load model + labels once; cache in module globals."""
    global _model, _label_names

    if _model is not None:
        return

    import json as _json

    if not os.path.exists(_LABELS_PATH):
        raise FileNotFoundError(
            f"[image_engine] labels.json not found at {_LABELS_PATH}"
        )
    with open(_LABELS_PATH, "r") as f:
        _label_names = _json.load(f)

    weights_path = os.path.join(_MODEL_PATH, "model.weights.h5")
    if not os.path.exists(weights_path):
        raise FileNotFoundError(
            f"[image_engine] Weights not found at {weights_path}"
        )

    _model = _build_model(num_classes=len(_label_names))
    _model.load_weights(weights_path)

    print(f"[image_engine] Model loaded  →  {len(_label_names)} classes")


def _preprocess(image_path: str) -> np.ndarray:
    """
    Load and preprocess image exactly as done during training:
        PIL load → resize (224, 224) → /255.0 → expand_dims
    """
    from tensorflow.keras.preprocessing import image as keras_image

    img       = keras_image.load_img(image_path, target_size=TARGET_SIZE)
    img_array = keras_image.img_to_array(img) / 255.0
    return np.expand_dims(img_array, axis=0).astype(np.float32)


def _estimate_body_coverage(image_path: str) -> float:
    """
    Estimate what percentage of the frame the subject occupies.

    Uses a simple luminance-based foreground mask as a lightweight proxy.
    Returns a value in [0, 100].
    """
    try:
        from PIL import Image as PILImage
        img   = PILImage.open(image_path).convert("L").resize((64, 64))
        arr   = np.array(img, dtype=np.float32) / 255.0
        mean  = arr.mean()
        mask  = np.abs(arr - mean) > 0.15
        coverage = float(mask.mean() * 100)
        return round(min(coverage * 1.8, 95.0), 1)
    except Exception:
        return 50.0


# ─────────────────────────────────────────────────────────────────────────────
# Public API  —  run() is called by inference.py
# ─────────────────────────────────────────────────────────────────────────────

def run(image_path: str) -> dict:
    """
    Called by inference.py as: image_engine.run(image_path)

    Loads and preprocesses the image, runs CNN inference, and returns
    structured results including visual metadata for the UI.

    Returns
    -------
    dict with:
        species          – common name
        scientific_name  – scientific name
        type             – Mammal / Bird / Amphibian / Unknown
        confidence       – CNN softmax confidence (0–1)
        image_confidence – same as confidence (alias for fusion_engine)
        habitat_zone     – derived habitat string
        activity_level   – derived activity pattern
        size_class       – Small / Medium / Large / Apex
        body_coverage    – estimated % of frame occupied by subject
        time_of_day      – always "N/A" (no temporal info from still image)
        features         – dict for fusion_engine / distance_engine
        raw_scores       – per-class softmax vector
    """
    _load_model()

    if not image_path or not os.path.exists(image_path):
        raise ValueError(f"[image_engine] Image file not found: {image_path}")

    tensor     = _preprocess(image_path)
    scores     = _model.predict(tensor, verbose=0)[0]

    predicted_idx = int(np.argmax(scores))
    confidence    = float(scores[predicted_idx])
    scientific    = _label_names[predicted_idx]

    common_name, animal_type = SPECIES_MAP.get(scientific, (scientific, "Unknown"))
    habitat, activity, size  = _VISUAL_META.get(scientific, ("—", "—", "—"))

    body_coverage = _estimate_body_coverage(image_path)

    features = {
        "confidence":      round(confidence, 4),
        "scientific_name": scientific,
        "body_coverage":   body_coverage,
        "raw_scores":      [round(float(s), 4) for s in scores],
    }

    print(
        f"[image_engine] {common_name} ({scientific}) | "
        f"conf={confidence:.4f} | coverage={body_coverage}%"
    )

    return {
        "species":          common_name,
        "scientific_name":  scientific,
        "type":             animal_type,
        "confidence":       round(confidence, 4),
        "image_confidence": round(confidence, 4),
        "habitat_zone":     habitat,
        "activity_level":   activity,
        "size_class":       size,
        "body_coverage":    body_coverage,
        "time_of_day":      "N/A",
        "features":         features,
        "raw_scores":       [round(float(s), 4) for s in scores],
    }