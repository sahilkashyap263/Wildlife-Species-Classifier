"""
audio_engine.py  —  WLDS-9 Real CNN Inference
----------------------------------------------
Trained on 35 classes (scientific names).
Preprocessing mirrors the notebook exactly:
  librosa.load @ 16kHz → melspectrogram (128 mels) → power_to_db
  → split into overlapping 128-frame chunks → average predictions

The `features` dict returned by run() now exposes all 10 acoustic
keys required by distance_engine:
    mel_mean, mel_std, mfcc_mean, mfcc_std,
    rms_mean, rms_std, rms_max, rms_min,
    spectral_centroid, zcr
"""

import os
import numpy as np

# ── Lazy-loaded globals (loaded once on first call) ───────────────────────────
_model       = None
_label_names = None

# ── Paths ─────────────────────────────────────────────────────────────────────
_BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_MODEL_PATH  = os.path.join(_BASE_DIR, "models", "AnimalSounds.keras")
_LABELS_PATH = os.path.join(_BASE_DIR, "models", "labels.json")

# ── Mel-spectrogram config (must match training exactly) ──────────────────────
TARGET_SR = 16000
N_MELS    = 128
MAX_LEN   = 128   # frames per chunk (~4 seconds at 16kHz)


# ─────────────────────────────────────────────────────────────────────────────
# Scientific name → Common name + Type mapping
# ─────────────────────────────────────────────────────────────────────────────
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


# ─────────────────────────────────────────────────────────────────────────────
# Build model architecture (mirrors notebook's build_model exactly)
# ─────────────────────────────────────────────────────────────────────────────

def _build_model(num_classes: int = 35):
    from tensorflow.keras import layers, models
    model = models.Sequential([
        layers.Input(shape=(128, 128, 1)),

        layers.Conv2D(32, (3, 3), activation='relu', padding='same'),
        layers.MaxPooling2D((2, 2)),
        layers.BatchNormalization(),

        layers.Conv2D(64, (3, 3), activation='relu', padding='same'),
        layers.MaxPooling2D((2, 2)),
        layers.BatchNormalization(),

        layers.Conv2D(128, (3, 3), activation='relu', padding='same'),
        layers.MaxPooling2D((2, 2)),
        layers.BatchNormalization(),

        layers.Conv2D(128, (3, 3), activation='relu', padding='same'),
        layers.MaxPooling2D((2, 2)),
        layers.BatchNormalization(),

        layers.Conv2D(256, (3, 3), activation='relu', padding='same'),
        layers.MaxPooling2D((2, 2)),
        layers.BatchNormalization(),

        layers.Flatten(),
        layers.Dense(256, activation='relu'),
        layers.Dropout(0.4),
        layers.Dense(num_classes, activation='softmax'),
    ])
    return model


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _load_model():
    """Load model + labels once; cache in module globals."""
    global _model, _label_names

    if _model is not None:
        return  # already loaded

    import json as _json

    # ── Load labels ──
    if not os.path.exists(_LABELS_PATH):
        raise FileNotFoundError(
            f"[audio_engine] labels.json not found at {_LABELS_PATH}"
        )
    with open(_LABELS_PATH, "r") as f:
        _label_names = _json.load(f)

    # ── Check model folder exists ──
    weights_path = os.path.join(_MODEL_PATH, "model.weights.h5")
    if not os.path.exists(weights_path):
        raise FileNotFoundError(
            f"[audio_engine] Weights not found at {weights_path}"
        )

    # ── Rebuild architecture and load weights ──
    _model = _build_model(num_classes=len(_label_names))
    _model.load_weights(weights_path)

    print(f"[audio_engine] Model loaded  →  {len(_label_names)} classes")


def _audio_to_chunks(file_path: str) -> list:
    """
    Load audio and split into overlapping 128-frame chunks (~4s each).
    Uses 50% overlap so a 15s recording gives ~14 chunks.
    Returns list of (128, 128) float32 arrays.
    """
    import librosa

    y, sr   = librosa.load(file_path, sr=TARGET_SR)
    spec    = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=N_MELS)
    spec_db = librosa.power_to_db(spec, ref=np.max)

    total_frames = spec_db.shape[1]
    chunks = []
    step   = MAX_LEN // 2   # 50% overlap = 64 frames

    if total_frames <= MAX_LEN:
        # Short audio — pad to MAX_LEN and return single chunk
        pad_width = MAX_LEN - total_frames
        chunk = np.pad(spec_db, ((0, 0), (0, pad_width)), mode="constant")
        chunks.append(chunk.astype(np.float32))
    else:
        # Slide window across full spectrogram
        start = 0
        while start + MAX_LEN <= total_frames:
            chunk = spec_db[:, start:start + MAX_LEN]
            chunks.append(chunk.astype(np.float32))
            start += step
        # Include final tail chunk if audio remains
        if start < total_frames:
            chunk = spec_db[:, -MAX_LEN:]
            chunks.append(chunk.astype(np.float32))

    print(f"[audio_engine] Audio split into {len(chunks)} chunks")
    return chunks


def _extract_acoustic_features(file_path: str) -> dict:
    """
    Extract the 10 acoustic features used by the real GBR distance model.

    Returns a dict with:
        mel_mean, mel_std, mfcc_mean, mfcc_std,
        rms_mean, rms_std, rms_max, rms_min,
        spectral_centroid, zcr
    """
    import librosa

    y, sr = librosa.load(file_path, sr=TARGET_SR)

    # Mel spectrogram (dB)
    mel_spec    = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=N_MELS)
    mel_spec_db = librosa.power_to_db(mel_spec)

    # MFCC
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)

    # RMS (normalised, then converted to dB — mirrors distance model notebook)
    rms_raw = librosa.feature.rms(y=y)[0]
    rms_norm = rms_raw / (np.max(rms_raw) + 1e-9)
    rms_db  = 20 * np.log10(rms_norm + 1e-6)

    # Spectral centroid & ZCR
    spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    zcr               = librosa.feature.zero_crossing_rate(y)[0]

    return {
        "mel_mean":          float(np.mean(mel_spec_db)),
        "mel_std":           float(np.std(mel_spec_db)),
        "mfcc_mean":         float(np.mean(mfcc)),
        "mfcc_std":          float(np.std(mfcc)),
        "rms_mean":          float(np.mean(rms_db)),
        "rms_std":           float(np.std(rms_db)),
        "rms_max":           float(np.max(rms_db)),
        "rms_min":           float(np.min(rms_db)),
        "spectral_centroid": float(np.mean(spectral_centroid)),
        "zcr":               float(np.mean(zcr)),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Public API  —  run() is called by inference.py
# ─────────────────────────────────────────────────────────────────────────────

def run(audio_path: str) -> dict:
    """
    Called by inference.py as: audio_engine.run(audio_path)

    Splits audio into overlapping 4s chunks, runs CNN inference on each,
    then averages the softmax scores for a more accurate prediction.

    Returns
    -------
    dict with:
        species          – common name
        scientific_name  – scientific name
        type             – Mammal / Bird / Amphibian / Unknown
        confidence       – CNN softmax confidence (0–1)
        audio_confidence – same as confidence (alias for fusion_engine)
        features         – 10-key dict for distance_engine (GBR model)
        raw_scores       – per-class softmax vector
    """
    _load_model()

    if not audio_path or not os.path.exists(audio_path):
        raise ValueError(f"[audio_engine] Audio file not found: {audio_path}")

    # ── CNN prediction ────────────────────────────────────────────────────
    chunks  = _audio_to_chunks(audio_path)
    tensors = np.stack([c[..., np.newaxis] for c in chunks])  # (N, 128, 128, 1)

    all_scores = _model.predict(tensors, verbose=0)   # (N, 35)
    scores     = np.mean(all_scores, axis=0)          # (35,) averaged

    predicted_idx = int(np.argmax(scores))
    confidence    = float(scores[predicted_idx])
    scientific    = _label_names[predicted_idx]

    # ── Lookup common name + type ──────────────────────────────────────────
    common_name, animal_type = SPECIES_MAP.get(
        scientific, (scientific, "Unknown")
    )

    # ── Extract all 10 acoustic features for the GBR distance model ───────
    acoustic = _extract_acoustic_features(audio_path)

    # ── Build features dict (superset of what inference.py expects) ───────
    features = {
        # --- CNN-derived (kept for backward compat with fusion_engine) ---
        "confidence":      round(confidence, 4),
        "amplitude":       round(confidence, 4),
        "scientific_name": scientific,
        "raw_scores":      [round(float(s), 4) for s in scores],
        "chunks_used":     len(chunks),
        # --- Acoustic features for GBR distance model ---
        **{k: round(v, 6) for k, v in acoustic.items()},
    }

    return {
        "species":          common_name,
        "scientific_name":  scientific,
        "type":             animal_type,
        "confidence":       round(confidence, 4),
        "audio_confidence": round(confidence, 4),
        "features":         features,
        "raw_scores":       [round(float(s), 4) for s in scores],
    }