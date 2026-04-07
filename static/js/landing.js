'use strict';

/* ═══════════════════════════════════════════════
   landing.js  —  WLDS-9 Landing Page + Auth Modal
   ═══════════════════════════════════════════════ */


/* ── Theme ────────────────────────────────────── */
(function () {
    const saved = localStorage.getItem('theme') || 'light';

    function applyTheme(t) {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('theme', t);
        const ic = document.getElementById('themeIcon');
        if (ic) {
            ic.classList.toggle('fa-moon', t !== 'dark');
            ic.classList.toggle('fa-sun',  t === 'dark');
        }
    }

    applyTheme(saved);

    const btn = document.getElementById('themeToggle');
    if (btn) btn.addEventListener('click', () => {
        applyTheme(
            document.documentElement.getAttribute('data-theme') === 'dark'
                ? 'light' : 'dark'
        );
    });
})();


/* ── Navbar scroll shrink ─────────────────────── */
const nav = document.getElementById('lnNav');
if (nav) {
    window.addEventListener('scroll', () => {
        nav.classList.toggle('ln-nav-scrolled', window.scrollY > 40);
    }, { passive: true });
}


/* ── Particle canvas ──────────────────────────── */
(function () {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, particles = [];
    const COUNT = 55;
    const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

    function resize() {
        W = canvas.width  = canvas.offsetWidth;
        H = canvas.height = canvas.offsetHeight;
    }

    function Particle() {
        this.reset = function () {
            this.x  = Math.random() * W;
            this.y  = Math.random() * H;
            this.r  = Math.random() * 1.8 + 0.4;
            this.vx = (Math.random() - 0.5) * 0.28;
            this.vy = (Math.random() - 0.5) * 0.28;
            this.a  = Math.random() * 0.55 + 0.15;
        };
        this.reset();
    }

    for (let i = 0; i < COUNT; i++) {
        const p = new Particle();
        particles.push(p);
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);
        const color = isDark() ? '103,232,249' : '6,182,212';

        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
            if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${color},${p.a})`;
            ctx.fill();
        });

        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const d  = Math.sqrt(dx * dx + dy * dy);
                if (d < 110) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(${color},${0.12 * (1 - d / 110)})`;
                    ctx.lineWidth = 0.6;
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(draw);
    }

    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas.parentElement);
    resize();
    draw();
})();


/* ── Count-up animation ───────────────────────── */
function countUp(el, target, duration) {
    let start = 0, step = target / (duration / 16);
    const run = () => {
        start = Math.min(start + step, target);
        el.textContent = Math.round(start);
        if (start < target) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
}


/* ── Intersection Observer — reveal ──────────── */
const revealEls = document.querySelectorAll('[data-reveal]');
const revealObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('ln-revealed');
            revealObs.unobserve(e.target);
        }
    });
}, { threshold: 0.1 });
revealEls.forEach(el => revealObs.observe(el));


/* ── Count-up when stats row enters view ─────── */
const statsRow = document.querySelector('.ln-stats-row');
if (statsRow) {
    const so = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
            document.querySelectorAll('.ln-stat-num[data-count]').forEach(el => {
                countUp(el, parseInt(el.dataset.count), 900);
            });
            so.disconnect();
        }
    }, { threshold: 0.5 });
    so.observe(statsRow);
}


/* ── Section AOS ──────────────────────────────── */
const aosEls = document.querySelectorAll('[data-aos]');
const aosObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('ln-aos-in');
            aosObs.unobserve(e.target);
        }
    });
}, { threshold: 0.12 });
aosEls.forEach(el => aosObs.observe(el));


/* ── Species tag stagger ──────────────────────── */
const tagEls = document.querySelectorAll('[data-aos-tag]');
const tagObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            const tags = e.target
                .closest('.ln-species-cloud')
                .querySelectorAll('[data-aos-tag]');
            tags.forEach((t, i) =>
                setTimeout(() => t.classList.add('ln-tag-in'), i * 28)
            );
            tagObs.disconnect();
        }
    });
}, { threshold: 0.1 });
if (tagEls.length) tagObs.observe(tagEls[0]);


/* ════════════════════════════════════════════════
   Auth Modal
   ════════════════════════════════════════════════ */
(function () {

    const overlay  = document.getElementById('amOverlay');
    const card     = document.getElementById('amCard');
    const btnClose = document.getElementById('amClose');
    const tabLogin = document.getElementById('amTabLogin');
    const tabReg   = document.getElementById('amTabRegister');
    const panLogin = document.getElementById('amPanelLogin');
    const panReg   = document.getElementById('amPanelRegister');
    const ink      = document.getElementById('amTabInk');

    if (!overlay) return;

    /* ── Tab ink indicator ── */
    function positionInk(tab) {
        ink.style.left  = tab.offsetLeft + 'px';
        ink.style.width = tab.offsetWidth + 'px';
    }

    /* ── Switch tab ── */
    function switchTab(which) {
        const isLogin = (which === 'login');
        tabLogin.classList.toggle('am-tab-active',  isLogin);
        tabLogin.setAttribute('aria-selected', isLogin);
        tabReg.classList.toggle('am-tab-active',  !isLogin);
        tabReg.setAttribute('aria-selected', !isLogin);
        panLogin.classList.toggle('am-panel-hidden', !isLogin);
        panReg.classList.toggle('am-panel-hidden',  isLogin);
        positionInk(isLogin ? tabLogin : tabReg);
    }

    tabLogin.addEventListener('click', () => switchTab('login'));
    tabReg.addEventListener('click',   () => switchTab('register'));

    document.querySelectorAll('.am-switch-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.targetTab));
    });

    /* ── Open / close ── */
    function openModal(tab) {
        overlay.classList.add('am-open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        switchTab(tab || 'login');
        clearModalInputs();
        requestAnimationFrame(() =>
            positionInk(tab === 'register' ? tabReg : tabLogin)
        );
        setTimeout(() => card.querySelector('.am-input')?.focus(), 260);
    }

    function closeModal() {
        overlay.classList.remove('am-open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    btnClose.addEventListener('click', closeModal);

    overlay.addEventListener('click', e => {
        if (!card.contains(e.target)) closeModal();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && overlay.classList.contains('am-open')) closeModal();
    });

    /* ── Wire all [data-modal] buttons ── */
    document.querySelectorAll('[data-modal]').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            openModal(el.dataset.modal);
        });
    });

    /* ── Auto-open if flash message present ── */
    const flash = document.querySelector('.am-flash');
    if (flash) {
        const params = new URLSearchParams(window.location.search);
        const tabHint = params.get('tab');
        const isSuccess = flash.classList.contains('am-flash-success');
        openModal(tabHint || (isSuccess ? 'login' : 'register'));
    }

    /* ── Password eye toggles ── */
    document.querySelectorAll('.am-eye').forEach(btn => {
        btn.addEventListener('click', () => {
            const inp = document.getElementById(btn.dataset.target);
            if (!inp) return;
            const show = inp.type === 'password';
            inp.type = show ? 'text' : 'password';
            btn.querySelector('i').classList.toggle('fa-eye',       !show);
            btn.querySelector('i').classList.toggle('fa-eye-slash',  show);
        });
    });

    /* ── Clear inputs helper ── */
    function clearModalInputs() {
        overlay.querySelectorAll('input').forEach(function(inp) {
            inp.value = '';
            if (inp.id) {
                var eye = overlay.querySelector('.am-eye[data-target="' + inp.id + '"]');
                if (eye) {
                    inp.type = 'password';
                    var icon = eye.querySelector('i');
                    if (icon) { icon.classList.add('fa-eye'); icon.classList.remove('fa-eye-slash'); }
                }
            }
        });
    }

})();

/* ── bfcache: clear modal fields when browser restores page from back/forward cache ── */
window.addEventListener('pageshow', function(e) {
    if (e.persisted) {
        // Page was restored from bfcache — wipe any autofilled values
        document.querySelectorAll('.am-overlay input').forEach(function(inp) {
            inp.value = '';
            if (inp.id) {
                var eye = document.querySelector('.am-eye[data-target="' + inp.id + '"]');
                if (eye) {
                    inp.type = 'password';
                    var icon = eye.querySelector('i');
                    if (icon) { icon.classList.add('fa-eye'); icon.classList.remove('fa-eye-slash'); }
                }
            }
        });
        // Also close the modal if it was left open
        var overlay = document.getElementById('amOverlay');
        if (overlay) {
            overlay.classList.remove('am-open');
            overlay.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }
    }
});