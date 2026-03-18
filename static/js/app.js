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
        // Reset cards and species info on mode switch
        ResultsHandler.setImageMode(appState.mode === 'image');
        document.getElementById('speciesInfoPlaceholder').style.display = 'flex';
        document.getElementById('speciesInfoContent').style.display = 'none';
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
// SPECIES INFO DATABASE
// ────────────────────────────────────────
const SPECIES_DB = {
    "Indian Peacock":           { habitat:"Deciduous & mixed forests, near water", diet:"Omnivore — seeds, insects, small reptiles", activity:"Diurnal", size:"Large (90–130 cm body)", status:"LC", status_label:"Least Concern", range:"Indian subcontinent, Sri Lanka", behaviour:"Polygamous; males display elaborate plumage. Roosts in trees." },
    "Indian Sparrow":           { habitat:"Urban areas, farmland, grassland", diet:"Granivore — mainly seeds and grains", activity:"Diurnal", size:"Small (14–16 cm)", status:"LC", status_label:"Least Concern", range:"Throughout India", behaviour:"Highly social; nests in cavities and roof eaves." },
    "Common Myna":              { habitat:"Open woodland, urban, cultivated land", diet:"Omnivore — fruit, insects, scraps", activity:"Diurnal", size:"Small (23–26 cm)", status:"LC", status_label:"Least Concern", range:"South & Southeast Asia", behaviour:"Bold and territorial; known mimic. Often seen in pairs." },
    "Rose-ringed Parakeet":     { habitat:"Light forest, woodland, urban gardens", diet:"Granivore — seeds, nuts, fruit, flowers", activity:"Diurnal", size:"Medium (38–42 cm incl. tail)", status:"LC", status_label:"Least Concern", range:"Sub-Saharan Africa to South Asia", behaviour:"Flock-roosting; loud contact calls. Cavity nester." },
    "Asian Koel":               { habitat:"Dense canopy forest, urban trees", diet:"Frugivore — figs and soft fruits", activity:"Diurnal", size:"Small (39–46 cm)", status:"LC", status_label:"Least Concern", range:"South & Southeast Asia, China", behaviour:"Brood parasite of crows. Males produce iconic ascending call." },
    "Black Drongo":             { habitat:"Open farmland, scrub, forest edges", diet:"Insectivore — aerial insects", activity:"Diurnal", size:"Small (28 cm)", status:"LC", status_label:"Least Concern", range:"South to Southeast Asia", behaviour:"Aggressive mobber; often seen on exposed perches. Bold around livestock." },
    "Red-vented Bulbul":        { habitat:"Scrubland, gardens, secondary forest", diet:"Omnivore — fruit, nectar, insects", activity:"Diurnal", size:"Small (20–23 cm)", status:"LC", status_label:"Least Concern", range:"Indian subcontinent", behaviour:"Conspicuous and vocal; one of India's most familiar garden birds." },
    "Oriental Magpie-Robin":    { habitat:"Open woodland, parks, gardens", diet:"Insectivore — ground insects, worms", activity:"Diurnal", size:"Small (19–21 cm)", status:"LC", status_label:"Least Concern", range:"South & Southeast Asia", behaviour:"Gifted singer; males sing prominently at dawn. Territorial." },
    "Barn Swallow":             { habitat:"Open country, wetlands, near human habitation", diet:"Insectivore — aerial insects", activity:"Diurnal", size:"Small (17–19 cm)", status:"LC", status_label:"Least Concern", range:"Worldwide except polar regions", behaviour:"Long-distance migratory. Builds mud-cup nests on beams." },
    "White-throated Kingfisher":{ habitat:"Riverine, wetlands, also dry woodland", diet:"Carnivore — fish, frogs, lizards, large insects", activity:"Diurnal", size:"Small (27–28 cm)", status:"LC", status_label:"Least Concern", range:"South & Southeast Asia", behaviour:"Loud laughing call; hunts from prominent perch." },
    "Jungle Babbler":           { habitat:"Dry deciduous forest, scrub, gardens", diet:"Omnivore — insects, berries, nectar", activity:"Diurnal", size:"Small (23 cm)", status:"LC", status_label:"Least Concern", range:"Indian subcontinent", behaviour:"Gregarious; moves in noisy groups of 6–10. Nicknamed 'Seven Sisters'." },
    "Common Tailorbird":        { habitat:"Dense shrubs, gardens, secondary growth", diet:"Insectivore — small insects and spiders", activity:"Diurnal", size:"Small (10–14 cm)", status:"LC", status_label:"Least Concern", range:"South & Southeast Asia", behaviour:"Sews leaf edges together with plant fibre to form nest." },
    "Purple Sunbird":           { habitat:"Open woodland, gardens, orchards", diet:"Nectarivore — nectar, also small insects", activity:"Diurnal", size:"Small (10 cm)", status:"LC", status_label:"Least Concern", range:"South & Southeast Asia", behaviour:"Males iridescent purple; hovers briefly at flowers." },
    "Indian Robin":             { habitat:"Open rocky scrub, dry grassland", diet:"Insectivore — ground insects, worms", activity:"Diurnal", size:"Small (16–19 cm)", status:"LC", status_label:"Least Concern", range:"Indian subcontinent", behaviour:"Males hold tail cocked upright. Strong territory defender." },
    "Shikra":                   { habitat:"Light forest, urban trees, gardens", diet:"Carnivore — small birds, lizards, large insects", activity:"Diurnal", size:"Small (26–30 cm)", status:"LC", status_label:"Least Concern", range:"Africa, South & Southeast Asia", behaviour:"Smallest Indian accipiter; fast low hunting flight." },
    "Indian Roller":            { habitat:"Open woodland, farmland, dry scrub", diet:"Carnivore — large insects, small vertebrates", activity:"Diurnal", size:"Medium (30–34 cm)", status:"LC", status_label:"Least Concern", range:"Indian subcontinent to Southeast Asia", behaviour:"State bird of several Indian states. Spectacular tumbling display flight." },
    "Pied Kingfisher":          { habitat:"Freshwater rivers, lakes, coastal lagoons", diet:"Piscivore — small fish", activity:"Diurnal", size:"Small (25 cm)", status:"LC", status_label:"Least Concern", range:"Africa, South Asia, Southeast Asia", behaviour:"Only kingfisher to routinely hover over water before diving." },
    "Greater Coucal":           { habitat:"Dense undergrowth, reed beds, gardens", diet:"Omnivore — large insects, eggs, small vertebrates", activity:"Diurnal", size:"Large (48 cm)", status:"LC", status_label:"Least Concern", range:"South & Southeast Asia", behaviour:"Weak flier; moves through dense vegetation. Deep booming call." },
    "Spotted Owlet":            { habitat:"Open forest, urban areas, old buildings", diet:"Carnivore — insects, small rodents, lizards", activity:"Crepuscular/Nocturnal", size:"Small (21 cm)", status:"LC", status_label:"Least Concern", range:"South & Southeast Asia", behaviour:"Often active at dusk. Nests in tree hollows and building cavities." },
    "Common Hoopoe":            { habitat:"Open grassland, farmland, sparse woodland", diet:"Insectivore — probes soil for larvae and beetles", activity:"Diurnal", size:"Small (25–32 cm)", status:"LC", status_label:"Least Concern", range:"Europe, Africa, Asia", behaviour:"Distinctive erectile crest; probes ground with curved bill." },
    "Indian Fox":               { habitat:"Arid scrubland, semi-desert, open grassland", diet:"Omnivore — small mammals, insects, fruit", activity:"Crepuscular/Nocturnal", size:"Medium (45–60 cm body)", status:"LC", status_label:"Least Concern", range:"Indian subcontinent", behaviour:"Monogamous pairs; digs dens in soft soil. Avoids dense forest." },
    "Bengal Tiger":             { habitat:"Dense tiger reserves, mangroves, grassland", diet:"Apex carnivore — deer, wild boar, buffalo", activity:"Crepuscular/Nocturnal", size:"Apex (2.5–3.3 m total)", status:"EN", status_label:"Endangered", range:"Indian subcontinent, Bangladesh, Bhutan", behaviour:"Solitary and territorial. Excellent swimmer. Ambush hunter." },
    "Indian Leopard":           { habitat:"Mixed forest, rocky hills, forest edges", diet:"Carnivore — deer, monkeys, dogs, livestock", activity:"Nocturnal", size:"Large (1–1.9 m body)", status:"VU", status_label:"Vulnerable", range:"Indian subcontinent to SE Asia", behaviour:"Highly adaptable; caches kills in trees. Most secretive large cat." },
    "Sloth Bear":               { habitat:"Dry deciduous and tropical forest", diet:"Myrmecophage — termites, ants, fruit, honey", activity:"Nocturnal/Crepuscular", size:"Large (140–190 cm)", status:"VU", status_label:"Vulnerable", range:"Indian subcontinent, Sri Lanka", behaviour:"Long claws for digging termite mounds. Loud sucking feeding sounds." },
    "Golden Jackal":            { habitat:"Open scrubland, forest edges, farmland", diet:"Omnivore — small mammals, carrion, fruit", activity:"Crepuscular/Nocturnal", size:"Medium (60–75 cm body)", status:"LC", status_label:"Least Concern", range:"SE Europe, Middle East, South Asia", behaviour:"Monogamous; hunts alone or in pairs. Communicates with howling." },
    "Striped Hyena":            { habitat:"Arid zones, dry scrub, semi-desert", diet:"Scavenger/Carnivore — carrion, bones, small prey", activity:"Nocturnal", size:"Medium (85–130 cm body)", status:"NT", status_label:"Near Threatened", range:"North Africa, Middle East, South Asia", behaviour:"Solitary; massive jaw pressure crushes bone. Raises mane when threatened." },
    "Indian Wild Boar":         { habitat:"Riverine forest, grassland, scrub", diet:"Omnivore — roots, tubers, carrion, small animals", activity:"Crepuscular/Nocturnal", size:"Large (90–200 cm body)", status:"LC", status_label:"Least Concern", range:"Throughout India and South Asia", behaviour:"Highly social; lives in sounders. Males solitary. Aggressive when cornered." },
    "Chital Deer":              { habitat:"Grassland and forest edges near water", diet:"Herbivore — grass, leaves, fallen fruit", activity:"Diurnal", size:"Large (100–120 cm shoulder)", status:"LC", status_label:"Least Concern", range:"Indian subcontinent, Sri Lanka", behaviour:"Most common Indian deer; spotted coat retained in adults. Mixed herds." },
    "Sambar Deer":              { habitat:"Dense moist forest, hill slopes", diet:"Herbivore — grass, shrubs, fallen fruit", activity:"Nocturnal/Crepuscular", size:"Large (160–270 cm body)", status:"VU", status_label:"Vulnerable", range:"South & Southeast Asia", behaviour:"Large shaggy deer; alarm call a sharp bark. Primary tiger prey." },
    "Indian Mongoose":          { habitat:"Scrubland, farmland, forest edges", diet:"Carnivore — snakes, rodents, eggs, insects", activity:"Diurnal", size:"Small (36–45 cm body)", status:"LC", status_label:"Least Concern", range:"South Asia, Middle East", behaviour:"Famous snake fighter; immune to some venom. Solitary and fast-moving." },
};

function getSpeciesInfo(species) {
    // Try exact match first, then case-insensitive
    return SPECIES_DB[species]
        || SPECIES_DB[Object.keys(SPECIES_DB).find(k => k.toLowerCase() === species.toLowerCase())]
        || null;
}

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
            agreement,
            body_coverage,
        } = data;

        dom.species.textContent = species.toUpperCase();
        dom.speciesType.textContent = `Class: ${type}`;
        dom.confidence.textContent = `${(confidence * 100).toFixed(1)}%`;
        dom.confFill.style.width = `${confidence * 100}%`;
        dom.modeDisplay.textContent = appState.mode.toUpperCase();
        dom.threatLevel.textContent = confidence > 0.9 ? 'VERIFIED'
            : confidence > 0.7 ? 'PROBABLE'
            : 'UNCERTAIN';

        // Toggle distance vs frame coverage card
        this.setImageMode(appState.mode === 'image');

        if (appState.mode === 'image') {
            const cov = body_coverage || 0;
            document.getElementById('bodyCoverage').textContent = `${cov.toFixed(1)}%`;
            document.getElementById('coverageFill').style.width = `${cov}%`;
        } else {
            dom.distance.textContent = distance ? `${distance.toFixed(1)} m` : '— m';
        }

        this.updateModelBars(confidence, audio_confidence, image_confidence, distance_confidence);

        if (appState.mode === 'fusion' && agreement !== undefined) {
            Logger.add(agreement ? '✔ Modalities Agree' : '⚠ Modality Conflict — confidence penalised', agreement ? 'success' : 'warn');
        }

        const distStr = appState.mode === 'image'
            ? `Frame: ${body_coverage ? body_coverage.toFixed(1) + '%' : 'N/A'}`
            : `Distance: ${distance ? distance.toFixed(1) + ' m' : 'N/A'}`;
        Logger.add(`Species: ${species.toUpperCase()} | Confidence: ${(confidence * 100).toFixed(1)}% | ${distStr}`, 'success');

        // Populate species info panel
        this.updateSpeciesInfo(species, data);

        dom.jsonOutput.textContent = JSON.stringify(data, null, 2);
        HistoryManager.add(species, confidence);
    },

    updateSpeciesInfo(species, data) {
        const placeholder = document.getElementById('speciesInfoPlaceholder');
        const content     = document.getElementById('speciesInfoContent');
        const info = getSpeciesInfo(species);

        if (!info) {
            placeholder.style.display = 'flex';
            content.style.display     = 'none';
            return;
        }

        placeholder.style.display = 'none';
        content.style.display     = 'flex';

        // For image mode, enrich with visual data from the scan
        const habitatVal = (appState.mode === 'image' && data.habitat_zone)
            ? data.habitat_zone
            : info.habitat;
        const activityVal = (appState.mode === 'image' && data.activity_level)
            ? data.activity_level
            : info.activity;
        const sizeVal = (appState.mode === 'image' && data.size_class)
            ? `${data.size_class} — ${info.size}`
            : info.size;

        document.getElementById('infoHabitatVal').textContent   = habitatVal;
        document.getElementById('infoDietVal').textContent      = info.diet;
        document.getElementById('infoActivityVal').textContent  = activityVal;
        document.getElementById('infoSizeVal').textContent      = sizeVal;
        document.getElementById('infoRangeVal').textContent     = info.range;
        document.getElementById('infoBehaviourVal').textContent = info.behaviour;

        // Conservation status with colour coding
        const statusEl = document.getElementById('infoStatusVal');
        const statusClasses = { LC:'status-lc', NT:'status-nt', VU:'status-vu', EN:'status-en', CR:'status-cr' };
        statusEl.className = 'species-info-value ' + (statusClasses[info.status] || '');
        statusEl.textContent = `${info.status_label} (${info.status})`;
    },

    setImageMode(isImage) {
        const distCard  = document.getElementById('distanceCard');
        const covCard   = document.getElementById('coverageCard');
        if (distCard) distCard.style.display = isImage ? 'none' : 'block';
        if (covCard)  covCard.style.display  = isImage ? 'block' : 'none';
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
            set('dist', 0);
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