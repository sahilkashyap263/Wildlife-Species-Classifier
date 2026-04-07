'use strict';

const appState = {
    mode: 'audio',
    recordedAudioBlob: null,
    capturedImageBlob: null,
    cameraStream:      null,
    isRecording:       false,
    isScanning:        false,
    startTime:         Date.now(),
    scanCount:         0,
};

const dom = (() => {
    const $ = id => document.getElementById(id);
    return {
        audioFile:       $('audioFile'),
        imageFile:       $('imageFile'),
        audioPreview:    $('audioPreview'),
        cameraPreview:   $('cameraPreview'),
        photoCanvas:     $('photoCanvas'),
        waveformCanvas:  $('waveformCanvas'),
        recordBtn:       $('recordBtn'),
        recordProgress:  $('recordProgress'),
        recordFill:      $('recordFill'),
        recordIcon:      $('recordIcon'),
        recordText:      $('recordText'),
        openCameraBtn:   $('openCameraBtn'),
        captureBtn:      $('captureBtn'),
        stopCameraBtn:   $('stopCameraBtn'),
        analyzeBtn:      $('analyzeBtn'),
        analyzeBtnText:  $('analyzeBtnText'),
        species:         $('species'),
        speciesType:     $('speciesType'),
        confidence:      $('confidence'),
        confFill:        $('confFill'),
        distance:        $('distance'),
        modeDisplay:     $('modeDisplay'),
        threatLevel:     $('threatLevel'),
        scanStatus:      $('scanStatus'),
        logFeed:         $('logFeed'),
        jsonOutput:      null,   // removed from UI
        clearLogs:       $('clearLogs'),
        uptime:          $('uptime'),
        scanCount:       $('scanCount'),
        audioSection:    $('audioSection'),
        imageSection:    $('imageSection'),
        cameraIdle:      $('cameraIdle'),
        sensorsWrapper:  $('sensorsWrapper'),
        audioFill:       $('audioFill'),
        imageFill:       $('imageFill'),
        distFill:        $('distFill'),
        fusionFill:      $('fusionFill'),
        audioPct:        $('audioPct'),
        imagePct:        $('imagePct'),
        distPct:         $('distPct'),
        fusionPct:       $('fusionPct'),
        themeToggle:     $('themeToggle'),
        themeIcon:       $('themeIcon'),
        copyJson:        null,   // removed from UI
    };
})();

const ThemeManager = {
    init() {
        const saved = localStorage.getItem('theme') || 'light';
        this.setTheme(saved);
        dom.themeToggle.addEventListener('click', () => this.toggle());
    },
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        dom.themeIcon.classList.toggle('fa-moon', theme !== 'dark');
        dom.themeIcon.classList.toggle('fa-sun',  theme === 'dark');
    },
    toggle() {
        const current = document.documentElement.getAttribute('data-theme');
        this.setTheme(current === 'dark' ? 'light' : 'dark');
    },
};

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
    },
};

const WaveformVisualizer = {
    ctx:    null,
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
        this.ctx.strokeStyle = 'rgba(6,182,212,0.15)';
        this.ctx.lineWidth = 0.5;
        for (let y = 0; y <= height; y += height / 4) {
            this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(width, y); this.ctx.stroke();
        }
        this.points.shift();
        const amplitude = this.active
            ? (Math.random() * 0.7 + 0.1) * mid * 0.9
            : Math.random() * 2;
        this.points.push(amplitude);
        const step = width / (this.points.length - 1);
        this.ctx.beginPath();
        this.ctx.moveTo(0, mid);
        this.points.forEach((pt, i) => { this.ctx.lineTo(i * step, mid + (i % 2 === 0 ? pt : -pt)); });
        this.ctx.strokeStyle = this.active ? '#06b6d4' : 'rgba(100,116,139,0.55)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        requestAnimationFrame(() => this.draw());
    },
};

const ModeManager = {
    init() {
        document.querySelectorAll('.mode-card').forEach(card => {
            card.addEventListener('click', () => this.switchMode(card));
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
        const isAudio  = appState.mode === 'audio';
        const isImage  = appState.mode === 'image';
        const isFusion = appState.mode === 'fusion';
        dom.sensorsWrapper.classList.toggle('fusion-sensors-grid', isFusion);
        dom.audioSection.style.display = (isAudio || isFusion) ? 'block' : 'none';
        dom.imageSection.style.display = (isImage || isFusion) ? 'block' : 'none';
        Logger.add(`Mode switched to ${appState.mode.toUpperCase()}`);
        ResultsHandler.setImageMode(isImage);
        document.getElementById('speciesInfoPlaceholder').style.display = 'flex';
        document.getElementById('speciesInfoContent').style.display     = 'none';
    },
};

const RECORD_DURATION_MS = 15_000;

const AudioRecorder = {
    mediaRecorder: null,
    audioChunks:   [],
    init() { dom.recordBtn.addEventListener('click', () => this.toggleRecording()); },
    async toggleRecording() {
        if (appState.isRecording) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks   = [];
            this.mediaRecorder.ondataavailable = e => this.audioChunks.push(e.data);
            this.mediaRecorder.onstop          = () => this.handleStop(stream);
            this.mediaRecorder.start();
            this._startUI();
        } catch { Logger.add('Microphone access denied', 'error'); }
    },
    _startUI() {
        appState.isRecording = true;
        WaveformVisualizer.setActive(true);
        dom.recordBtn.classList.add('recording');
        dom.recordIcon.classList.replace('fa-microphone', 'fa-circle');
        dom.recordText.textContent       = 'Recording…';
        dom.recordProgress.style.display = 'block';
        Logger.add('Recording acoustic sample…', 'warn');
        let elapsed = 0;
        const interval = setInterval(() => {
            elapsed += 100;
            dom.recordFill.style.width = `${(elapsed / RECORD_DURATION_MS) * 100}%`;
            if (elapsed >= RECORD_DURATION_MS) clearInterval(interval);
        }, 100);
        setTimeout(() => this.mediaRecorder.stop(), RECORD_DURATION_MS);
    },
    handleStop(stream) {
        appState.recordedAudioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        dom.audioPreview.src        = URL.createObjectURL(appState.recordedAudioBlob);
        stream.getTracks().forEach(t => t.stop());
        appState.isRecording = false;
        WaveformVisualizer.setActive(false);
        dom.recordBtn.classList.remove('recording');
        dom.recordIcon.classList.replace('fa-circle', 'fa-microphone');
        dom.recordText.textContent       = 'Record 15s Sample';
        dom.recordProgress.style.display = 'none';
        dom.audioPreview.style.display   = 'block';
        Logger.add('Audio sample captured (15 s)', 'success');
    },
};

const FileHandlers = {
    init() {
        dom.audioFile.addEventListener('change', () => this.handleAudioFile());
        dom.imageFile.addEventListener('change', () => this.handleImageFile());
    },
    handleAudioFile() {
        const file = dom.audioFile.files[0];
        if (!file) return;
        dom.audioPreview.src           = URL.createObjectURL(file);
        dom.audioPreview.style.display = 'block';
        WaveformVisualizer.setActive(true);
        setTimeout(() => WaveformVisualizer.setActive(false), 2000);
        Logger.add(`Audio file loaded: ${file.name}`, 'success');
    },
    handleImageFile() {
        const file = dom.imageFile.files[0];
        if (!file) return;
        const img  = new Image();
        const url  = URL.createObjectURL(file);
        img.onload = () => {
            dom.photoCanvas.width  = img.width;
            dom.photoCanvas.height = img.height;
            dom.photoCanvas.getContext('2d').drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
        };
        img.src = url;
        dom.photoCanvas.style.display   = 'block';
        dom.cameraPreview.style.display = 'none';
        dom.cameraIdle.style.display    = 'none';
        if (appState.cameraStream) CameraHandler.stopCamera();
        appState.capturedImageBlob = file;
        Logger.add(`Image file loaded: ${file.name}`, 'success');
    },
};

const CameraHandler = {
    init() {
        dom.openCameraBtn.addEventListener('click', () => this.openCamera());
        dom.captureBtn.addEventListener('click',    () => this.capturePhoto());
        dom.stopCameraBtn.addEventListener('click', () => this.stopCamera());
    },
    async openCamera() {
        if (appState.cameraStream) return;
        try {
            appState.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
            dom.cameraPreview.srcObject     = appState.cameraStream;
            dom.cameraPreview.style.display = 'block';
            dom.photoCanvas.style.display   = 'none';
            dom.cameraIdle.style.display    = 'none';
            dom.stopCameraBtn.style.display = 'flex';
            dom.openCameraBtn.innerHTML     = '<i class="fa-solid fa-video"></i> Camera Live';
            dom.openCameraBtn.disabled      = true;
            dom.openCameraBtn.style.opacity = '0.5';
            Logger.add('Camera activated', 'success');
        } catch { Logger.add('Camera access denied', 'error'); }
    },
    capturePhoto() {
        if (!appState.cameraStream) { Logger.add('Open camera first', 'warn'); return; }
        const v = dom.cameraPreview;
        const c = dom.photoCanvas;
        c.width  = v.videoWidth;
        c.height = v.videoHeight;
        c.getContext('2d').drawImage(v, 0, 0);
        c.style.display = 'block';
        c.toBlob(blob => { appState.capturedImageBlob = blob; }, 'image/jpeg');
        Logger.add('Photo captured — camera stopped automatically', 'success');
        this.stopCamera();
    },
    stopCamera() {
        if (!appState.cameraStream) return;
        appState.cameraStream.getTracks().forEach(t => t.stop());
        appState.cameraStream           = null;
        dom.cameraPreview.srcObject     = null;
        dom.cameraPreview.style.display = 'none';
        if (!appState.capturedImageBlob) {
            dom.cameraIdle.style.display  = 'flex';
            dom.photoCanvas.style.display = 'none';
        }
        dom.stopCameraBtn.style.display = 'none';
        dom.openCameraBtn.innerHTML     = '<i class="fa-solid fa-video"></i> Open Camera';
        dom.openCameraBtn.disabled      = false;
        dom.openCameraBtn.style.opacity = '1';
        Logger.add('Camera stopped', 'warn');
    },
};

const Analyzer = {
    init() { dom.analyzeBtn.addEventListener('click', () => this.runScan()); },
    async runScan() {
        if (appState.isScanning) return;
        this._startScan();
        try {
            const res = await fetch(`/analyze/${appState.mode}`, {
                method: 'POST', body: this._buildFormData(),
            });
            if (!res.ok) throw new Error(`Server error ${res.status}`);
            const data = await res.json();
            if (data.error) { Logger.add(`Engine error: ${data.error}`, 'error'); }
            else { ResultsHandler.display(data); }
        } catch (err) {
            Logger.add(`Connection error: ${err.message}`, 'error');
        } finally {
            this._endScan();
        }
    },
    _startScan() {
        appState.isScanning = true;
        appState.scanCount++;
        dom.scanCount.textContent      = appState.scanCount;
        dom.analyzeBtn.classList.add('scanning');
        dom.analyzeBtnText.textContent = 'Scanning…';
        dom.scanStatus.textContent     = 'SCANNING';
        WaveformVisualizer.setActive(true);
        Logger.add(`Scan #${appState.scanCount} — Mode: ${appState.mode.toUpperCase()}`, 'warn');
    },
    _endScan() {
        appState.isScanning = false;
        dom.analyzeBtn.classList.remove('scanning');
        dom.analyzeBtnText.textContent = 'Initiate Scan';
        dom.scanStatus.textContent     = 'COMPLETE';
        WaveformVisualizer.setActive(false);
    },
    _buildFormData() {
        const fd  = new FormData();
        const af  = dom.audioFile.files[0];
        const imf = dom.imageFile.files[0];
        if (af)                              fd.append('audio', af);
        else if (appState.recordedAudioBlob) fd.append('audio', appState.recordedAudioBlob, 'recorded.webm');
        if (imf)                             fd.append('image', imf);
        else if (appState.capturedImageBlob) fd.append('image', appState.capturedImageBlob, 'captured.jpg');
        return fd;
    },
};

const SPECIES_DB = {
    "American Pipit":           { habitat:"Open fields, tundra, beaches", diet:"Insectivore — insects and seeds", activity:"Diurnal", size:"Small (15–17 cm)", status:"LC", status_label:"Least Concern", range:"North America, Central America", behaviour:"Bobs tail constantly while walking. Migrates in large flocks." },
    "Frog":                     { habitat:"Wetlands, ponds, rainforests", diet:"Insectivore — insects, worms, small invertebrates", activity:"Nocturnal/Crepuscular", size:"Small (2–30 cm)", status:"LC", status_label:"Least Concern", range:"Worldwide except Antarctica", behaviour:"Amphibious. Males call loudly to attract females near water." },
    "Cow":                      { habitat:"Grasslands, farmland", diet:"Herbivore — grass, hay, grain", activity:"Diurnal", size:"Large (200–300 cm body)", status:"LC", status_label:"Domesticated", range:"Worldwide (domesticated)", behaviour:"Social herd animal. Ruminant — chews cud. Highly vocal." },
    "Wolf / Dog":               { habitat:"Forests, grasslands, tundra, urban areas", diet:"Carnivore/Omnivore — meat, vegetables, scraps", activity:"Diurnal/Nocturnal", size:"Medium (60–160 cm body)", status:"LC", status_label:"Least Concern", range:"Worldwide", behaviour:"Highly social pack animal. Communicates via howling and barking." },
    "Northern Cardinal":        { habitat:"Woodlands, gardens, shrublands", diet:"Granivore — seeds, fruits, insects", activity:"Diurnal", size:"Small (21–23 cm)", status:"LC", status_label:"Least Concern", range:"North and Central America", behaviour:"Males are bright red. Both sexes sing. Non-migratory." },
    "European Goldfinch":       { habitat:"Open woodland, gardens, farmland", diet:"Granivore — seeds especially thistle", activity:"Diurnal", size:"Small (12–13 cm)", status:"LC", status_label:"Least Concern", range:"Europe, North Africa, Western Asia", behaviour:"Highly social. Forms large flocks in winter. Melodic song." },
    "Monkey":                   { habitat:"Tropical and subtropical forests", diet:"Omnivore — fruits, leaves, insects, small animals", activity:"Diurnal", size:"Small to Large (varies by species)", status:"VU", status_label:"Vulnerable", range:"Africa, Asia, Central and South America", behaviour:"Highly social. Lives in troops. Uses vocalisations and gestures." },
    "Black-billed Cuckoo":      { habitat:"Deciduous forests, thickets near water", diet:"Insectivore — caterpillars, insects", activity:"Diurnal", size:"Small (28–32 cm)", status:"LC", status_label:"Least Concern", range:"North America, South America", behaviour:"Secretive. Known for eating hairy caterpillars other birds avoid." },
    "Pacific-slope Flycatcher": { habitat:"Moist forests, canyons near streams", diet:"Insectivore — flying insects", activity:"Diurnal", size:"Small (13–15 cm)", status:"LC", status_label:"Least Concern", range:"Western North America", behaviour:"Catches insects mid-air. Distinctive upslurred call note." },
    "Fish Crow":                { habitat:"Coastal areas, rivers, urban areas", diet:"Omnivore — fish, eggs, garbage, fruit", activity:"Diurnal", size:"Small (36–41 cm)", status:"LC", status_label:"Least Concern", range:"Eastern United States", behaviour:"Highly opportunistic. Often found near water. Nasal call." },
    "Bobolink":                 { habitat:"Grasslands, meadows, agricultural fields", diet:"Granivore/Insectivore — seeds and insects", activity:"Diurnal", size:"Small (16–18 cm)", status:"LC", status_label:"Least Concern", range:"North America, South America", behaviour:"Long-distance migrant. Males have striking black and white plumage." },
    "Gray Catbird":             { habitat:"Dense shrubs, woodland edges, gardens", diet:"Omnivore — insects, berries, fruit", activity:"Diurnal", size:"Small (21–24 cm)", status:"LC", status_label:"Least Concern", range:"North and Central America", behaviour:"Named for cat-like mewing call. Excellent mimic." },
    "Asian Elephant":           { habitat:"Tropical forests, grasslands, scrublands", diet:"Herbivore — grass, bark, fruit, roots", activity:"Diurnal/Nocturnal", size:"Apex (550–640 cm body)", status:"EN", status_label:"Endangered", range:"South and Southeast Asia", behaviour:"Highly intelligent. Lives in matriarchal herds. Strong family bonds." },
    "Donkey":                   { habitat:"Arid and semi-arid regions, farmland", diet:"Herbivore — grass, hay, shrubs", activity:"Diurnal", size:"Medium (100–130 cm shoulder)", status:"LC", status_label:"Domesticated", range:"Worldwide (domesticated)", behaviour:"Sure-footed and hardy. Loud bray call. Used as working animal." },
    "Horse":                    { habitat:"Grasslands, plains, farmland", diet:"Herbivore — grass, hay, grain", activity:"Diurnal", size:"Large (150–180 cm shoulder)", status:"LC", status_label:"Domesticated", range:"Worldwide (domesticated)", behaviour:"Social herd animal. Fast runner. Communicates via neighing and body language." },
    "Rusty Blackbird":          { habitat:"Boreal wetlands, swamps, flooded forests", diet:"Omnivore — insects, seeds, small vertebrates", activity:"Diurnal", size:"Small (22–25 cm)", status:"VU", status_label:"Vulnerable", range:"North America", behaviour:"Declining species. Forages by flipping leaf litter in shallow water." },
    "Brewer's Blackbird":       { habitat:"Open areas, parks, farmland, urban areas", diet:"Omnivore — seeds, insects, scraps", activity:"Diurnal", size:"Small (20–25 cm)", status:"LC", status_label:"Least Concern", range:"Western North America", behaviour:"Bold and adaptable. Often seen near human settlements." },
    "Cat":                      { habitat:"Urban areas, forests, grasslands", diet:"Carnivore — small mammals, birds, insects", activity:"Crepuscular/Nocturnal", size:"Small (46–51 cm body)", status:"LC", status_label:"Domesticated", range:"Worldwide (domesticated)", behaviour:"Solitary hunter. Territorial. Communicates via meowing, purring, hissing." },
    "Chicken":                  { habitat:"Farmland, urban areas", diet:"Omnivore — seeds, insects, scraps", activity:"Diurnal", size:"Small (35–45 cm body)", status:"LC", status_label:"Domesticated", range:"Worldwide (domesticated)", behaviour:"Social flock animal. Roosting at night. Males crow at dawn." },
    "Purple Finch":             { habitat:"Coniferous and mixed forests, gardens", diet:"Granivore — seeds, buds, berries", activity:"Diurnal", size:"Small (12–15 cm)", status:"LC", status_label:"Least Concern", range:"North America", behaviour:"Males are raspberry-red. Rich warbling song. Irruptive migrant." },
    "Yellow-breasted Chat":     { habitat:"Dense shrubs, thickets, woodland edges", diet:"Omnivore — insects, berries, fruit", activity:"Diurnal", size:"Small (17–19 cm)", status:"LC", status_label:"Least Concern", range:"North and Central America", behaviour:"Largest wood-warbler. Loud, varied, chattering song." },
    "Orchard Oriole":           { habitat:"Open woodlands, orchards, riparian areas", diet:"Omnivore — insects, nectar, fruit", activity:"Diurnal", size:"Small (15–18 cm)", status:"LC", status_label:"Least Concern", range:"North and Central America", behaviour:"Smallest North American oriole. Weaves hanging nest." },
    "California Gull":          { habitat:"Coastal areas, lakes, farmland, urban areas", diet:"Omnivore — fish, insects, garbage, eggs", activity:"Diurnal", size:"Medium (46–55 cm)", status:"LC", status_label:"Least Concern", range:"Western North America", behaviour:"Opportunistic feeder. Follows farm equipment for disturbed insects." },
    "Gray-crowned Rosy-Finch":  { habitat:"Alpine and subalpine zones, rocky terrain", diet:"Granivore — seeds, insects on snowfields", activity:"Diurnal", size:"Small (14–16 cm)", status:"LC", status_label:"Least Concern", range:"Western North America", behaviour:"One of the highest-altitude breeding birds. Forms large winter flocks." },
    "Great Crested Flycatcher": { habitat:"Deciduous forests, woodland edges", diet:"Insectivore — large insects, berries", activity:"Diurnal", size:"Small (17–21 cm)", status:"LC", status_label:"Least Concern", range:"North and Central America", behaviour:"Nests in tree cavities. Known for using shed snakeskin in nest." },
    "Sheep":                    { habitat:"Grasslands, mountains, farmland", diet:"Herbivore — grass, shrubs, hay", activity:"Diurnal", size:"Medium (120–180 cm body)", status:"LC", status_label:"Domesticated", range:"Worldwide (domesticated)", behaviour:"Social flock animal. Ruminant. Communicates via bleating." },
    "Lion":                     { habitat:"Savanna, grasslands, open woodland", diet:"Apex carnivore — wildebeest, zebra, buffalo", activity:"Crepuscular/Nocturnal", size:"Apex (170–250 cm body)", status:"VU", status_label:"Vulnerable", range:"Sub-Saharan Africa, small population in India", behaviour:"Only social big cat. Lives in prides. Males have iconic mane." },
    "House Sparrow":            { habitat:"Urban areas, farmland, woodland edges", diet:"Granivore — seeds, grain, scraps", activity:"Diurnal", size:"Small (14–16 cm)", status:"LC", status_label:"Least Concern", range:"Worldwide (introduced)", behaviour:"Highly adaptable. Closely associated with human settlements." },
    "Painted Bunting":          { habitat:"Dense brush, woodland edges, gardens", diet:"Granivore/Insectivore — seeds and insects", activity:"Diurnal", size:"Small (12–14 cm)", status:"LC", status_label:"Least Concern", range:"North and Central America", behaviour:"Males are strikingly multicoloured. Secretive despite bright plumage." },
    "Indigo Bunting":           { habitat:"Open woodland, fields, roadsides", diet:"Granivore/Insectivore — seeds and insects", activity:"Diurnal", size:"Small (11–13 cm)", status:"LC", status_label:"Least Concern", range:"North and Central America", behaviour:"Males brilliant blue. Migrates at night using stars for navigation." },
    "Eastern Towhee":           { habitat:"Dense undergrowth, woodland edges, thickets", diet:"Omnivore — seeds, insects, berries", activity:"Diurnal", size:"Small (17–23 cm)", status:"LC", status_label:"Least Concern", range:"Eastern North America", behaviour:"Scratches leaf litter with both feet simultaneously to find food." },
    "Bank Swallow":             { habitat:"Open areas near water, sandy cliffs, riverbanks", diet:"Insectivore — aerial insects", activity:"Diurnal", size:"Small (12–15 cm)", status:"LC", status_label:"Least Concern", range:"Worldwide except Australia and Antarctica", behaviour:"Nests in burrows in sandy banks. Migrates in large flocks." },
    "Ovenbird":                 { habitat:"Mature deciduous forests", diet:"Insectivore — insects, worms, snails", activity:"Diurnal", size:"Small (11–16 cm)", status:"LC", status_label:"Least Concern", range:"North and Central America", behaviour:"Walks on forest floor. Builds domed oven-shaped nest on ground." },
    "Rufous Hummingbird":       { habitat:"Open forest, mountain meadows, gardens", diet:"Nectarivore — nectar, small insects", activity:"Diurnal", size:"Small (7–9 cm)", status:"LC", status_label:"Least Concern", range:"Western North America", behaviour:"Extremely aggressive for its size. Long-distance migrant. Hovers at flowers." },
    "Bear":                     { habitat:"Forests, mountains, tundra, coastal areas", diet:"Omnivore — berries, fish, insects, small mammals", activity:"Diurnal/Crepuscular", size:"Large (120–280 cm body)", status:"LC", status_label:"Least Concern", range:"North America, Europe, Asia", behaviour:"Solitary. Hibernates in winter. Excellent swimmer and climber." },
};

function getSpeciesInfo(species) {
    if (!species) return null;
    return SPECIES_DB[species]
        || SPECIES_DB[Object.keys(SPECIES_DB).find(k => k.toLowerCase() === species.toLowerCase())]
        || null;
}

const ResultsHandler = {
    display(data) {
        const {
            species = 'UNKNOWN', type = '—', confidence = 0,
            distance = null, audio_confidence, image_confidence,
            agreement, body_coverage,
        } = data;
        // NOTE: distance_confidence removed — no longer returned by distance_engine

        dom.species.textContent     = species.toUpperCase();
        dom.speciesType.textContent = `Class: ${type}`;
        dom.confidence.textContent  = `${(confidence * 100).toFixed(1)}%`;
        dom.confFill.style.width    = `${confidence * 100}%`;
        dom.modeDisplay.textContent = appState.mode.toUpperCase();
        dom.threatLevel.textContent = confidence > 0.9 ? 'VERIFIED'
            : confidence > 0.7 ? 'PROBABLE' : 'UNCERTAIN';

        const isImage = appState.mode === 'image';
        this.setImageMode(isImage);

        if (isImage) {
            const cov       = body_coverage || 0;
            const bodyCovEl = document.getElementById('bodyCoverage');
            const covFillEl = document.getElementById('coverageFill');
            if (bodyCovEl) bodyCovEl.textContent = `${cov.toFixed(1)}%`;
            if (covFillEl) covFillEl.style.width = `${cov}%`;
        } else {
            // distance is now a range string e.g. "31–60 meters" — display directly
            dom.distance.textContent = distance || '—';
        }

        this._updateModelBars(confidence, audio_confidence, image_confidence);

        if (appState.mode === 'fusion' && agreement !== undefined) {
            Logger.add(
                agreement ? '✔ Modalities Agree' : '⚠ Modality Conflict — confidence penalised',
                agreement ? 'success' : 'warn',
            );
        }

        // distance is a string range — use directly, no toFixed()
        const distStr = isImage
            ? `Frame: ${body_coverage ? body_coverage.toFixed(1) + '%' : 'N/A'}`
            : `Distance: ${distance || 'N/A'}`;
        Logger.add(
            `Species: ${species.toUpperCase()} | Conf: ${(confidence * 100).toFixed(1)}% | ${distStr}`,
            'success',
        );

        this._updateSpeciesInfo(species, data);
    },

    _updateSpeciesInfo(species, data) {
        const placeholder = document.getElementById('speciesInfoPlaceholder');
        const content     = document.getElementById('speciesInfoContent');
        if (!placeholder || !content) return;
        const info = getSpeciesInfo(species);
        if (!info) { placeholder.style.display = 'flex'; content.style.display = 'none'; return; }
        placeholder.style.display = 'none';
        content.style.display     = 'flex';
        const isImage     = appState.mode === 'image';
        const habitatVal  = (isImage && data.habitat_zone)   ? data.habitat_zone   : info.habitat;
        const activityVal = (isImage && data.activity_level) ? data.activity_level : info.activity;
        const sizeVal     = (isImage && data.size_class)     ? `${data.size_class} — ${info.size}` : info.size;
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('infoHabitatVal',   habitatVal);
        set('infoDietVal',      info.diet);
        set('infoActivityVal',  activityVal);
        set('infoSizeVal',      sizeVal);
        set('infoRangeVal',     info.range);
        set('infoBehaviourVal', info.behaviour);
        const statusEl = document.getElementById('infoStatusVal');
        if (statusEl) {
            const cls = { LC:'status-lc', NT:'status-nt', VU:'status-vu', EN:'status-en', CR:'status-cr' };
            statusEl.className   = `species-info-value ${cls[info.status] || ''}`;
            statusEl.textContent = `${info.status_label} (${info.status})`;
        }
    },

    setImageMode(isImage) {
        const distCard = document.getElementById('distanceCard');
        const covCard  = document.getElementById('coverageCard');
        if (distCard) distCard.style.display = isImage ? 'none'  : 'block';
        if (covCard)  covCard.style.display  = isImage ? 'block' : 'none';
    },

    _updateModelBars(c, ac, ic) {
        // distance_confidence removed from signature — use species confidence as proxy
        const set = (model, pct) => {
            const p = Math.min(100, (pct || 0) * 100);
            dom[`${model}Fill`].style.width = `${p}%`;
            dom[`${model}Pct`].textContent  = `${p.toFixed(0)}%`;
        };
        if (appState.mode === 'audio') {
            set('audio', ac || c); set('image', 0); set('dist', c * 0.76); set('fusion', 0);
        } else if (appState.mode === 'image') {
            set('audio', 0); set('image', ic || c); set('dist', 0); set('fusion', 0);
        } else {
            set('audio', ac || c * 0.87); set('image', ic || c * 0.91);
            set('dist', c * 0.76);        set('fusion', c);
        }
    },
};

const Logger = {
    add(message, type = 'info') {
        const time  = new Date().toTimeString().slice(0, 8);
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.innerHTML =
            `<span class="log-time">${time}</span>` +
            `<span class="log-msg">${message}</span>`;
        dom.logFeed.appendChild(entry);
        dom.logFeed.scrollTop = dom.logFeed.scrollHeight;
    },
    clear() {
        dom.logFeed.innerHTML = '';
        this.add('Logs cleared');
    },
};

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
    Logger.add('WLDS-9 System Online — Backend connected', 'success');
    console.log('%c WLDS-9 System Online', 'color:#06b6d4;font-size:16px;font-weight:bold');
});