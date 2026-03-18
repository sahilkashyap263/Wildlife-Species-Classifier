/**
 * ═══════════════════════════════════════
 * WLDS-9 WILDLIFE DETECTION SYSTEM
 * Main Application JavaScript — v2 (Live Backend)
 * ═══════════════════════════════════════
 */

'use strict';

// ────────────────────────────────────────
// STATE
// ────────────────────────────────────────
const appState = {
    mode: 'audio',
    recordedAudioBlob: null,
    capturedImageBlob: null,
    cameraStream: null,
    isRecording: false,
    isScanning: false,
    startTime: Date.now(),
    scanCount: 0
};

// ────────────────────────────────────────
// DOM CACHE
// ────────────────────────────────────────
const dom = (() => {
    const $ = id => document.getElementById(id);
    return {
        audioFile: $('audioFile'),
        imageFile: $('imageFile'),
        audioPreview: $('audioPreview'),
        cameraPreview: $('cameraPreview'),
        photoCanvas: $('photoCanvas'),
        waveformCanvas: $('waveformCanvas'),
        recordBtn: $('recordBtn'),
        recordProgress: $('recordProgress'),
        recordFill: $('recordFill'),
        recordIcon: $('recordIcon'),
        recordText: $('recordText'),
        openCameraBtn: $('openCameraBtn'),
        captureBtn: $('captureBtn'),
        analyzeBtn: $('analyzeBtn'),
        analyzeBtnText: $('analyzeBtnText'),
        species: $('species'),
        speciesType: $('speciesType'),
        confidence: $('confidence'),
        confFill: $('confFill'),
        distance: $('distance'),
        modeDisplay: $('modeDisplay'),
        threatLevel: $('threatLevel'),
        scanStatus: $('scanStatus'),
        logFeed: $('logFeed'),
        jsonOutput: $('jsonOutput'),
        clearLogs: $('clearLogs'),
        uptime: $('uptime'),
        scanCount: $('scanCount'),
        audioSection: $('audioSection'),
        imageSection: $('imageSection'),
        cameraIdle: $('cameraIdle'),
        sensorsWrapper: $('sensorsWrapper'),
        audioFill: $('audioFill'),
        imageFill: $('imageFill'),
        distFill: $('distFill'),
        fusionFill: $('fusionFill'),
        audioPct: $('audioPct'),
        imagePct: $('imagePct'),
        distPct: $('distPct'),
        fusionPct: $('fusionPct'),
        themeToggle: $('themeToggle'),
        themeIcon: $('themeIcon'),
        copyJson: $('copyJson')
    };
})();

// ────────────────────────────────────────
// THEME MANAGER
// ────────────────────────────────────────
const ThemeManager = {
    init() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
        dom.themeToggle.addEventListener('click', () => this.toggle());
    },
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        const icon = dom.themeIcon;
        if (theme === 'dark') {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    },
    toggle() {
        const current = document.documentElement.getAttribute('data-theme');
        this.setTheme(current === 'dark' ? 'light' : 'dark');
    }
};

// ────────────────────────────────────────
// UPTIME COUNTER
// ────────────────────────────────────────
const UptimeCounter = {
    init() {
        this.update();
        setInterval(() => this.update(), 1000);
    },
    update() {
        const elapsed = Math.floor((Date.now() - appState.startTime) / 1000);
        const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
        const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
        const s = String(elapsed % 60).padStart(2, '0');
        dom.uptime.textContent = `${h}:${m}:${s}`;
    }
};

// ────────────────────────────────────────
// WAVEFORM VISUALIZER
// ────────────────────────────────────────
const WaveformVisualizer = {
    ctx: null,
    points: Array(60).fill(0),
    active: false,
    init() {
        this.ctx = dom.waveformCanvas.getContext('2d', { alpha: false });
        this.draw();
    },
    setActive(active) { this.active = active; },
    draw() {
        const { width, height } = dom.waveformCanvas;
        const mid = height / 2;
        this.ctx.fillStyle = 'rgba(0,0,0,0.65)';
        this.ctx.fillRect(0, 0, width, height);
        this.ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
        this.ctx.lineWidth = 0.5;
        for (let y = 0; y <= height; y += height / 4) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
        this.points.shift();
        const amplitude = this.active
            ? (Math.random() * 0.7 + 0.1) * mid * 0.9
            : Math.random() * 2;
        this.points.push(amplitude);
        const step = width / (this.points.length - 1);
        this.ctx.beginPath();
        this.ctx.moveTo(0, mid);
        this.points.forEach((point, i) => {
            this.ctx.lineTo(i * step, mid + (i % 2 === 0 ? point : -point));
        });
        this.ctx.strokeStyle = this.active ? '#06b6d4' : 'rgba(100,116,139,0.55)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        requestAnimationFrame(() => this.draw());
    }
};

// ────────────────────────────────────────
// MODE MANAGER
// ────────────────────────────────────────
const ModeManager = {
    init() {
        document.querySelectorAll('.mode-card').forEach(card => {
            card.addEventListener('click', e => this.switchMode(e.currentTarget));
        });
    },
    switchMode(card) {
        document.querySelectorAll('.mode-card').forEach(c => {
            c.classList.remove('active');
            c.setAttribute('aria-pressed', 'false');
        });
        card.classList.add('active');
        card.setAttribute('aria-pressed', 'true');
        appState.mode = card.dataset.mode;
        dom.modeDisplay.textContent = appState.mode.toUpperCase();
        const wrapper = dom.sensorsWrapper;
        if (appState.mode === 'audio') {
            wrapper.classList.remove('fusion-sensors-grid');
            dom.audioSection.style.display = 'block';
            dom.imageSection.style.display = 'none';
        } else if (appState.mode === 'image') {
            wrapper.classList.remove('fusion-sensors-grid');
            dom.audioSection.style.display = 'none';
            dom.imageSection.style.display = 'block';
        } else {
            wrapper.classList.add('fusion-sensors-grid');
            dom.audioSection.style.display = 'block';
            dom.imageSection.style.display = 'block';
        }
        Logger.add(`Mode switched to ${appState.mode.toUpperCase()}`);
    }
};

// ────────────────────────────────────────
// AUDIO RECORDER
// ────────────────────────────────────────
const AudioRecorder = {
    mediaRecorder: null,
    audioChunks: [],
    init() {
        dom.recordBtn.addEventListener('click', () => this.toggleRecording());
    },
    async toggleRecording() {
        if (appState.isRecording) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            this.mediaRecorder.ondataavailable = e => this.audioChunks.push(e.data);
            this.mediaRecorder.onstop = () => this.handleStop(stream);
            this.mediaRecorder.start();
            this.startRecording();
        } catch {
            Logger.add('Microphone access denied', 'error');
        }
    },
    startRecording() {
        appState.isRecording = true;
        WaveformVisualizer.setActive(true);
        dom.recordBtn.classList.add('recording');
        dom.recordIcon.classList.remove('fa-microphone');
        dom.recordIcon.classList.add('fa-circle');
        dom.recordText.textContent = 'Recording...';
        dom.recordProgress.style.display = 'block';
        Logger.add('Recording acoustic sample...', 'warn');
        let elapsed = 0;
        const interval = setInterval(() => {
            elapsed += 100;
            dom.recordFill.style.width = `${(elapsed / 5000) * 100}%`;
            if (elapsed >= 5000) clearInterval(interval);
        }, 100);
        setTimeout(() => this.mediaRecorder.stop(), 5000);
    },
    handleStop(stream) {
        appState.recordedAudioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        dom.audioPreview.src = URL.createObjectURL(appState.recordedAudioBlob);
        stream.getTracks().forEach(t => t.stop());
        appState.isRecording = false;
        WaveformVisualizer.setActive(false);
        dom.recordBtn.classList.remove('recording');
        dom.recordIcon.classList.remove('fa-circle');
        dom.recordIcon.classList.add('fa-microphone');
        dom.recordText.textContent = 'Record 5s Sample';
        dom.recordProgress.style.display = 'none';
        dom.audioPreview.style.display = 'block';
        Logger.add('Audio sample captured (5s)', 'success');
    }
};

// ────────────────────────────────────────
// FILE HANDLERS
// ────────────────────────────────────────
const FileHandlers = {
    init() {
        dom.audioFile.addEventListener('change', () => this.handleAudioFile());
        dom.imageFile.addEventListener('change', () => this.handleImageFile());
    },
    handleAudioFile() {
        const file = dom.audioFile.files[0];
        if (!file) return;
        dom.audioPreview.src = URL.createObjectURL(file);
        dom.audioPreview.style.display = 'block';
        WaveformVisualizer.setActive(true);
        setTimeout(() => WaveformVisualizer.setActive(false), 2000);
        Logger.add(`Audio file loaded: ${file.name}`, 'success');
    },
    handleImageFile() {
        const file = dom.imageFile.files[0];
        if (!file) return;
        const img = new Image();
        img.onload = () => {
            dom.photoCanvas.width = img.width;
            dom.photoCanvas.height = img.height;
            dom.photoCanvas.getContext('2d').drawImage(img, 0, 0);
        };
        img.src = URL.createObjectURL(file);
        dom.photoCanvas.style.display = 'block';
        dom.cameraPreview.style.display = 'none';
        dom.cameraIdle.style.display = 'none';
        if (appState.cameraStream) CameraHandler.stopCamera();
        appState.capturedImageBlob = file;
        Logger.add(`Image file loaded: ${file.name}`, 'success');
    }
};

// ────────────────────────────────────────
// CAMERA HANDLER
// ────────────────────────────────────────
const CameraHandler = {
    init() {
        dom.openCameraBtn = document.getElementById('openCameraBtn');
        dom.captureBtn = document.getElementById('captureBtn');
        dom.stopCameraBtn = document.getElementById('stopCameraBtn');
        dom.openCameraBtn.addEventListener('click', () => this.openCamera());
        dom.captureBtn.addEventListener('click', () => this.capturePhoto());
        dom.stopCameraBtn.addEventListener('click', () => this.stopCamera());
    },
    async openCamera() {
        if (appState.cameraStream) return;
        try {
            appState.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
            dom.cameraPreview.srcObject = appState.cameraStream;
            dom.cameraPreview.style.display = 'block';
            dom.photoCanvas.style.display = 'none';
            dom.cameraIdle.style.display = 'none';
            dom.stopCameraBtn.style.display = 'flex';
            dom.openCameraBtn.innerHTML = '<i class="fa-solid fa-video"></i>&nbsp;Camera Live';
            dom.openCameraBtn.disabled = true;
            dom.openCameraBtn.style.opacity = '0.5';
            Logger.add('Camera activated', 'success');
        } catch {
            Logger.add('Camera access denied', 'error');
        }
    },
    capturePhoto() {
        if (!appState.cameraStream) {
            Logger.add('Open camera first', 'warn');
            return;
        }
        const v = dom.cameraPreview;
        const c = dom.photoCanvas;
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        c.getContext('2d').drawImage(v, 0, 0);
        c.style.display = 'block';
        c.toBlob(blob => { appState.capturedImageBlob = blob; }, 'image/jpeg');
        Logger.add('Photo captured — camera stopped automatically', 'success');
        this.stopCamera();
    },
    stopCamera() {
        if (!appState.cameraStream) return;
        appState.cameraStream.getTracks().forEach(track => track.stop());
        appState.cameraStream = null;
        dom.cameraPreview.srcObject = null;
        dom.cameraPreview.style.display = 'none';
        if (!appState.capturedImageBlob) {
            dom.cameraIdle.style.display = 'flex';
            dom.photoCanvas.style.display = 'none';
        }
        dom.stopCameraBtn.style.display = 'none';
        dom.openCameraBtn.innerHTML = '<i class="fa-solid fa-video"></i>&nbsp;Open Camera';
        dom.openCameraBtn.disabled = false;
        dom.openCameraBtn.style.opacity = '1';
        Logger.add('Camera stopped', 'warn');
    }
};

// ────────────────────────────────────────
// ANALYZER  ←  Now wired to live Flask API
// ────────────────────────────────────────
const Analyzer = {
    init() {
        dom.analyzeBtn.addEventListener('click', () => this.runScan());
    },

    async runScan() {
        if (appState.isScanning) return;
        this.startScan();

        const fd = this.buildFormData();

        try {
            const res = await fetch(`/analyze/${appState.mode}`, {
                method: 'POST',
                body: fd
            });

            if (!res.ok) {
                throw new Error(`Server error: ${res.status}`);
            }

            const data = await res.json();

            if (data.error) {
                Logger.add(`Engine error: ${data.error}`, 'error');
            } else {
                ResultsHandler.display(data);
            }

        } catch (err) {
            Logger.add(`Connection error: ${err.message}`, 'error');
        } finally {
            this.endScan();
        }
    },

    startScan() {
        appState.isScanning = true;
        appState.scanCount++;
        dom.scanCount.textContent = appState.scanCount;
        dom.analyzeBtn.classList.add('scanning');
        dom.analyzeBtnText.textContent = 'Scanning...';
        dom.scanStatus.textContent = 'SCANNING';
        WaveformVisualizer.setActive(true);
        Logger.add(`Scan #${appState.scanCount} initiated — Mode: ${appState.mode.toUpperCase()}`, 'warn');
    },

    endScan() {
        appState.isScanning = false;
        dom.analyzeBtn.classList.remove('scanning');
        dom.analyzeBtnText.textContent = 'Initiate Scan';
        dom.scanStatus.textContent = 'COMPLETE';
        WaveformVisualizer.setActive(false);
    },

    buildFormData() {
        const fd = new FormData();
        const af = dom.audioFile.files[0];
        const imf = dom.imageFile.files[0];

        // Prefer file input, fall back to recorded/captured blob
        if (af) fd.append('audio', af);
        else if (appState.recordedAudioBlob) fd.append('audio', appState.recordedAudioBlob, 'recorded.webm');

        if (imf) fd.append('image', imf);
        else if (appState.capturedImageBlob) fd.append('image', appState.capturedImageBlob, 'captured.jpg');

        return fd;
    }
};

// ────────────────────────────────────────
// RESULTS HANDLER
// ────────────────────────────────────────
const ResultsHandler = {
    display(data) {
        const {
            species = 'UNKNOWN',
            type = '—',
            confidence = 0,
            distance = null,
            audio_confidence,
            image_confidence,
            distance_confidence,
            agreement
        } = data;

        dom.species.textContent = species.toUpperCase();
        dom.speciesType.textContent = `Class: ${type}`;
        dom.confidence.textContent = `${(confidence * 100).toFixed(1)}%`;
        dom.confFill.style.width = `${confidence * 100}%`;
        dom.distance.textContent = distance ? `${distance.toFixed(1)} m` : '— m';
        dom.modeDisplay.textContent = appState.mode.toUpperCase();
        dom.threatLevel.textContent = confidence > 0.9 ? 'VERIFIED'
            : confidence > 0.7 ? 'PROBABLE'
                : 'UNCERTAIN';

        this.updateModelBars(confidence, audio_confidence, image_confidence, distance_confidence);

        // Fusion agreement indicator
        if (appState.mode === 'fusion' && agreement !== undefined) {
            const agreeLabel = agreement ? '✔ Modalities Agree' : '⚠ Modality Conflict — confidence penalised';
            Logger.add(agreeLabel, agreement ? 'success' : 'warn');
        }

        Logger.add(`Species: ${species.toUpperCase()} | Confidence: ${(confidence * 100).toFixed(1)}%  | Distance: ${distance ? distance.toFixed(1) + ' m' : 'N/A'}`, 'success');

        dom.jsonOutput.textContent = JSON.stringify(data, null, 2);
        HistoryManager.add(species, confidence);
    },

    updateModelBars(c, ac, ic, dc) {
        const set = (model, pct) => {
            const p = Math.min(100, (pct || 0) * 100);
            dom[`${model}Fill`].style.width = `${p}%`;
            dom[`${model}Pct`].textContent = `${p.toFixed(0)}%`;
        };

        if (appState.mode === 'audio') {
            set('audio', ac || c);
            set('image', 0);
            set('dist', dc || c * 0.76);
            set('fusion', 0);
        } else if (appState.mode === 'image') {
            set('audio', 0);
            set('image', ic || c);
            set('dist', dc || c * 0.70);
            set('fusion', 0);
        } else {
            set('audio', ac || c * 0.87);
            set('image', ic || c * 0.91);
            set('dist', dc || c * 0.76);
            set('fusion', c);
        }
    }
};

// ────────────────────────────────────────
// LOGGER
// ────────────────────────────────────────
const Logger = {
    add(message, type = 'info') {
        const time = new Date().toTimeString().slice(0, 8);
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.innerHTML = `<span class="log-time">${time}</span><span class="log-msg">${message}</span>`;
        dom.logFeed.appendChild(entry);
        dom.logFeed.scrollTop = dom.logFeed.scrollHeight;
    },
    clear() {
        dom.logFeed.innerHTML = '';
        dom.jsonOutput.textContent = '// Cleared';
        this.add('Logs cleared');
    }
};

// ────────────────────────────────────────
// HISTORY MANAGER (logs to DB via backend)
// In-page card removed — full history at /history
// ────────────────────────────────────────
const HistoryManager = {
    maxItems: 8,
    add(species, confidence) {
        // Detections are persisted to SQLite via the backend.
        // Visit /history to view the full detection history page.
    }
};

// ────────────────────────────────────────
// INIT
// ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();
    UptimeCounter.init();
    WaveformVisualizer.init();
    ModeManager.init();
    AudioRecorder.init();
    FileHandlers.init();
    CameraHandler.init();
    Analyzer.init();
    dom.clearLogs.addEventListener('click', () => Logger.clear());
    if (dom.copyJson) dom.copyJson.addEventListener('click', () => {
        const text = dom.jsonOutput.textContent;
        if (text && text !== '// No scan data yet' && text !== '// Cleared') {
            navigator.clipboard.writeText(text).then(() => {
                dom.copyJson.innerHTML = '<i class="fa-solid fa-check"></i>&nbsp;Copied!';
                setTimeout(() => {
                    dom.copyJson.innerHTML = '<i class="fa-solid fa-copy"></i>&nbsp;Copy';
                }, 2000);
            });
        }
    });
    Logger.add('WLDS-9 System Online — Backend connected', 'success');
    console.log('%c WLDS-9 System Online', 'color: #06b6d4; font-size: 16px; font-weight: bold;');
});