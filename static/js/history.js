'use strict';

// ── Theme ─────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const icon = document.getElementById('themeIcon');
    if (icon) {
        icon.classList.toggle('fa-moon', theme !== 'dark');
        icon.classList.toggle('fa-sun',  theme === 'dark');
    }
}
applyTheme(localStorage.getItem('theme') || 'light');

const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        applyTheme(current === 'dark' ? 'light' : 'dark');
    });
}

// ── State ─────────────────────────────────────────────────────────────────────
let allRows = [];

// ── DOM refs ──────────────────────────────────────────────────────────────────
const tableLoading      = document.getElementById('tableLoading');
const histTable         = document.getElementById('histTable');
const histTableBody     = document.getElementById('histTableBody');
const tableEmpty        = document.getElementById('tableEmpty');
const filterMode        = document.getElementById('filterMode');
const filterLimit       = document.getElementById('filterLimit');
const filterUser        = document.getElementById('filterUser');   // null for non-admins
const searchSpecies     = document.getElementById('searchSpecies');
const refreshBtn        = document.getElementById('refreshBtn');
const clearDbBtn        = document.getElementById('clearDbBtn');
const topSpeciesGrid    = document.getElementById('topSpeciesGrid');
const modalOverlay      = document.getElementById('modalOverlay');
const modalClose        = document.getElementById('modalClose');
const modalSpeciesTitle = document.getElementById('modalSpeciesTitle');
const modalGrid         = document.getElementById('modalGrid');
const modalJson         = document.getElementById('modalJson');

const IS_ADMIN = !!filterUser;

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTimestamp(ts) {
    if (!ts) return '—';
    try {
        const d = new Date(ts.endsWith('Z') ? ts : ts + 'Z');
        return d.toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
    } catch { return ts; }
}

function confClass(c) {
    if (c >= 0.85) return 'high';
    if (c >= 0.70) return 'medium';
    return 'low';
}

function modeBadge(mode) {
    const icons = { audio: 'fa-headphones', image: 'fa-camera', fusion: 'fa-bolt' };
    return `<span class="mode-badge ${mode}">` +
           `<i class="fa-solid ${icons[mode] || 'fa-question'}"></i> ${mode}</span>`;
}

function typeBadge(type) {
    if (!type) return '<span class="type-badge unknown">—</span>';
    const cls = type.toLowerCase() === 'bird'   ? 'bird'
              : type.toLowerCase() === 'mammal' ? 'mammal'
              : 'unknown';
    return `<span class="type-badge ${cls}">${type}</span>`;
}

function agreementCell(row) {
    if (row.mode !== 'fusion' || row.agreement === null || row.agreement === undefined) {
        return '<span style="color:var(--text-secondary)">—</span>';
    }
    const yes = row.agreement === 1;
    return `<span class="agree-dot ${yes ? 'yes' : 'no'}"></span>${yes ? 'Agree' : 'Conflict'}`;
}

// ── Distance display helper ───────────────────────────────────────────────────
// distance is now a text range string e.g. "31–60 meters" — never a raw float.
function formatDistance(distance) {
    if (distance == null || distance === '') return '—';
    return distance; // already a formatted string
}

// ── Load Stats ────────────────────────────────────────────────────────────────
async function loadStats() {
    try {
        const res  = await fetch('/logs/stats');
        const data = await res.json();

        document.querySelector('#statTotalScans .stat-value').textContent =
            data.successful_scans ?? '—';
        document.querySelector('#statAvgConf .stat-value').textContent =
            data.avg_confidence != null
                ? (data.avg_confidence * 100).toFixed(1) + '%'
                : '—';
        document.querySelector('#statErrors .stat-value').textContent =
            data.error_count ?? '0';

        if (data.top_species && data.top_species.length > 0) {
            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
            topSpeciesGrid.innerHTML = data.top_species.map((s, i) => `
                <div class="species-card">
                    <div class="species-rank">${medals[i] || (i + 1)}</div>
                    <div class="species-card-info">
                        <div class="species-card-name">${s.species}</div>
                        <div class="species-card-count">
                            ${s.count} detection${s.count !== 1 ? 's' : ''}
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            topSpeciesGrid.innerHTML = '<div class="top-species-loading">No detections yet</div>';
        }
    } catch (e) {
        console.warn('[WLDS-9] Stats load failed:', e);
        topSpeciesGrid.innerHTML = '<div class="top-species-loading">Failed to load stats</div>';
    }
}

// ── Load Table ────────────────────────────────────────────────────────────────
async function loadTable() {
    tableLoading.style.display = 'flex';
    histTable.style.display    = 'none';
    tableEmpty.style.display   = 'none';

    let url = `/logs?limit=${filterLimit.value}`;
    if (filterMode.value)                         url += `&mode=${filterMode.value}`;
    if (IS_ADMIN && filterUser && filterUser.value) url += `&filter_user=${filterUser.value}`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        allRows = await res.json();
        console.log('[WLDS-9] /logs returned', allRows.length, 'rows');
        renderTable();
    } catch (e) {
        tableLoading.style.display = 'none';
        tableEmpty.innerHTML =
            `<i class="fa-solid fa-triangle-exclamation" style="font-size:2rem;opacity:0.4;margin-bottom:0.75rem"></i>` +
            `<div>Failed to load: ${e.message}</div>` +
            `<div style="font-size:0.75rem;margin-top:0.5rem;opacity:0.6">` +
            `Check browser console and make sure Flask is running</div>`;
        tableEmpty.style.display = 'flex';
        console.error('[WLDS-9] Table load failed:', e);
    }
}

function renderTable() {
    const search = searchSpecies.value.trim().toLowerCase();
    const rows   = search
        ? allRows.filter(r => r.species && r.species.toLowerCase().includes(search))
        : allRows;

    tableLoading.style.display = 'none';

    if (rows.length === 0) {
        histTable.style.display  = 'none';
        tableEmpty.style.display = 'flex';
        return;
    }

    tableEmpty.style.display = 'none';
    histTable.style.display  = 'table';

    histTableBody.innerHTML = rows.map(r => {
        const conf  = r.confidence ?? 0;
        const pct   = (conf * 100).toFixed(1) + '%';
        const isErr = r.is_error === 1;
        return `
        <tr class="${isErr ? 'error-row' : ''}" data-id="${r.id}">
            <td class="row-id">${r.id}</td>
            <td class="mono" style="font-size:0.75rem;white-space:nowrap">
                ${formatTimestamp(r.timestamp)}
            </td>
            <td>${modeBadge(r.mode)}</td>
            <td style="font-weight:600">
                ${r.species || (isErr ? '<span style="color:#ef4444">Error</span>' : '—')}
            </td>
            <td>${typeBadge(r.type)}</td>
            <td>
                <div class="conf-cell">
                    <div class="conf-bar-wrap">
                        <div class="conf-bar-fill ${confClass(conf)}" style="width:${conf * 100}%"></div>
                    </div>
                    <span class="conf-pct">${isErr ? '—' : pct}</span>
                </div>
            </td>
            <td class="mono">${formatDistance(r.distance)}</td>
            <td>${agreementCell(r)}</td>
            <td>
                <span class="status-badge ${isErr ? 'error' : 'ok'}">
                    ${isErr ? 'Error' : 'OK'}
                </span>
            </td>
            ${IS_ADMIN ? `<td class="col-user">
                <span class="user-tag">
                    <i class="fa-solid fa-circle-user"></i>
                    ${r.logged_by || '—'}
                </span>
            </td>` : ''}
            <td>
                <button class="detail-btn" onclick="openModal(${r.id})">
                    <i class="fa-solid fa-magnifying-glass"></i> Detail
                </button>
            </td>
        </tr>`;
    }).join('');
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(id) {
    const row = allRows.find(r => r.id === id);
    if (!row) return;

    modalSpeciesTitle.textContent = row.species || 'Detection Detail';

    let result = {};
    try {
        result = JSON.parse(row.full_result);
    } catch (e) {
        console.warn('[WLDS-9] Could not parse full_result for row', id, e);
    }

    const tiles = [
        { label: 'Species',    value: row.species || '—', highlight: true },
        { label: 'Type',       value: row.type    || '—' },
        { label: 'Mode',       value: (row.mode   || '—').toUpperCase() },
        { label: 'Confidence', value: row.confidence != null
            ? (row.confidence * 100).toFixed(1) + '%' : '—' },
        { label: 'Distance',   value: formatDistance(row.distance) },  // ← fixed: was row.distance.toFixed(1) + ' m'
        { label: 'Timestamp',  value: formatTimestamp(row.timestamp) },
    ];

    if (row.mode === 'fusion') {
        tiles.push(
            { label: 'Audio Species', value: result.audio_species || '—' },
            { label: 'Image Species', value: result.image_species || '—' },
            { label: 'Agreement',     value: row.agreement === 1 ? '✔ Agree'
                                           : row.agreement === 0 ? '⚠ Conflict' : '—' },
        );
    }
    if (row.is_error) {
        tiles.push({ label: 'Error', value: row.error_msg || '—' });
    }

    modalGrid.innerHTML = tiles.map(t => `
        <div class="modal-stat">
            <div class="modal-stat-label">${t.label}</div>
            <div class="modal-stat-value ${t.highlight ? 'highlight' : ''}">${t.value}</div>
        </div>
    `).join('');

    modalJson.textContent       = JSON.stringify(result, null, 2);
    modalOverlay.style.display  = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modalOverlay.style.display   = 'none';
    document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── Clear DB ──────────────────────────────────────────────────────────────────
if (clearDbBtn) {
    clearDbBtn.addEventListener('click', async () => {
        if (!confirm('Delete ALL detection logs from the database? This cannot be undone.')) return;
        try {
            const res  = await fetch('/logs/clear', { method: 'POST' });
            const data = await res.json();
            alert(`Cleared ${data.rows_deleted} rows.`);
            loadStats();
            loadTable();
        } catch (e) {
            alert('Clear failed: ' + e.message);
        }
    });
}

// ── Event Wiring ──────────────────────────────────────────────────────────────
refreshBtn.addEventListener('click', () => { loadStats(); loadTable(); });
filterMode.addEventListener('change',  loadTable);
filterLimit.addEventListener('change', loadTable);
if (filterUser)   filterUser.addEventListener('change',   loadTable);
searchSpecies.addEventListener('input', renderTable);

// ── Init ──────────────────────────────────────────────────────────────────────
loadStats();
loadTable();