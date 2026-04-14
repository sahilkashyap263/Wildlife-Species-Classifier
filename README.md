# WLDS-9 — Multi-Modal Species Identification System

An AI-powered wildlife identification system using multi-modal sensor fusion. Combines acoustic and visual analysis to identify 35 species across birds, mammals, and amphibians — returning the species name, confidence score, estimated distance, habitat data, and a direct Wikipedia link for every detection.

---

## How It Works

The system runs three independent ML models and fuses their outputs into a single prediction.

```
Audio Input ──► Audio CNN (Mel-spectrogram)  ──┐
                                                ├──► Fusion Engine ──► Final Prediction
Image Input ──► Image CNN (MobileNetV2)      ──┤
                    │                           │
                    └──► GBR Distance Model  ───┘
```

**Audio CNN** — A 5-layer convolutional network trained on mel-spectrograms. Audio is split into overlapping 4-second chunks and predictions are averaged across all chunks for accuracy.

**Image CNN** — MobileNetV2 transfer learning trained on wildlife images. Returns species, habitat zone, activity level, size class, and body coverage.

**Distance Model** — A Gradient Boosting Regressor trained on 10 acoustic features (mel energy, MFCC, RMS, spectral centroid, ZCR). Predicts distance as Near (10–30 m), Medium (31–60 m), or Far (61–90 m).

**Fusion Engine** — Combines audio and image predictions using weighted confidence (58% image / 42% audio). Detects agreement or conflict between modalities and adjusts final confidence accordingly.

---

## Analysis Modes

### Audio Mode
- **Input:** WAV / MP3 / M4A / WebM file, or live 15-second microphone recording
- **Output:** Species, confidence, distance estimate, distance label

### Visual Mode
- **Input:** JPG / PNG / WebP file, or live webcam capture
- **Output:** Species, confidence, habitat zone, activity level, size class, frame coverage

### Fusion Mode
- **Input:** Audio + Image simultaneously
- **Output:** Fused species prediction, agreement/conflict status, full metadata from both modalities
- **Weighting:** 58% image / 42% audio

---

## Species Coverage — 35 Total

### Birds (23)
American Pipit, Bank Swallow, Black-billed Cuckoo, Bobolink, Brewer's Blackbird, California Gull, Eastern Towhee, European Goldfinch, Fish Crow, Gray Catbird, Gray-crowned Rosy-Finch, Great Crested Flycatcher, House Sparrow, Indigo Bunting, Northern Cardinal, Orchard Oriole, Ovenbird, Pacific-slope Flycatcher, Painted Bunting, Purple Finch, Rufous Hummingbird, Rusty Blackbird, Yellow-breasted Chat

### Mammals (11)
Asian Elephant, Bear, Cat, Cow, Donkey, Horse, Lion, Monkey, Sheep, Wolf / Dog, Chicken

### Amphibians (1)
Frog

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3, Flask |
| ML — Audio | Custom CNN on 128-band mel-spectrograms |
| ML — Image | MobileNetV2 transfer learning |
| ML — Distance | Gradient Boosting Regressor (scikit-learn) |
| Frontend | Vanilla JS, CSS3, Font Awesome 6, Google Fonts |
| Database | SQLite |
| Auth | Flask sessions, bcrypt |

---

## Project Structure

```
wlds9/
├── app.py                    ← Flask app factory and entry point
├── config.py                 ← Flask config
├── auth.py                   ← Register, login, session management
├── routes.py                 ← Blueprint registration
├── wlds9.db                  ← SQLite database (auto-created on first run)
├── requirements.txt
│
├── core/
│   ├── inference.py          ← Main pipeline orchestrator
│   ├── audio_engine.py       ← Audio species classification
│   ├── image_engine.py       ← Visual species classification
│   ├── distance_engine.py    ← Distance estimation
│   ├── fusion_engine.py      ← Multi-modal fusion
│   └── logger.py             ← Detection logging
│
├── models/
│   ├── AnimalSounds.keras    ← Trained audio CNN weights
│   ├── AnimalImages.keras    ← Trained image CNN weights
│   ├── gbr_distance.pkl      ← Trained GBR distance model
│   ├── scaler_distance.pkl   ← Feature scaler
│   ├── thresholds.pkl        ← Distance bucket thresholds
│   └── labels.json           ← 35 class scientific name labels
│
├── templates/
│   ├── base.html
│   ├── landing.html
│   ├── index.html            ← Scanner dashboard
│   ├── auth.html
│   └── history.html
│
└── static/
    ├── css/
    └── js/
        ├── app.js            ← Scanner logic
        └── landing.js        ← Landing page + auth modal
```

---

## Setup & Run

**1. Create and activate virtual environment**

```bash
python -m venv venv
source venv/bin/activate          # Mac / Linux
source venv/Scripts/activate      # Windows (Git Bash)
```

**2. Install dependencies**

```bash
pip install -r requirements.txt
```

**3. Test inference engine from CLI (no server needed)**

```bash
python core/inference.py --mode audio  --audio path/to/file.wav
python core/inference.py --mode image  --image path/to/file.jpg
python core/inference.py --mode fusion --audio path/to/file.wav --image path/to/file.jpg
```

**4. Start the server**

```bash
python app.py
```

Open → **http://127.0.0.1:5000**

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/` | Landing page |
| `GET` | `/scanner` | Scanner dashboard (login required) |
| `GET` | `/history` | Detection history (login required) |
| `POST` | `/analyze/audio` | Audio-only scan |
| `POST` | `/analyze/image` | Image-only scan |
| `POST` | `/analyze/fusion` | Full multi-modal scan |
| `GET` | `/logs` | Fetch detection logs (`?limit=`, `?mode=`) |
| `GET` | `/logs/stats` | Aggregate stats and top species |
| `POST` | `/logs/clear` | Clear all logs (admin only) |

---

## Auth

- Register with email — username is derived from the email prefix automatically
- Passwords are hashed with bcrypt
- Session-based authentication — scanner is inaccessible without login
- Admin role available — admin badge shown in header, user filter enabled on history page
- An admin account is seeded on first run — change the default credentials before use

---

## Database Queries

```sql
-- Recent successful detections
SELECT id, timestamp, mode, species, confidence, distance, logged_by
FROM detection_logs
WHERE is_error = 0
ORDER BY id DESC
LIMIT 20;

-- Scans per user
SELECT logged_by, COUNT(*) AS total_scans
FROM detection_logs
WHERE is_error = 0
GROUP BY logged_by
ORDER BY total_scans DESC;

-- Top detected species
SELECT species, COUNT(*) AS count
FROM detection_logs
WHERE is_error = 0 AND species IS NOT NULL
GROUP BY species
ORDER BY count DESC
LIMIT 10;

-- Clear all logs
DELETE FROM detection_logs;
DELETE FROM sqlite_sequence WHERE name='detection_logs';
```

---

## Dataset Sources

| Purpose | Source |
|---|---|
| Bird audio | [xeno-canto](https://xeno-canto.org) |
| Bird images | [iNaturalist](https://www.inaturalist.org) |
| Audio (Kaggle) | [BirdCLEF 2024](https://www.kaggle.com/competitions/birdclef-2024) |
| Animal images | [Animals Detection Dataset](https://www.kaggle.com/datasets/antoreepjana/animals-detection-images-dataset) |

---

## Team

| Name | GitHub |
|---|---|
| Sahil Kashyap | [@sahilkashyap263](https://github.com/sahilkashyap263) |
| Mohammad Mujamil | [@mujamilh](https://github.com/mujamilh) |
| Ashutosh Sharma | [@AshutoshSharma-091](https://github.com/AshutoshSharma-091) |
| Amaan Alam | [@amaan541](https://github.com/amaan541) |
| Abhishek | [@abhi1917kr](https://github.com/abhi1917kr) |

---

*WLDS-9 — Multi-Modal Species Identification System · v2.4.1 · © 2026*
