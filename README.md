# Multi-Modal Species Identification System

> ⚠️ **This project is currently under active development and is NOT production-ready.**
> All inference engines are running in **dummy/simulation mode** — they return realistic randomised outputs, not real model predictions. Trained models are being prepared separately on Kaggle. This codebase exists to validate the architecture, fusion logic, and execution pipeline before real models are integrated.

---

A software-first simulation of an AI-powered wildlife identification device using multi-modal sensor fusion. Built to validate the core intelligence pipeline — audio classification, image classification, distance estimation, and weighted fusion — before hardware integration.

---

## Project Identity

| Property | Value |
|---|---|
| **System Name** | Multi-Modal Species Identification System |
| **Short Code** | MMSIS |
| **Region** | India (20 birds, 10 mammals) |
| **Stage** | Simulation / Dummy inference (Stage 1–2) |
| **Goal** | Prove multi-modal fusion logic and edge AI execution pipeline |

---

## Architecture

```
Frontend (Browser)
    ↓
Flask REST API  (app.py)
    ↓
Core Inference Engine  (core/inference.py)
    ├── audio_engine.py    → CNN on Mel-spectrogram
    ├── image_engine.py    → MobileNet/ResNet transfer learning
    ├── distance_engine.py → Acoustic regression model
    └── fusion_engine.py   → Weighted confidence fusion
    ↓
SQLite Database  (wlds9.db)
    ↓
Detection History Page  (/history)
```

**Golden Rule:** Flask never contains ML logic. All intelligence lives in `core/`.

---

## Project Structure

```
project/
├── app.py                    ← Flask API layer (routes only)
├── wlds9.db                  ← SQLite detection log database
├── requirements.txt
│
├── core/
│   ├── __init__.py
│   ├── inference.py          ← Main pipeline orchestrator
│   ├── audio_engine.py       ← Audio species classification
│   ├── image_engine.py       ← Visual species classification
│   ├── distance_engine.py    ← Distance estimation (acoustic)
│   ├── fusion_engine.py      ← Multi-modal fusion logic
│   └── logger.py             ← SQLite logging
│
├── templates/
│   ├── index.html            ← Main scanner UI
│   └── history.html          ← Detection history page
│
├── static/
│   ├── css/
│   │   ├── style.css         ← Main stylesheet
│   │   └── history.css       ← History page styles
│   └── js/
│       ├── app.js            ← Main UI logic
│       └── history.js        ← History page logic
│
├── dataset/                  ← Raw audio/image data (Stage 2)
├── models/                   ← Trained .pt model files (Stage 2)
└── logs/                     ← Legacy (replaced by SQLite)
```

---

## Setup & Run

### 1. Create virtual environment
```bash
python3 -m venv venv
source venv/bin/activate
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Test inference engine (CLI — no server needed)
```bash
python core/inference.py --mode audio
python core/inference.py --mode image
python core/inference.py --mode fusion
```

### 4. Start Flask server
```bash
python app.py
```

Open → **http://127.0.0.1:5000**

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/` | Main scanner UI |
| `GET` | `/history` | Detection history page |
| `POST` | `/analyze/audio` | Audio-only species scan |
| `POST` | `/analyze/image` | Image-only species scan |
| `POST` | `/analyze/fusion` | Full multi-modal scan |
| `GET` | `/logs` | Query SQLite logs (`?limit=`, `?mode=`) |
| `GET` | `/logs/stats` | Aggregate stats (top species, avg confidence) |
| `POST` | `/logs/clear` | Wipe all detection logs |

---

## Analysis Modes

### Audio Mode
- Input: WAV / MP3 / M4A file or 5-second live recording
- Output: Species, confidence, estimated distance, distance method

### Image / Visual Mode
- Input: JPG / PNG / WebP or live camera capture
- Output: Species, confidence, habitat zone, activity level, size class, frame coverage, time of day

### Fusion Mode
- Input: Audio + Image together
- Output: Fused species prediction with agreement/conflict detection
- Formula: `D = (c₁·d₁ + c₂·d₂ + c₃·d₃) / (c₁ + c₂ + c₃)`
- Agreement boosts confidence by 10%; conflict applies 5% penalty

---

## Species Coverage

### Birds (20)
Indian Peacock, Indian Sparrow, Common Myna, Rose-ringed Parakeet, Asian Koel, Black Drongo, Red-vented Bulbul, Oriental Magpie-Robin, Barn Swallow, White-throated Kingfisher, Jungle Babbler, Common Tailorbird, Purple Sunbird, Indian Robin, Shikra, Indian Roller, Pied Kingfisher, Greater Coucal, Spotted Owlet, Common Hoopoe

### Mammals (10)
Indian Fox, Bengal Tiger, Indian Leopard, Sloth Bear, Golden Jackal, Striped Hyena, Indian Wild Boar, Chital Deer, Sambar Deer, Indian Mongoose

---

## Database

All detections are stored in `wlds9.db` (SQLite — no extra install needed).

```bash
# Query latest detections
sqlite3 wlds9.db "SELECT id, species, confidence, distance, mode FROM detection_logs ORDER BY id DESC LIMIT 10;"

# Open interactive shell
sqlite3 wlds9.db
.mode column
.headers on
SELECT * FROM detection_logs ORDER BY id DESC LIMIT 20;
```

**Recommended GUI:** Install the **SQLite Viewer** extension in VS Code and click `wlds9.db` to browse all data in a table.

---

## Development Roadmap

| Stage | Status | Description |
|---|---|---|
| **Stage 1** | ✅ Complete | Dataset engineering — species list, folder structure |
| **Stage 2** | 🔄 In Progress | Model training on Kaggle (audio CNN, image MobileNet, distance regression) — **models not yet integrated** |
| **Stage 3** | ⚠️ Dummy Mode | Core inference engine built and CLI-testable — **returns simulated outputs, not real predictions** |
| **Stage 4** | ✅ Complete | Flask API layer wired to dummy inference |
| **Stage 5** | ✅ Complete | Frontend simulation — all UI, modes, and species info panel working |
| **Stage 6** | ✅ Complete | SQLite logging + Detection History page |
| **Stage 7** | 🔲 Pending | Swap dummy engines with trained `.pt` models |
| **Stage 8** | 🔲 Pending | Real-world field testing and threshold calibration |

---

## Dataset Sources (for Stage 2 training)

| Purpose | Dataset | Link |
|---|---|---|
| Bird audio (India) | xeno-canto | https://xeno-canto.org |
| Bird images | iNaturalist India | https://www.inaturalist.org |
| Audio (Kaggle) | BirdCLEF 2024 | https://www.kaggle.com/competitions/birdclef-2024 |
| Animal images | Animals Detection Dataset | https://www.kaggle.com/datasets/antoreepjana/animals-detection-images-dataset |

---

## Performance Constraints

| Resource | Spec | Usage |
|---|---|---|
| GPU | GTX 1650 | Inference only |
| RAM | 8 GB | Batch size ≤ 16 |
| Training | Kaggle (cloud) | MobileNet / lightweight CNN |
| Inference | Local PC | ONNX or PyTorch CPU/GPU |

---

## Core Intellectual Property

- **Fusion strategy** — weighted confidence fusion across audio, image, and distance modalities
- **Hybrid distance model** — acoustic inverse-square-law + visual frame coverage + simulated TDOA
- **Execution pipeline** — framework-independent core, swappable transport layer

---

## Current Limitations

> These limitations exist because the system is in simulation phase. They will be resolved as real models are trained and integrated.

| Component | Current State | Target State |
|---|---|---|
| `audio_engine.py` | Returns randomised species from a weighted pool | CNN on real Mel-spectrogram features from trained audio model |
| `image_engine.py` | Returns randomised species + visual metadata | MobileNet/ResNet transfer learning on real labelled images |
| `distance_engine.py` | Simulates distance using inverse-square-law approximation | Trained regression model on loudness + TDOA + spectral features |
| `fusion_engine.py` | Logic is real — weighted confidence fusion works correctly | Same logic, fed by real model outputs instead of dummy data |
| Species info panel | Hardcoded lookup table in `app.js` | Should be served from DB / species API |
| Conservation data | Static, manually curated | Should pull from IUCN Red List API |

---

## Future Transition (Post-Funding)

| Current | Replace With |
|---|---|
| Flask | FastAPI or embedded service |
| PyTorch `.pt` | TensorFlow Lite (edge deployment) |
| File uploads | Live sensor streams (microphone array + camera module) |
| SQLite | PostgreSQL or time-series DB |

Core fusion logic remains unchanged — that is the key asset.

---

*Multi-Modal Species Identification System — India Wildlife AI*