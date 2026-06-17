import { Idiomorph } from './vendor/idiomorph.esm.js';

// Bump both of these (and src/sw.js's CACHE string) on every change to a static
// frontend file, so the footer reflects what's actually deployed — see CLAUDE.md.
const APP_VERSION = 'v10';
const APP_UPDATED = '2026-06-17 18:00 UTC';

// Patches `el`'s children to match `html` instead of destroying/rebuilding the
// subtree (avoids image re-decode flicker and restarting in-flight CSS animations
// on every poll). Render functions still build plain HTML strings as before.
function morphInto(el, html) {
  Idiomorph.morph(el, html, { morphStyle: 'innerHTML' });
}

// ===== STATE =====
const state = {
  matches: [],
  standings: {},
  combinations: {},
  fifaRankings: {},
  liveMode: false,
  currentView: 'dashboard',
  teamFilter: null,
  lastUpdated: null,
  fdLastUpdated: null,
  tickInterval: null,
  syncInterval: null,
  espnInterval: null,
  espnSynced: false,
  _espnFetchInFlight: false,
  _dataFetchInFlight: false,
  // Notification tracking
  _seenMatchStart: new Set(),   // matchNum
  _seenGoalEvents: new Set(),   // matchNum:homeEventCount:awayEventCount (event-based, fires before score)
  _seenMatchEnd: new Set(),     // matchNum
  _audioArmed: false,
  _audioCtx: null,
  _notifQueue: [],
  _notifActive: false,
  _espnDateCache: {},   // YYYYMMDD → events[]
  espnError: false,
};

// ===== TEAM DATA =====
const TEAM_MASTER_DATA = {
  "Mexico":             { group: "A", iso: "mx",       espnId: 203,   fifaRank: 14 },
  "South Africa":       { group: "A", iso: "za",       espnId: 467,   fifaRank: 60 },
  "South Korea":        { group: "A", iso: "kr",       espnId: 451,   fifaRank: 25 },
  "Czechia":            { group: "A", iso: "cz",       espnId: 450,   fifaRank: 40 },
  "Canada":             { group: "B", iso: "ca",       espnId: 206,   fifaRank: 30 },
  "Bosnia-Herzegovina": { group: "B", iso: "ba",       espnId: 452,   fifaRank: 64 },
  "Qatar":              { group: "B", iso: "qa",       espnId: 4398,  fifaRank: 56 },
  "Switzerland":        { group: "B", iso: "ch",       espnId: 475,   fifaRank: 19 },
  "Brazil":             { group: "C", iso: "br",       espnId: 205,   fifaRank: 6  },
  "Morocco":            { group: "C", iso: "ma",       espnId: 2869,  fifaRank: 7  },
  "Haiti":              { group: "C", iso: "ht",       espnId: 2654,  fifaRank: 83 },
  "Scotland":           { group: "C", iso: "scotland", espnId: 580,   fifaRank: 42 },
  "United States":      { group: "D", iso: "us",       espnId: 660,   fifaRank: 17 },
  "Paraguay":           { group: "D", iso: "py",       espnId: 210,   fifaRank: 41 },
  "Australia":          { group: "D", iso: "au",       espnId: 628,   fifaRank: 27 },
  "Turkey":             { group: "D", iso: "tr",       espnId: 465,   fifaRank: 22 },
  "Germany":            { group: "E", iso: "de",       espnId: 481,   fifaRank: 10 },
  "Curaçao":            { group: "E", iso: "cw",       espnId: 11678, fifaRank: 82 },
  "Ivory Coast":        { group: "E", iso: "ci",       espnId: 4789,  fifaRank: 33 },
  "Ecuador":            { group: "E", iso: "ec",       espnId: 209,   fifaRank: 23 },
  "Netherlands":        { group: "F", iso: "nl",       espnId: 449,   fifaRank: 8  },
  "Japan":              { group: "F", iso: "jp",       espnId: 627,   fifaRank: 18 },
  "Sweden":             { group: "F", iso: "se",       espnId: 466,   fifaRank: 38 },
  "Tunisia":            { group: "F", iso: "tn",       espnId: 659,   fifaRank: 45 },
  "Belgium":            { group: "G", iso: "be",       espnId: 459,   fifaRank: 9  },
  "Egypt":              { group: "G", iso: "eg",       espnId: 2620,  fifaRank: 29 },
  "Iran":               { group: "G", iso: "ir",       espnId: 469,   fifaRank: 20 },
  "New Zealand":        { group: "G", iso: "nz",       espnId: 2666,  fifaRank: 85 },
  "Saudi Arabia":       { group: "H", iso: "sa",       espnId: 655,   fifaRank: 61 },
  "Uruguay":            { group: "H", iso: "uy",       espnId: 212,   fifaRank: 16 },
  "Spain":              { group: "H", iso: "es",       espnId: 164,   fifaRank: 2  },
  "Cape Verde Islands": { group: "H", iso: "cv",       espnId: 2597,  fifaRank: 67 },
  "France":             { group: "I", iso: "fr",       espnId: 478,   fifaRank: 3  },
  "Senegal":            { group: "I", iso: "sn",       espnId: 654,   fifaRank: 15 },
  "Iraq":               { group: "I", iso: "iq",       espnId: 4375,  fifaRank: 57 },
  "Norway":             { group: "I", iso: "no",       espnId: 464,   fifaRank: 31 },
  "Argentina":          { group: "J", iso: "ar",       espnId: 202,   fifaRank: 1  },
  "Algeria":            { group: "J", iso: "dz",       espnId: 624,   fifaRank: 28 },
  "Austria":            { group: "J", iso: "at",       espnId: 474,   fifaRank: 24 },
  "Jordan":             { group: "J", iso: "jo",       espnId: 2917,  fifaRank: 63 },
  "Portugal":           { group: "K", iso: "pt",       espnId: 482,   fifaRank: 5  },
  "Congo DR":           { group: "K", iso: "cd",       espnId: 2850,  fifaRank: 46 },
  "Uzbekistan":         { group: "K", iso: "uz",       espnId: 2570,  fifaRank: 50 },
  "Colombia":           { group: "K", iso: "co",       espnId: 208,   fifaRank: 13 },
  "England":            { group: "L", iso: "england",  espnId: 448,   fifaRank: 4  },
  "Croatia":            { group: "L", iso: "hr",       espnId: 477,   fifaRank: 11 },
  "Ghana":              { group: "L", iso: "gh",       espnId: 4469,  fifaRank: 73 },
  "Panama":             { group: "L", iso: "pa",       espnId: 2659,  fifaRank: 34 },
};

// Maps 3rd-place slot code → which 1st-place group runner they face
const SLOT_TO_OPPONENT = {
  "3CEFHI": "1A",
  "3EFGIJ": "1B",
  "3BEFIJ": "1D",
  "3ABCDF": "1E",
  "3AEHIJ": "1G",
  "3CDFGH": "1I",
  "3DEIJL": "1K",
  "3EHIJK": "1L"
};

// ===== NOTIFICATIONS & ANIMATIONS =====

// Arm audio on first user gesture (browser autoplay policy)
function armAudio() {
  if (state._audioArmed) return;
  state._audioArmed = true;
  // Preload audio elements
  state._audioEls = {
    whistle:         Object.assign(new Audio('./sounds/whistle.mp3'),        { preload: 'auto', volume: 0.25 }),
    cheer:           Object.assign(new Audio('./sounds/cheer.mp3'),           { preload: 'auto', volume: 0.25 }),
    double_whistle:  Object.assign(new Audio('./sounds/double-whistle.mp3'), { preload: 'auto', volume: 0.25 }),
  };
  // Also prime a Web Audio context as fallback (in case files fail)
  try { state._audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
}
document.addEventListener('click', armAudio, { once: true });
document.addEventListener('keydown', armAudio, { once: true });

function playSound(type) {
  if (!state._audioArmed) return;
  const el = state._audioEls?.[type];
  if (el) {
    el.currentTime = 0;
    el.play().catch(() => {}); // ignore if blocked
    return;
  }
  // Fallback: synthesize if file not available
  _playSynthSound(type);
}

function _playSynthSound(type) {
  const ctx = state._audioCtx;
  if (!ctx) return;
  const now = ctx.currentTime;
  if (type === 'whistle' || type === 'double_whistle') {
    const times = type === 'whistle' ? [0] : [0, 0.38, 0.76];
    times.forEach(delay => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sawtooth'; osc.frequency.value = 3800;
      g.gain.setValueAtTime(0, now + delay);
      g.gain.linearRampToValueAtTime(0.04, now + delay + 0.03);
      g.gain.setValueAtTime(0.04, now + delay + 0.22);
      g.gain.linearRampToValueAtTime(0, now + delay + 0.32);
      osc.start(now + delay); osc.stop(now + delay + 0.35);
    });
  } else if (type === 'cheer') {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bpf = ctx.createBiquadFilter(); bpf.type = 'bandpass'; bpf.frequency.value = 800;
    const g = ctx.createGain();
    src.connect(bpf); bpf.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.06, now + 0.2);
    g.gain.linearRampToValueAtTime(0, now + 2);
    src.start(now); src.stop(now + 2);
  }
}

// ---- Confetti ----
function launchConfetti() {
  const canvas = document.getElementById('notif-confetti');
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  const colors = ['#2563EB','#7C3AED','#DC2626','#EA580C','#16A34A','#F59E0B','#EC4899','#06B6D4'];
  // Spread pieces across a wider spawn zone, slower fall
  const pieces = Array.from({ length: 90 }, () => ({
    x: (Math.random() - 0.1) * canvas.width * 1.2,
    y: -20 - Math.random() * canvas.height,
    r: 5 + Math.random() * 7,
    color: colors[Math.floor(Math.random() * colors.length)],
    vx: (Math.random() - 0.5) * 2,
    vy: 0.8 + Math.random() * 1.6,
    spin: (Math.random() - 0.5) * 0.12,
    angle: Math.random() * Math.PI * 2,
    shape: Math.random() > 0.4 ? 'rect' : 'circle',
  }));
  let frame;
  let done = false;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      p.x += p.vx; p.y += p.vy; p.angle += p.spin; p.vy += 0.02;
      // Recycle pieces that fall off bottom back to top
      if (p.y > canvas.height + 20) {
        p.y = -20;
        p.x = (Math.random() - 0.1) * canvas.width * 1.2;
        p.vy = 0.8 + Math.random() * 1.6;
        p.vx = (Math.random() - 0.5) * 2;
      }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      else { ctx.beginPath(); ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    if (!done) frame = requestAnimationFrame(draw);
    else canvas.style.display = 'none';
  }
  if (frame) cancelAnimationFrame(frame);
  draw();
  return () => { done = true; if (frame) cancelAnimationFrame(frame); canvas.style.display = 'none'; };
}

// ---- Kicking balls (match start) — arc left↔right across screen ----
function launchBalls() {
  const canvas = document.getElementById('notif-confetti'); // reuse canvas layer
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // Each ball: horizontal trajectory with parabolic arc
  const balls = Array.from({ length: 7 }, (_, i) => {
    const goRight = i % 2 === 0;
    const size = 28 + Math.random() * 28;
    const yBase = 0.2 * H + Math.random() * 0.6 * H; // vertical spread
    const speed = 3 + Math.random() * 3;
    const arcH = 30 + Math.random() * 80; // arc height
    const delay = i * 18 + Math.random() * 15; // stagger start
    return { goRight, size, yBase, speed, arcH, delay,
      x: goRight ? -size : W + size, progress: 0, spinning: 0 };
  });

  let frame;
  let done = false;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (const b of balls) {
      if (b.delay > 0) { b.delay--; continue; }
      b.x += b.goRight ? b.speed : -b.speed;
      b.progress = b.goRight ? b.x / W : 1 - (b.x / W);
      b.spinning += 0.08;
      // Parabolic arc: sine curve peaks at mid-travel
      const arc = Math.sin(b.progress * Math.PI) * b.arcH;
      const y = b.yBase - arc;
      ctx.save();
      ctx.translate(b.x, y);
      ctx.rotate(b.spinning * (b.goRight ? 1 : -1));
      ctx.font = `${b.size}px serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('⚽', 0, 0);
      ctx.restore();
      // Recycle when off screen
      if ((b.goRight && b.x > W + b.size) || (!b.goRight && b.x < -b.size)) {
        b.x = b.goRight ? -b.size : W + b.size;
        b.yBase = 0.2 * H + Math.random() * 0.6 * H;
        b.speed = 3 + Math.random() * 3;
        b.arcH = 30 + Math.random() * 80;
        b.delay = Math.random() * 30;
      }
    }
    if (!done) frame = requestAnimationFrame(draw);
    else canvas.style.display = 'none';
  }
  if (frame) cancelAnimationFrame(frame);
  draw();
  return () => { done = true; if (frame) cancelAnimationFrame(frame); canvas.style.display = 'none'; };
}

// ---- Modal system ----
function buildNotifDOM() {
  if (document.getElementById('notif-overlay')) return;

  // Confetti canvas (sits above everything)
  const canvas = document.createElement('canvas');
  canvas.id = 'notif-confetti';
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;display:none;';
  document.body.appendChild(canvas);

  // Floating balls container
  const balls = document.createElement('div');
  balls.id = 'notif-balls';
  balls.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9998;display:none;overflow:hidden;';
  document.body.appendChild(balls);

  // Overlay backdrop + modal
  const overlay = document.createElement('div');
  overlay.id = 'notif-overlay';
  overlay.innerHTML = `
    <div id="notif-modal">
      <button id="notif-close" aria-label="Close">✕</button>
      <div id="notif-body"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('notif-close').addEventListener('click', dismissNotif);
  overlay.addEventListener('click', e => { if (e.target === overlay) dismissNotif(); });
}

let _stopBalls = null;
let _stopConfetti = null;

function dismissNotif() {
  const overlay = document.getElementById('notif-overlay');
  if (overlay) overlay.classList.remove('active');
  if (_stopBalls) { _stopBalls(); _stopBalls = null; }
  if (_stopConfetti) { _stopConfetti(); _stopConfetti = null; }
  // Process next in queue
  state._notifActive = false;
  if (state._notifQueue.length) {
    const next = state._notifQueue.shift();
    setTimeout(() => showNotif(next), 400);
  }
}

function showNotif(notif) {
  buildNotifDOM();
  state._notifActive = true;
  const overlay = document.getElementById('notif-overlay');
  const body = document.getElementById('notif-body');
  const modal = document.getElementById('notif-modal');
  if (!overlay || !body) return;

  modal.className = 'notif-' + notif.type;
  body.innerHTML = notif.html;
  overlay.classList.add('active');

  if (notif.type === 'kickoff') {
    playSound('whistle');
    _stopBalls = launchBalls();
  } else if (notif.type === 'goal') {
    playSound('cheer');
    _stopConfetti = launchConfetti();
  } else if (notif.type === 'final') {
    playSound('double_whistle');
  }
}

function queueNotif(notif) {
  if (state._notifActive) {
    state._notifQueue.push(notif);
  } else {
    showNotif(notif);
  }
  sendSystemNotification(notif);
}

// ===== Android/system notifications via the service worker =====
// Shows a real OS-level notification (works while the PWA/tab is alive in the
// background — e.g. screen off — but not once Android fully kills the process).
function sendSystemNotification(notif) {
  if (!notif.title) return;
  if (!('serviceWorker' in navigator) || Notification?.permission !== 'granted') return;
  navigator.serviceWorker.ready.then(reg => {
    reg.showNotification(notif.title, {
      body: notif.body || '',
      icon: './icons/icon-192-any.png',
      badge: './icons/badge-192.png',
      tag: 'wc2026-' + notif.type,
      renotify: true,
      vibrate: [120, 60, 120],
    });
  }).catch(() => {});
}

function updateNotifPermissionBtn() {
  const btn = document.getElementById('notif-permission-btn');
  if (!btn) return;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    btn.hidden = true;
    return;
  }
  btn.hidden = false;
  if (Notification.permission === 'granted') {
    btn.classList.add('enabled');
    btn.title = 'Android notifications enabled';
  } else {
    btn.classList.remove('enabled');
    btn.title = 'Enable Android notifications';
  }
}

function initNotifPermissionBtn() {
  const btn = document.getElementById('notif-permission-btn');
  if (!btn) return;
  updateNotifPermissionBtn();
  btn.addEventListener('click', async () => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    updateNotifPermissionBtn();
  });
}

function kickoffNotifHtml(match) {
  const meta = TEAM_MASTER_DATA[match.homeTeam];
  const group = meta?.group ? `Group ${meta.group}` : (match.stage || '');
  return `
    <div class="notif-eyebrow">⚽ Kick Off!</div>
    <div class="notif-teams">
      <div class="notif-team">
        ${flagImg(match.homeIso, match.homeTeam)}
        <span>${match.homeTeam}</span>
      </div>
      <div class="notif-vs">vs</div>
      <div class="notif-team">
        ${flagImg(match.awayIso, match.awayTeam)}
        <span>${match.awayTeam}</span>
      </div>
    </div>
    <div class="notif-sub">${group}${match.venue ? ' · ' + match.venue : ''}</div>
  `;
}

function goalNotifHtml(match, scoringTeam, scorerLabel) {
  const scoringIso = scoringTeam === match.homeTeam ? match.homeIso : match.awayIso;
  return `
    <div class="notif-goal-icon">⚽</div>
    <div class="notif-eyebrow notif-goal-word">GOAL!</div>
    <div class="notif-goal-team">
      ${flagImg(scoringIso, scoringTeam)}
      <span>${scoringTeam}</span>
    </div>
    ${scorerLabel ? `<div class="notif-scorer">${scorerLabel}</div>` : ''}
    <div class="notif-score">${match.homeTeam} ${match.homeScore} – ${match.awayScore} ${match.awayTeam}</div>
  `;
}

function finalNotifHtml(match) {
  const homeWon = match.homeScore > match.awayScore;
  const awayWon = match.awayScore > match.homeScore;
  const meta = TEAM_MASTER_DATA[match.homeTeam];
  const group = meta?.group ? `Group ${meta.group}` : (match.stage || '');
  const s = match._espnStats;
  let statsHtml = '';
  if (s) {
    const h = s.home || {}, a = s.away || {};
    const ph = Math.round(h.possessionPct ?? h.possession ?? 50);
    const pa = 100 - ph;
    const hColor = match._espnColors?.home || '#2563EB';
    const aColor = match._espnColors?.away || '#DC2626';
    const barStyle = `background:linear-gradient(to right,${hColor} ${Math.max(0,ph-20)}%,${aColor} ${Math.min(100,ph+20)}%)`;
    const rows = [];
    const sh = h.totalShots ?? h.shots, sa = a.totalShots ?? a.shots;
    if (isFinite(sh) && isFinite(sa)) rows.push([sh, 'Shots', sa]);
    const oh = h.shotsOnTarget, oa = a.shotsOnTarget;
    if (isFinite(oh) && isFinite(oa)) rows.push([oh, 'On Target', oa]);
    const ch = h.wonCorners ?? h.cornerKicks ?? h.corners, ca = a.wonCorners ?? a.cornerKicks ?? a.corners;
    if (isFinite(ch) && isFinite(ca)) rows.push([ch, 'Corners', ca]);
    const yh = h.yellowCards ?? 0, ya = a.yellowCards ?? 0;
    if (yh > 0 || ya > 0) rows.push([`<span class="ycard">${yh}</span>`, 'Yellows', `<span class="ycard">${ya}</span>`]);
    const rh = h.redCards ?? 0, ra = a.redCards ?? 0;
    if (rh > 0 || ra > 0) rows.push([`<span class="rcard">${rh}</span>`, 'Reds', `<span class="rcard">${ra}</span>`]);
    statsHtml = `
      <div class="notif-poss">
        <span style="color:${hColor}">${ph}%</span>
        <div class="notif-poss-bar" style="${barStyle}"></div>
        <span style="color:${aColor}">${pa}%</span>
      </div>
      ${rows.length ? `<div class="notif-stats-grid">${rows.map(([hv,l,av]) =>
        `<span class="nsg-h">${hv}</span><span class="nsg-l">${l}</span><span class="nsg-a">${av}</span>`
      ).join('')}</div>` : ''}
    `;
  }
  const ev = match._espnEvents;
  const homeGoals = ev?.home || [];
  const awayGoals = ev?.away || [];
  const scorerRows = Array.from({ length: Math.max(homeGoals.length, awayGoals.length) }, (_, i) =>
    `<span class="notif-scorer-home">${homeGoals[i] ? '⚽ ' + homeGoals[i] : ''}</span>` +
    `<span class="notif-scorer-away">${awayGoals[i] ? awayGoals[i] + ' ⚽' : ''}</span>`
  );
  return `
    <div class="notif-eyebrow">🏁 Full Time</div>
    <div class="notif-teams">
      <div class="notif-team ${homeWon ? 'winner' : awayWon ? 'loser' : ''}">
        ${flagImg(match.homeIso, match.homeTeam)}
        <span>${match.homeTeam}</span>
      </div>
      <div class="notif-final-score">${match.homeScore} – ${match.awayScore}</div>
      <div class="notif-team ${awayWon ? 'winner' : homeWon ? 'loser' : ''}">
        ${flagImg(match.awayIso, match.awayTeam)}
        <span>${match.awayTeam}</span>
      </div>
    </div>
    <div class="notif-sub">${group}${match.venue ? ' · ' + match.venue : ''}</div>
    ${scorerRows.length ? `<div class="notif-scorers">${scorerRows.join('')}</div>` : ''}
    ${statsHtml}
  `;
}

// ===== ESPN INTEGRATION =====

const ESPN_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

// ESPN display name → our TEAM_MASTER_DATA key (add entries as mismatches are discovered)
const ESPN_NAME_MAP = {
  'Cape Verde': 'Cape Verde Islands',
  'Bosnia & Herzegovina': 'Bosnia-Herzegovina',
  "Côte d'Ivoire": 'Ivory Coast',
  "Cote d'Ivoire": 'Ivory Coast',
  'DR Congo': 'Congo DR',
  'Republic of Congo': 'Congo DR',
  'Czech Republic': 'Czechia',
  'Korea Republic': 'South Korea',
  'Republic of Korea': 'South Korea',
  'USA': 'United States',
  'Curacao': 'Curaçao',
  'Türkiye': 'Turkey',
};

// Reverse map: ESPN numeric team ID → our TEAM_MASTER_DATA key
// Used for robust matching that bypasses displayName inconsistencies across ESPN endpoints
const ESPN_ID_TO_TEAM = Object.fromEntries(
  Object.entries(TEAM_MASTER_DATA)
    .filter(([, v]) => v.espnId)
    .map(([name, v]) => [String(v.espnId), name])
);

// ESPN status name → our status values
const ESPN_STATUS_MAP = {
  'STATUS_SCHEDULED':   'SCHEDULED',
  'STATUS_FIRST_HALF':  'IN_PLAY',
  'STATUS_SECOND_HALF': 'IN_PLAY',
  'STATUS_HALFTIME':    'PAUSED',
  'STATUS_END_PERIOD':  'PAUSED',   // brief transition between period end and halftime/fulltime call
  'STATUS_FULL_TIME':   'FINISHED',
  'STATUS_FINAL_AET':   'FINISHED',
  'STATUS_FINAL_PEN':   'FINISHED',
  'STATUS_SUSPENDED':   'PAUSED',
  'STATUS_POSTPONED':   'SCHEDULED',
  'STATUS_CANCELED':    'SCHEDULED',
  'STATUS_DELAY':       'PAUSED',
  'STATUS_DELAYED':    'SCHEDULED',
  'STATUS_POSTPONED':  'SCHEDULED',
};

function normalizeESPNName(name) {
  return ESPN_NAME_MAP[name] || name;
}

function mapESPNStatus(typeName, typeState) {
  if (ESPN_STATUS_MAP[typeName]) return ESPN_STATUS_MAP[typeName];
  if (typeState === 'in')   return 'IN_PLAY';
  if (typeState === 'post') return 'FINISHED';
  return 'SCHEDULED';
}

async function fetchESPN() {
  if (state._espnFetchInFlight) return; // avoid overlapping polls if a previous one is slow
  state._espnFetchInFlight = true;
  // Note: no "syncing" pill state here — there's no distinct visual style for it, so
  // setting it would just flash the pill back to its neutral base style every poll.
  try {
    const res = await fetch(ESPN_SCOREBOARD_URL + '?_=' + Date.now());
    if (!res.ok) throw new Error('ESPN ' + res.status);
    const data = await res.json();
    mergeESPNData(data.events || []);
    // Fetch live commentary for any in-play matches that have an ESPN event ID
    const liveMatches = state.matches.filter(m =>
      (m.status === 'IN_PLAY' || m.status === 'PAUSED') && m.espnEventId
    );
    if (liveMatches.length) {
      await Promise.all(liveMatches.map(fetchESPNCommentary));
      renderView({ silent: true }); // re-render now that commentary is loaded
    }
    setSyncPillState('ok');
  } catch (e) {
    // ESPN unreachable — drop the "is ESPN authoritative" flag so fetchData() falls
    // back to football-data.org's values instead of trusting now-unconfirmed ESPN data.
    state.espnSynced = false;
    setSyncPillState('error');
    updateSyncPill(formatLastSync(state.lastUpdated));
    console.error('[ESPN] Sync failed:', e.message);
  } finally {
    state._espnFetchInFlight = false;
  }
}

async function fetchESPNCommentary(match) {
  try {
    const res = await fetch(`${ESPN_SCOREBOARD_URL.replace('/scoreboard', '/summary')}?event=${match.espnEventId}`);
    if (!res.ok) return;
    const data = await res.json();
    const fresh = (data.commentary || []).filter(c => c.text);
    // Re-look-up the match by matchNum rather than writing to the captured `match`
    // reference directly: fetchData() replaces state.matches with new objects on every
    // data.json change, so by the time this fetch resolves the passed-in object may no
    // longer be part of state.matches, silently losing the write.
    const current = state.matches.find(m => m.matchNum === match.matchNum);
    if (!current) return;
    // Merge into the full history by sequence (ESPN returns the whole commentary feed on
    // every poll, not just new items) — keyed by sequence so re-fetches dedupe cleanly.
    const bySeq = new Map((current._espnCommentary || []).map(c => [c.sequence, c]));
    for (const c of fresh) bySeq.set(c.sequence, c);
    current._espnCommentary = [...bySeq.values()].sort((a, b) => (b.sequence ?? 0) - (a.sequence ?? 0));
  } catch (e) {
    // Non-critical — commentary is a nice-to-have
  }
}

async function fetchESPNDate(dateStr) {
  if (state._espnDateCache[dateStr]) return state._espnDateCache[dateStr];
  try {
    const res = await fetch(`${ESPN_SCOREBOARD_URL}?dates=${dateStr}`);
    if (!res.ok) throw new Error('ESPN date fetch ' + res.status);
    const data = await res.json();
    const events = data.events || [];
    state._espnDateCache[dateStr] = events;
    return events;
  } catch (e) {
    console.warn('fetchESPNDate failed for', dateStr, e.message);
    return [];
  }
}

function kickoffToDateStr(kickoff) {
  if (!kickoff) return null;
  // Use Pacific time — same timezone ESPN uses for dates= param
  return new Date(kickoff).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }).replace(/-/g, '');
}

function findESPNEvent(events, homeTeam, awayTeam) {
  const homeId = String(TEAM_MASTER_DATA[homeTeam]?.espnId || '');
  const awayId = String(TEAM_MASTER_DATA[awayTeam]?.espnId || '');
  for (const event of events) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const homeComp = comp.competitors.find(c => c.homeAway === 'home');
    const awayComp = comp.competitors.find(c => c.homeAway === 'away');
    if (!homeComp || !awayComp) continue;

    // Primary: match by ESPN team ID (robust across displayName inconsistencies)
    const hId = String(homeComp.team.id || '');
    const aId = String(awayComp.team.id || '');
    const idMatch = homeId && awayId && (
      (hId === homeId && aId === awayId) ||
      (hId === awayId && aId === homeId)
    );

    // Fallback: match by display name (with normalization)
    const h = normalizeESPNName(homeComp.team.displayName);
    const a = normalizeESPNName(awayComp.team.displayName);
    const nameMatch = (h === homeTeam && a === awayTeam) || (h === awayTeam && a === homeTeam);

    if (idMatch || nameMatch) {
      const swapped = idMatch ? hId === awayId : h === awayTeam;
      return { event, comp, homeComp, awayComp, swapped };
    }
  }
  return null;
}

function parseESPNEventData(comp, homeComp, awayComp, swapped) {
  // Stats
  const parseStats = (competitor) => {
    const s = {};
    for (const stat of (competitor.statistics || [])) {
      s[stat.name] = parseFloat(stat.displayValue) || 0;
    }
    return s;
  };
  let hStats = parseStats(swapped ? awayComp : homeComp);
  let aStats = parseStats(swapped ? homeComp : awayComp);

  const homeId = (swapped ? awayComp : homeComp).team.id;

  // Derive cards from details
  let homeYellow = 0, awayYellow = 0, homeRed = 0, awayRed = 0;
  const timeline = [];
  for (const d of (comp.details || [])) {
    const isHome = d.team?.id === homeId;
    if (d.yellowCard) { isHome ? homeYellow++ : awayYellow++; }
    if (d.redCard)    { isHome ? homeRed++    : awayRed++;    }

    const player = d.athletesInvolved?.[0]?.shortName || d.athletesInvolved?.[0]?.displayName || '';
    const headshot = d.athletesInvolved?.[0]?.headshot || null;
    const minute = d.clock?.displayValue || '';
    const typeText = d.type?.text || '';
    timeline.push({
      isHome: swapped ? !isHome : isHome,
      minute,
      player,
      headshot,
      typeText,
      isGoal: d.scoringPlay && d.scoreValue > 0,
      isOwnGoal: d.ownGoal,
      isPenalty: d.penaltyKick,
      isYellow: d.yellowCard,
      isRed: d.redCard,
    });
  }
  hStats.yellowCards = homeYellow;
  aStats.yellowCards = awayYellow;
  hStats.redCards    = homeRed;
  aStats.redCards    = awayRed;

  const colors = {
    home: pickTeamColor((swapped ? awayComp : homeComp).team),
    away: pickTeamColor((swapped ? homeComp : awayComp).team),
  };

  return {
    stats: { home: hStats, away: aStats },
    timeline,
    headline: comp.headlines?.[0]?.description || null,
    attendance: comp.attendance || null,
    colors,
  };
}

// FIFA fair play disciplinary points (group-stage tiebreaker), per athlete per match:
//   1 yellow card                 => -1
//   indirect red (second yellow)  => -3
//   straight red                  => -4
//   yellow card + straight red    => -5
// NOTE: ESPN's details[] doesn't carry an explicit "second yellow" flag. We can't
// reliably distinguish an indirect red (-3) from a yellow+straight-red (-5) when an
// athlete has exactly one yellow and one red logged in the same match — we treat
// that ambiguous case as the indirect red (-3), since it's the far more common
// real-world occurrence. Flagged here for manual verification against a real example
// if it ever shows up, since this hasn't been validated end-to-end yet. Mirrors the
// identical function in scripts/update_tracker.js.
function classifyMatchFairPlay(details, ourHomeTeamId) {
  const byAthlete = new Map();
  for (const d of details) {
    if (!d.yellowCard && !d.redCard) continue;
    const athlete = d.athletesInvolved?.[0];
    const key = athlete?.id || athlete?.displayName || `${d.team?.id}:${d.clock?.value}`;
    const isHome = d.team?.id === ourHomeTeamId;
    if (!byAthlete.has(key)) byAthlete.set(key, { isHome, yellow: 0, red: 0 });
    const entry = byAthlete.get(key);
    if (d.yellowCard) entry.yellow++;
    if (d.redCard) entry.red++;
  }
  let home = 0, away = 0;
  for (const { isHome, yellow, red } of byAthlete.values()) {
    let deduction = 0;
    if (red >= 1) deduction = yellow >= 1 ? -3 : -4;
    else if (yellow >= 2) deduction = -3;
    else if (yellow === 1) deduction = -1;
    if (isHome) home += deduction; else away += deduction;
  }
  return { home, away };
}

function pickTeamColor(team) {
  const hex = (team.color || '').replace('#', '');
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
    if ((r + g + b) / 3 > 210) return '#' + (team.alternateColor || '888888');
  }
  return '#' + (hex || '888888');
}

function mergeESPNData(espnEvents) {
  let changed = false;

  // Snapshot pre-update state for event detection (skip on first load when seen-sets are empty)
  const isFirstLoad = state._seenMatchStart.size === 0 && state._seenGoalEvents.size === 0 && state._seenMatchEnd.size === 0;
  const prevState = {};
  for (const m of state.matches) {
    prevState[m.matchNum] = { status: m.status, homeScore: m.homeScore, awayScore: m.awayScore };
  }

  for (const event of espnEvents) {
    const comp = event.competitions?.[0];
    if (!comp) continue;

    const homeComp = comp.competitors.find(c => c.homeAway === 'home');
    const awayComp = comp.competitors.find(c => c.homeAway === 'away');
    if (!homeComp || !awayComp) continue;

    const espnHome = normalizeESPNName(homeComp.team.displayName);
    const espnAway = normalizeESPNName(awayComp.team.displayName);
    const espnHomeId = String(homeComp.team.id || '');
    const espnAwayId = String(awayComp.team.id || '');
    const newStatus = mapESPNStatus(comp.status.type.name, comp.status.type.state);

    // Match by ESPN team ID first (robust), fall back to display name
    const match = state.matches.find(m => {
      const hId = String(TEAM_MASTER_DATA[m.homeTeam]?.espnId || '');
      const aId = String(TEAM_MASTER_DATA[m.awayTeam]?.espnId || '');
      if (hId && aId && espnHomeId && espnAwayId) {
        return (hId === espnHomeId && aId === espnAwayId) || (hId === espnAwayId && aId === espnHomeId);
      }
      return (m.homeTeam === espnHome && m.awayTeam === espnAway) ||
             (m.homeTeam === espnAway && m.awayTeam === espnHome);
    });
    if (!match) continue;

    // Capture ESPN event ID so we can fetch match summary later
    if (event.id && !match.espnEventId) match.espnEventId = event.id;

    const matchHomeId = String(TEAM_MASTER_DATA[match.homeTeam]?.espnId || '');
    const swapped = matchHomeId && espnHomeId
      ? matchHomeId === espnAwayId
      : match.homeTeam === espnAway;
    const rawHome = parseInt(homeComp.score, 10);
    const rawAway = parseInt(awayComp.score, 10);
    const newHomeScore = newStatus !== 'SCHEDULED' ? (swapped ? rawAway : rawHome) : null;
    const newAwayScore = newStatus !== 'SCHEDULED' ? (swapped ? rawHome : rawAway) : null;

    if (match.status !== newStatus || match.homeScore !== newHomeScore || match.awayScore !== newAwayScore) {
      changed = true;
    }

    match.status    = newStatus;
    match.homeScore = newHomeScore;
    match.awayScore = newAwayScore;

    // ESPN clock: total elapsed seconds from kickoff (capped at 45*60 or 90*60 by ESPN)
    match._espnClock        = comp.status.clock || 0;
    match._espnDisplayClock = comp.status.displayClock || null; // e.g. "45'+2'" during stoppage
    match._espnPeriod       = comp.status.period || 1;
    match._espnFetchedAt    = Date.now();

    // Goal events for scorer display
    const homeId = homeComp.team.id;
    const details = comp.details || [];
    const matchEvents = { home: [], away: [] };
    for (const d of details) {
      if (!d.scoreValue || d.scoreValue < 1) continue;
      const player = d.athletesInvolved?.[0]?.shortName || d.athletesInvolved?.[0]?.displayName || '';
      const time   = d.clock?.displayValue || '';
      const suffix = d.ownGoal ? ' (og)' : d.penaltyKick ? ' (pen)' : '';
      const label  = ([player, time].filter(Boolean).join(' ') + suffix).trim();
      if (label) matchEvents[d.team?.id === homeId ? 'home' : 'away'].push(label);
    }
    if (swapped) [matchEvents.home, matchEvents.away] = [matchEvents.away, matchEvents.home];
    match._espnEvents = matchEvents;

    // Team stats — ESPN uses displayValue (string), not value
    const hStats = {};
    for (const s of (homeComp.statistics || [])) {
      hStats[s.name] = s.value !== undefined ? s.value : parseFloat(s.displayValue);
    }
    const aStats = {};
    for (const s of (awayComp.statistics || [])) {
      aStats[s.name] = s.value !== undefined ? s.value : parseFloat(s.displayValue);
    }

    // Derive card counts from details (not in stats array)
    let homeYellow = 0, awayYellow = 0, homeRed = 0, awayRed = 0;
    for (const d of details) {
      const isHome = d.team?.id === homeId;
      if (d.yellowCard) { isHome ? homeYellow++ : awayYellow++; }
      if (d.redCard)    { isHome ? homeRed++    : awayRed++;    }
    }
    hStats.yellowCards = homeYellow;
    aStats.yellowCards = awayYellow;
    hStats.redCards    = homeRed;
    aStats.redCards    = awayRed;

    match._espnStats = swapped ? { home: aStats, away: hStats } : { home: hStats, away: aStats };

    // Fair play tiebreak points — live preview while the match is tracked by ESPN.
    // Self-corrects on the next 10s poll as details[] fills in (same lag as goal events).
    const fp = classifyMatchFairPlay(details, swapped ? awayComp.team.id : homeId);
    match.homeFairPlay = fp.home;
    match.awayFairPlay = fp.away;

    // Team colors for possession bar and accents
    const hColor = pickTeamColor(homeComp.team);
    const aColor = pickTeamColor(awayComp.team);
    match._espnColors = swapped ? { home: aColor, away: hColor } : { home: hColor, away: aColor };

    // Headline (recap summary)
    match._espnHeadline = comp.headlines?.[0]?.description || null;
  }

  // ---- Event detection ----
  if (isFirstLoad) {
    // First ESPN poll — baseline matches that are already past each threshold so we
    // don't fire stale events on load. SCHEDULED matches are deliberately NOT added
    // to _seenMatchStart/_seenMatchEnd so their future transitions will still fire.
    for (const m of state.matches) {
      if (m.status !== 'SCHEDULED') {
        // Already kicked off (or finished) — suppress kickoff notification
        state._seenMatchStart.add(m.matchNum);
      }
      if (m.status === 'FINISHED') {
        // Already done — suppress final notification
        state._seenMatchEnd.add(m.matchNum);
      }
      const ev = m._espnEvents;
      if (ev) {
        state._seenGoalEvents.add(`${m.matchNum}:${ev.home.length}:${ev.away.length}`);
      }
    }
  } else {
    // Subsequent polls — compare prev snapshot vs current state
    for (const m of state.matches) {
      const prev = prevState[m.matchNum];
      if (!prev) continue;

      // Match kicked off
      if (prev.status === 'SCHEDULED' && m.status === 'IN_PLAY' && !state._seenMatchStart.has(m.matchNum)) {
        state._seenMatchStart.add(m.matchNum);
        queueNotif({
          type: 'kickoff', html: kickoffNotifHtml(m),
          title: '⚽ Kick Off!', body: `${m.homeTeam} vs ${m.awayTeam}`,
        });
      }

      // Goal scored — fire as soon as ESPN events show a new goal scorer, even if the
      // score integer hasn't updated yet (ESPN details[] leads the score field by ~30s).
      if (m.status === 'IN_PLAY' || m.status === 'PAUSED' || m.status === 'FINISHED') {
        const ev = m._espnEvents;
        const evHomeLen = ev?.home.length ?? 0;
        const evAwayLen = ev?.away.length ?? 0;
        const eventKey = `${m.matchNum}:${evHomeLen}:${evAwayLen}`;

        // Event-based path: new scorer entry appeared before score updated
        if (ev && !state._seenGoalEvents.has(eventKey)) {
          // Figure out which side gained an event by comparing to the last seen event counts
          // Find the previous event key for this match (search seen set)
          let prevHomeLen = 0, prevAwayLen = 0;
          for (const k of state._seenGoalEvents) {
            if (k.startsWith(`${m.matchNum}:`)) {
              const parts = k.split(':');
              prevHomeLen = parseInt(parts[1], 10);
              prevAwayLen = parseInt(parts[2], 10);
            }
          }
          const homeScored = evHomeLen > prevHomeLen;
          const awayScored = evAwayLen > prevAwayLen;
          if (homeScored || awayScored) {
            state._seenGoalEvents.add(eventKey);
            const scoringTeam = homeScored ? m.homeTeam : m.awayTeam;
            const scorerList = homeScored ? ev.home : ev.away;
            const scorerLabel = scorerList.length ? scorerList[scorerList.length - 1] : '';
            // Use current score if updated, otherwise show prev+1 as best estimate
            const displayMatch = { ...m };
            if (homeScored && m.homeScore === (prev.homeScore ?? 0)) displayMatch.homeScore = (prev.homeScore ?? 0) + 1;
            if (awayScored && m.awayScore === (prev.awayScore ?? 0)) displayMatch.awayScore = (prev.awayScore ?? 0) + 1;
            queueNotif({
              type: 'goal', html: goalNotifHtml(displayMatch, scoringTeam, scorerLabel),
              title: `⚽ GOAL! ${scoringTeam}`,
              body: `${scorerLabel ? scorerLabel + ' — ' : ''}${displayMatch.homeTeam} ${displayMatch.homeScore} – ${displayMatch.awayScore} ${displayMatch.awayTeam}`,
            });
          }
        }
      }

      // Match finished
      if ((prev.status === 'IN_PLAY' || prev.status === 'PAUSED') &&
          m.status === 'FINISHED' && !state._seenMatchEnd.has(m.matchNum)) {
        state._seenMatchEnd.add(m.matchNum);
        queueNotif({
          type: 'final', html: finalNotifHtml(m),
          title: '🏁 Full Time', body: `${m.homeTeam} ${m.homeScore} – ${m.awayScore} ${m.awayTeam}`,
        });
      }
    }
  }

  state.lastUpdated = new Date().toISOString();
  state.espnSynced  = true;

  updateSyncPill('just now');

  renderView({ silent: true });
}

// ===== HELPERS =====

function flagImg(iso, name) {
  if (!iso) return '';
  let src = iso;
  if (iso === 'england') src = 'gb-eng';
  else if (iso === 'scotland') src = 'gb-sct';
  return `<img src="https://flagcdn.com/48x36/${src}.png" alt="${name || iso}" class="flag" width="24" height="18" onerror="this.style.display='none'">`;
}

function formatKickoff(isoStr) {
  if (!isoStr) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(new Date(isoStr));
  } catch (e) {
    return isoStr;
  }
}

function updateSyncPill(espnLabel) {
  const el = document.getElementById('last-sync');
  if (!el) return;
  const pill = el.closest('.sync-pill');
  const isError = pill?.dataset.syncState === 'error';
  el.textContent = isError ? 'ESPN Offline' : 'ESPN Live';

  const parts = [`ESPN: ${espnLabel}`];
  if (state.fdLastUpdated) {
    const fd = new Date(state.fdLastUpdated);
    const formatted = fd.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    });
    parts.push(`football-data.org: ${formatted} PT`);
  }
  if (pill) pill.title = parts.join('\n');
}

function setSyncPillState(state_) {
  const pill = document.querySelector('.sync-pill');
  if (pill) pill.dataset.syncState = state_;
}

function formatLastSync(isoStr) {
  if (!isoStr) return 'Never';
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 30) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function getMatchMinute(match) {
  if (match.status === 'PAUSED') return 'HT';
  if (match.status !== 'IN_PLAY') return null;

  // ESPN clock: prefer displayClock during stoppage (status.clock freezes at 45:00 / 90:00)
  if (match._espnDisplayClock && match._espnDisplayClock.includes('+')) {
    // Format from ESPN: "45'+2'" or "90'+5'" → normalise to "45+2'" / "90+5'"
    return match._espnDisplayClock.replace("'+", '+').replace(/'+$/, "'").replace(/'\s*$/, "'");
  }
  if (match._espnClock !== undefined && match._espnFetchedAt) {
    const elapsedSec = match._espnClock + (Date.now() - match._espnFetchedAt) / 1000;
    const min = Math.floor(elapsedSec / 60);
    if (match._espnPeriod === 1) {
      if (min > 45) return `45+${min - 45}'`;
      return `${Math.max(1, min)}'`;
    } else {
      if (min > 90) return `90+${min - 90}'`;
      return `${Math.max(46, min)}'`;
    }
  }

  // Fallback: compute from firstHalfStart/secondHalfStart timestamps
  const now = Date.now();
  if (match.secondHalfStart) {
    const elapsed = Math.floor((now - new Date(match.secondHalfStart).getTime()) / 60000) + 1;
    const min = 45 + elapsed;
    if (elapsed > 45) return `90+${elapsed - 45}'`;
    return `${Math.min(min, 90)}'`;
  }
  if (match.firstHalfStart) {
    const elapsed = Math.floor((now - new Date(match.firstHalfStart).getTime()) / 60000) + 1;
    if (elapsed > 45) return `45+${elapsed - 45}'`;
    return `${Math.min(elapsed, 45)}'`;
  }
  return '1\'';
}

// Prefers the dynamic ranking fetched from data/fifa_rankings.json (refreshed by
// update_tracker.js whenever a newer blueprint_data/fifa_rankings_*.html shows up) over
// the snapshot baked into TEAM_MASTER_DATA at deploy time, so a mid-tournament FIFA
// ranking update can take effect without needing a new app.js deploy.
function fifaRankOf(team) {
  return state.fifaRankings[team] ?? TEAM_MASTER_DATA[team]?.fifaRank ?? 9999;
}

// FIFA's official group-stage tiebreaker order: pts -> GD -> GF -> head-to-head mini-league
// (pts -> GD -> GF, group-stage matches between the tied teams only) -> fair play points ->
// FIFA World Ranking position -> alphabetical (last-resort, should rarely matter).
function sortStandingsWithHeadToHead(teams, groupMatches) {
  const baseSorted = [...teams].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  const result = [];
  let i = 0;
  while (i < baseSorted.length) {
    let j = i + 1;
    while (j < baseSorted.length &&
      baseSorted[j].pts === baseSorted[i].pts && baseSorted[j].gd === baseSorted[i].gd && baseSorted[j].gf === baseSorted[i].gf) j++;
    const cluster = baseSorted.slice(i, j);
    result.push(...(cluster.length > 1 ? resolveHeadToHead(cluster, groupMatches) : cluster));
    i = j;
  }
  return result;
}

function resolveHeadToHead(cluster, groupMatches) {
  const names = new Set(cluster.map(t => t.team));
  const mini = {};
  for (const t of cluster) mini[t.team] = { pts: 0, gf: 0, ga: 0 };
  for (const m of groupMatches) {
    if (!names.has(m.homeTeam) || !names.has(m.awayTeam)) continue;
    const h = mini[m.homeTeam], a = mini[m.awayTeam];
    const hs = m.homeScore ?? 0, as = m.awayScore ?? 0;
    h.gf += hs; h.ga += as;
    a.gf += as; a.ga += hs;
    if (hs > as) h.pts += 3;
    else if (hs === as) { h.pts += 1; a.pts += 1; }
    else a.pts += 3;
  }
  return [...cluster].sort((a, b) => {
    const ma = mini[a.team], mb = mini[b.team];
    return (mb.pts - ma.pts) || ((mb.gf - mb.ga) - (ma.gf - ma.ga)) || (mb.gf - ma.gf) ||
      ((b.fairPlayPoints || 0) - (a.fairPlayPoints || 0)) ||
      (fifaRankOf(a.team) - fifaRankOf(b.team)) ||
      a.team.localeCompare(b.team);
  });
}

function computeStandings(matches, includeStatuses = ['FINISHED']) {
  const standings = {};
  for (const m of matches) {
    if (m.stage !== 'Group Stage') continue;
    for (const [team, iso, scored, conceded, fairPlay] of [
      [m.homeTeam, m.homeIso, m.homeScore, m.awayScore, m.homeFairPlay],
      [m.awayTeam, m.awayIso, m.awayScore, m.homeScore, m.awayFairPlay]
    ]) {
      const g = TEAM_MASTER_DATA[team]?.group;
      if (!team || !g) continue;
      if (!standings[g]) standings[g] = {};
      if (!standings[g][team]) {
        standings[g][team] = { team, iso, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0, fairPlayPoints: 0 };
      }
      if (includeStatuses.includes(m.status)) {
        const s = standings[g][team];
        s.played++;
        s.gf += scored ?? 0;
        s.ga += conceded ?? 0;
        s.gd = s.gf - s.ga;
        s.fairPlayPoints += fairPlay ?? 0;
        if (scored > conceded) { s.won++; s.pts += 3; }
        else if (scored === conceded) { s.drawn++; s.pts += 1; }
        else s.lost++;
      }
    }
  }
  const result = {};
  for (const [g, teams] of Object.entries(standings)) {
    const groupMatches = matches.filter(m => m.stage === 'Group Stage' && includeStatuses.includes(m.status) &&
      TEAM_MASTER_DATA[m.homeTeam]?.group === g && TEAM_MASTER_DATA[m.awayTeam]?.group === g);
    result[g] = sortStandingsWithHeadToHead(Object.values(teams), groupMatches);
  }
  return result;
}

function computeThirdPlaceRankings(standings) {
  const thirds = [];
  for (const [grp, teams] of Object.entries(standings)) {
    if (teams.length >= 3) {
      thirds.push({ ...teams[2], groupLetter: grp });
    }
  }
  // Cross-group comparison: head-to-head doesn't apply (different groups), so fall straight to fair play -> FIFA ranking.
  thirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || (b.fairPlayPoints || 0) - (a.fairPlayPoints || 0) || (fifaRankOf(a.team) - fifaRankOf(b.team)) || a.team.localeCompare(b.team));
  return thirds;
}

function getThirdPlaceCombinationString(topEight) {
  // topEight is array of group letters (up to 8)
  const letters = topEight.map(t => t.groupLetter || t).sort();
  return letters.join('');
}

function resolveTeam(placeholder, computedStandings, computedThirdPlace, combinationString) {
  if (!placeholder) return { name: 'TBD', iso: null };
  const m = placeholder.match(/^\[(.+)\]$/);
  if (!m) return { name: placeholder, iso: null };
  const code = m[1];

  // [1A], [2B], etc. — group position
  const posMatch = code.match(/^([1-4])([A-L])$/);
  if (posMatch) {
    const pos = parseInt(posMatch[1], 10) - 1;
    const grp = posMatch[2];
    const grpStandings = computedStandings[grp];
    if (grpStandings && grpStandings[pos]) {
      const t = grpStandings[pos];
      return { name: t.team, iso: t.iso };
    }
    return { name: `${pos + 1}${grp}`, iso: null };
  }

  // [3ABCDF] — third place slot
  const thirdMatch = code.match(/^3([A-L]+)$/);
  if (thirdMatch) {
    // Find which top-8 combination we have
    if (combinationString && state.combinations[combinationString]) {
      const combEntry = state.combinations[combinationString];
      // Find the slot opponent key for this code
      const opponentKey = SLOT_TO_OPPONENT[code];
      if (opponentKey) {
        const teamCode = combEntry[opponentKey]; // e.g. "3E"
        if (teamCode) {
          const grpLetter = teamCode.replace('3', '');
          const grpStandings = computedStandings[grpLetter];
          if (grpStandings && grpStandings[2]) {
            const t = grpStandings[2];
            return { name: t.team, iso: t.iso };
          }
        }
      }
    }
    return { name: `3rd (${thirdMatch[1]})`, iso: null };
  }

  // [W73], [L101] — winners/losers of match by matchNum
  const wlMatch = code.match(/^([WL])(\d+)$/);
  if (wlMatch) {
    const isWinner = wlMatch[1] === 'W';
    const refNum = parseInt(wlMatch[2], 10);
    const refMatch = state.matches.find(mm => mm.matchNum === refNum);
    if (refMatch && refMatch.status === 'FINISHED') {
      let winnerTeam, loserTeam, winnerIso, loserIso;
      if (refMatch.homeScore > refMatch.awayScore) {
        winnerTeam = refMatch.homeTeam; winnerIso = refMatch.homeIso;
        loserTeam = refMatch.awayTeam; loserIso = refMatch.awayIso;
      } else if (refMatch.awayScore > refMatch.homeScore) {
        winnerTeam = refMatch.awayTeam; winnerIso = refMatch.awayIso;
        loserTeam = refMatch.homeTeam; loserIso = refMatch.homeIso;
      } else {
        return { name: `${code}`, iso: null };
      }
      return isWinner
        ? { name: winnerTeam, iso: winnerIso }
        : { name: loserTeam, iso: loserIso };
    }
    return { name: `${isWinner ? 'W' : 'L'} M${refNum}`, iso: null };
  }

  return { name: code, iso: null };
}

function statusBadge(match) {
  if (match.status === 'IN_PLAY') {
    return `<span class="badge badge-live">LIVE</span>`;
  }
  if (match.status === 'PAUSED') {
    return `<span class="badge badge-ht">HT</span>`;
  }
  if (match.status === 'FINISHED') {
    return `<span class="badge badge-ft">FT</span>`;
  }
  return `<span class="badge badge-soon">${match.kickoff ? formatKickoff(match.kickoff) : 'TBD'}</span>`;
}

function espnEventsHtml(match) {
  const ev = match._espnEvents;
  if (!ev || (!ev.home.length && !ev.away.length)) return '';
  const homeHtml = ev.home.map(g => `<span class="goal-event">⚽ ${g}</span>`).join('');
  const awayHtml = ev.away.map(g => `<span class="goal-event">${g} ⚽</span>`).join('');
  return `<div class="match-events"><div class="me-home">${homeHtml}</div><div class="me-away">${awayHtml}</div></div>`;
}

function espnStatsHtml(match) {
  const s = match._espnStats;
  if (!s) return '';
  const h = s.home || {};
  const a = s.away || {};
  const poss = h.possessionPct ?? h.possession ?? null;
  if (!isFinite(poss) && !isFinite(h.totalShots) && !isFinite(h.shots)) return '';

  const possH = isFinite(poss) ? Math.round(poss) : 50;
  const possA = 100 - possH;

  const rows = [];
  const sh = h.totalShots ?? h.shots, sa = a.totalShots ?? a.shots;
  if (isFinite(sh) && isFinite(sa)) rows.push([sh, 'Shots', sa]);
  const oh = h.shotsOnTarget, oa = a.shotsOnTarget;
  if (isFinite(oh) && isFinite(oa)) rows.push([oh, 'On target', oa]);
  const ch = h.wonCorners ?? h.cornerKicks ?? h.corners, ca = a.wonCorners ?? a.cornerKicks ?? a.corners;
  if (isFinite(ch) && isFinite(ca)) rows.push([ch, 'Corners', ca]);
  const yh = h.yellowCards ?? 0, ya = a.yellowCards ?? 0;
  if (yh > 0 || ya > 0) rows.push([
    `<span class="ycard">${yh}</span>`, 'Yellows', `<span class="ycard">${ya}</span>`
  ]);
  const rh = h.redCards ?? 0, ra = a.redCards ?? 0;
  if (rh > 0 || ra > 0) rows.push([
    `<span class="rcard">${rh}</span>`, 'Reds', `<span class="rcard">${ra}</span>`
  ]);

  const hColor = match._espnColors?.home || 'var(--blue)';
  const aColor = match._espnColors?.away || 'var(--red)';
  const blur = 20;
  const barStyle = `background: linear-gradient(to right, ${hColor} ${Math.max(0,possH-blur)}%, ${aColor} ${Math.min(100,possH+blur)}%)`;

  return `<div class="match-stats">
    <div class="stats-poss">
      <span class="stats-poss-h" style="color:${hColor}">${possH}%</span>
      <div class="stats-poss-bar" style="${barStyle}"></div>
      <span class="stats-poss-a" style="color:${aColor}">${possA}%</span>
    </div>${rows.length ? `<div class="stats-grid">${rows.map(([hv, l, av]) =>
      `<span class="sg-h">${hv}</span><span class="sg-l">${l}</span><span class="sg-a">${av}</span>`
    ).join('')}</div>` : ''}
  </div>`;
}

// Renders the text + scroll controls for a match's live commentary.
// Tracks position by `_commentarySeq` (not raw index) so new comments arriving
// mid-scroll don't yank the user away from the one they're viewing; defaults to
// the latest comment (idx 0) whenever `_commentarySeq` is unset/not found. The
// full commentary history is retained (see fetchESPNCommentary), and
// scheduleCommentaryResume() snaps back to the latest after a period of
// inactivity following manual navigation.
function commentaryInnerHtml(match) {
  const items = match._espnCommentary;
  if (!items?.length) return '';
  let idx = items.findIndex(c => c.sequence === match._commentarySeq);
  if (idx === -1) idx = 0;
  match._commentarySeq = items[idx].sequence;
  const item = items[idx];
  const timeLabel = item.time?.displayValue ? `[${item.time.displayValue}] ` : '';
  const navHtml = items.length > 1 ? `
    <div class="mc-nav">
      <button class="mc-btn" data-matchnum="${match.matchNum}" data-dir="1" ${idx >= items.length - 1 ? 'disabled' : ''} aria-label="Older comment" title="Older">‹</button>
      <span class="mc-count">${idx + 1}/${items.length}</span>
      <button class="mc-btn" data-matchnum="${match.matchNum}" data-dir="-1" ${idx === 0 ? 'disabled' : ''} aria-label="Newer comment" title="Newer">›</button>
    </div>` : '';
  return `<span class="mc-icon">📰</span><span class="mc-text">${timeLabel}${item.text}</span>${navHtml}`;
}

// How long to wait after the user last manually navigated commentary before
// snapping back to showing the latest comment.
const COMMENTARY_RESUME_MS = 15000;
const commentaryResumeTimers = new Map();

// Schedules a snap-back-to-latest for a match's commentary after a period of
// inactivity following manual navigation. Re-looks-up the match by matchNum
// when the timer fires (not a closed-over reference) since state.matches is
// wholesale-replaced by fetchData() on every data.json poll.
function scheduleCommentaryResume(matchNum) {
  clearTimeout(commentaryResumeTimers.get(matchNum));
  const timer = setTimeout(() => {
    commentaryResumeTimers.delete(matchNum);
    const match = state.matches.find(m => m.matchNum === matchNum);
    if (!match?._espnCommentary?.length) return;
    match._commentarySeq = match._espnCommentary[0].sequence;
    document.querySelectorAll(`.match-commentary[data-matchnum="${matchNum}"]`).forEach(node => {
      node.classList.remove('mc-anim');
      void node.offsetWidth;
      node.innerHTML = commentaryInnerHtml(match);
      node.classList.add('mc-anim');
    });
  }, COMMENTARY_RESUME_MS);
  commentaryResumeTimers.set(matchNum, timer);
}

function matchCardHtml(match, extraLabel, opts = {}) {
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const hasScore = isLive || match.status === 'FINISHED';
  const hs = hasScore && match.homeScore !== null && match.homeScore !== undefined ? match.homeScore : null;
  const as = hasScore && match.awayScore !== null && match.awayScore !== undefined ? match.awayScore : null;
  const homeWon = hs !== null && as !== null && hs > as;
  const awayWon = hs !== null && as !== null && as > hs;
  const homeClass = homeWon ? 'winner' : awayWon ? 'loser' : '';
  const awayClass = awayWon ? 'winner' : homeWon ? 'loser' : '';

  const scoreHtml = hasScore
    ? `<div class="score">${hs !== null ? hs : '-'} – ${as !== null ? as : '-'}</div>`
    : `<div class="score vs">vs</div>`;

  let scoreSubHtml = '';
  if (match.status === 'IN_PLAY') {
    const minute = getMatchMinute(match);
    scoreSubHtml = `<div class="score-sub live match-clock" data-matchnum="${match.matchNum}">${minute || '1\''}</div>`;
  } else if (match.status === 'PAUSED') {
    scoreSubHtml = `<div class="score-sub live match-clock">HT</div>`;
  }

  const venueText = match.venue || '';
  const extraLabelHtml = extraLabel ? `<span class="badge badge-soon" style="font-size:11px;">${extraLabel}</span>` : '';
  const headlineHtml = match._espnHeadline && !opts.suppressStats
    ? `<div class="match-headline">${match._espnHeadline}</div>` : '';

  // Live commentary: most recent item by default, scrollable via nav controls, only on live/paused match cards
  let commentaryHtml = '';
  if (isLive && match._espnCommentary?.length) {
    commentaryHtml = `<div class="match-commentary mc-anim" data-matchnum="${match.matchNum}">${commentaryInnerHtml(match)}</div>`;
  }

  return `
    <div class="match-card ${isLive ? 'live' : ''}" data-matchnum="${match.matchNum}">
      <div class="match-meta-bar">
        <div class="match-meta-left">${statusBadge(match)}${extraLabelHtml}</div>
        ${venueText ? `<div class="match-meta-right">${venueText}</div>` : ''}
      </div>
      <div class="match-teams">
        <div class="match-home">
          <span class="team-name ${homeClass} team-link" data-team="${match.homeTeam || ''}">${match.homeTeam || 'TBD'}</span>
          <span class="flag-link" data-team="${match.homeTeam || ''}">${flagImg(match.homeIso, match.homeTeam)}</span>
        </div>
        <div class="score-col">
          ${scoreHtml}
          ${scoreSubHtml}
        </div>
        <div class="match-away">
          <span class="flag-link" data-team="${match.awayTeam || ''}">${flagImg(match.awayIso, match.awayTeam)}</span>
          <span class="team-name ${awayClass} team-link" data-team="${match.awayTeam || ''}">${match.awayTeam || 'TBD'}</span>
        </div>
      </div>
      ${hasScore && !opts.suppressStats ? espnEventsHtml(match) : ''}
      ${hasScore && !opts.suppressStats ? espnStatsHtml(match) : ''}
      ${commentaryHtml}
      ${headlineHtml}
    </div>
  `;
}

// ===== RENDER DASHBOARD =====
function renderDashboard() {
  const el = document.getElementById('view-dashboard');
  const liveMatches = state.matches.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  const todayMatches = getTodayMatches();
  const upNext = state.matches.filter(m => m.status === 'SCHEDULED').slice(0, 5);

  // Team filter logic
  let filteredMatches = null;
  if (state.teamFilter) {
    filteredMatches = state.matches.filter(m =>
      m.homeTeam === state.teamFilter || m.awayTeam === state.teamFilter
    );
  }

  const teamNames = Object.keys(TEAM_MASTER_DATA).sort();
  const datalistHtml = `<datalist id="team-datalist">${teamNames.map(t => `<option value="${t}">`).join('')}</datalist>`;

  if (state.teamFilter && filteredMatches) {
    const meta = TEAM_MASTER_DATA[state.teamFilter];
    const html = `
      <div class="search-container">
        <input list="team-datalist" id="team-search" class="search-input" placeholder="Search team..." value="${state.teamFilter || ''}">
        ${state.teamFilter ? `<button id="team-search-clear" class="search-clear" aria-label="Clear search">✕</button>` : ''}
        ${datalistHtml}
      </div>
      <div class="card">
        <div class="card-title">
          ${meta ? flagImg(meta.iso, state.teamFilter) : ''}
          ${state.teamFilter}
          ${meta ? `<span class="group-label">Group ${meta.group}</span>` : ''}
        </div>
        ${filteredMatches.length ? filteredMatches.map(m => matchCardHtml(m)).join('') : '<div class="empty-state">No matches found.</div>'}
      </div>
    `;
    morphInto(el, html);
  } else {
    // Hero stats
    const totalMatches = state.matches.length;
    const liveCount = liveMatches.length;
    const todayCount = todayMatches.length;

    // Determine tournament day / stage eyebrow
    const finishedCount = state.matches.filter(m => m.status === 'FINISHED').length;
    const groupStageMatches = state.matches.filter(m => m.stage === 'Group Stage');
    const inKnockout = state.matches.some(m => m.stage !== 'Group Stage' && (m.status === 'FINISHED' || m.status === 'IN_PLAY'));
    const stageName = inKnockout ? 'Knockout Stage' : 'Group Stage';

    // Match day = number of distinct kickoff dates that have at least one started match
    const startedDates = new Set(
      state.matches
        .filter(m => m.status === 'FINISHED' || m.status === 'IN_PLAY' || m.status === 'PAUSED')
        .map(m => m.kickoff ? m.kickoff.slice(0, 10) : null)
        .filter(Boolean)
    );
    const matchDay = Math.max(1, startedDates.size);

    const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' });
    const eyebrow = `${stageName} · Day ${matchDay} · ${todayLabel}`;

    // Live & Today card — union of live + today's remaining
    const todayNonLive = todayMatches.filter(m => m.status !== 'IN_PLAY' && m.status !== 'PAUSED');
    const liveAndToday = [...liveMatches, ...todayNonLive];
    const liveAndTodayMeta = liveCount > 0
      ? `${liveCount} in play · ${todayNonLive.filter(m => m.status === 'SCHEDULED').length} upcoming`
      : `${todayMatches.length} today`;

    // Dynamic live standings: show group of the first live match; fall back to most-played group
    const liveGroup = (() => {
      if (liveMatches.length) {
        const m = liveMatches[0];
        return TEAM_MASTER_DATA[m.homeTeam]?.group || TEAM_MASTER_DATA[m.awayTeam]?.group || null;
      }
      // Fall back to group with most matches played
      const counts = {};
      for (const m of state.matches) {
        if (m.status === 'FINISHED' && m.stage === 'Group Stage') {
          const g = TEAM_MASTER_DATA[m.homeTeam]?.group;
          if (g) counts[g] = (counts[g] || 0) + 1;
        }
      }
      const entries = Object.entries(counts);
      if (!entries.length) return 'A';
      return entries.sort((a, b) => b[1] - a[1])[0][0];
    })();

    // Dashboard standings: always live when matches are in play, regardless of global toggle
    const dashLive = liveMatches.length > 0 || state.liveMode;
    const dashStatuses = dashLive ? ['FINISHED', 'IN_PLAY', 'PAUSED'] : ['FINISHED'];
    const computedStandings = dashLive ? computeStandings(state.matches, dashStatuses) : state.standings;
    const groupTeams = liveGroup ? (computedStandings[liveGroup] || []) : [];
    const standingsMetaLabel = liveMatches.length
      ? '<span class="badge badge-live" style="font-size:10px;padding:2px 8px;animation:blink 1.6s infinite;">LIVE</span> Live group'
      : 'Most played group';

    const standingsHtml = `
      <div class="card-header">
        <div class="card-title">Group Standings</div>
        <div class="card-meta">${standingsMetaLabel}</div>
      </div>
      <div class="group-header">
        <div class="group-pill">${liveGroup}</div>
        <div class="group-name">Group ${liveGroup}</div>
      </div>
      <table class="condensed">
        <thead>
          <tr>
            <th colspan="2">Team</th>
            <th class="num">P</th>
            <th class="num">GD</th>
            <th class="num">Pts</th>
          </tr>
        </thead>
        <tbody>
          ${groupTeams.map((t, i) => {
            const rowClass = i === 0 ? 'q1' : i === 1 ? 'q2' : i === 2 ? 'q3' : '';
            return `<tr class="${rowClass}">
              <td><span class="pos">${i + 1}</span></td>
              <td><div class="team-cell">${flagImg(t.iso, t.team)}<span>${t.team}</span></div></td>
              <td class="num">${t.played}</td>
              <td class="num">${t.gd >= 0 ? '+' + t.gd : t.gd}</td>
              <td class="num" style="font-weight:700">${t.pts}</td>
            </tr>`;
          }).join('')}
          ${groupTeams.length === 0 ? `<tr><td colspan="5" class="empty-state">No matches played</td></tr>` : ''}
        </tbody>
      </table>
      <div class="qualify-legend">
        <span><span class="swatch" style="background:var(--green)"></span> Advance</span>
        <span><span class="swatch" style="background:var(--amber)"></span> 3rd wildcard</span>
      </div>
    `;

    const html = `
      <div class="search-container">
        <input list="team-datalist" id="team-search" class="search-input" placeholder="Search team..." value="">
        ${datalistHtml}
      </div>
      <div class="page-hero">
        <div>
          <div class="hero-eyebrow">${eyebrow}</div>
          <div class="hero-title">FIFA World Cup 2026</div>
        </div>
        <div class="hero-stats">
          <div class="hero-stat">
            <div class="hero-stat-num">${liveCount}</div>
            <div class="hero-stat-label">Live now</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-num">${todayCount}</div>
            <div class="hero-stat-label">Today</div>
          </div>
          <div class="hero-stat">
            <div class="hero-stat-num">${finishedCount}</div>
            <div class="hero-stat-label">Played</div>
          </div>
        </div>
      </div>

      <div class="card" style="grid-column:1/-1; margin-bottom:16px;">
        <div class="card-header">
          <div class="card-title">${liveCount > 0 ? '🔴 Live &amp; Today' : 'Today\'s Matches'}</div>
          <div class="card-meta">${liveAndTodayMeta}</div>
        </div>
        ${liveAndToday.length ? liveAndToday.map(m => matchCardHtml(m)).join('') : '<div class="empty-state">No matches today.</div>'}
      </div>

      <div class="dashboard-grid">
        <div class="card">${standingsHtml}</div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">Up Next</div>
            <div class="card-meta">Upcoming</div>
          </div>
          ${upNext.length ? upNext.map(m => matchCardHtml(m, null, { suppressStats: true })).join('') : '<div class="empty-state">No upcoming matches.</div>'}
        </div>
      </div>
    `;
    morphInto(el, html);
  }

  // Bind team search
  const searchEl = document.getElementById('team-search');
  if (searchEl) {
    searchEl.addEventListener('change', (e) => {
      const val = e.target.value.trim();
      if (TEAM_MASTER_DATA[val]) {
        state.teamFilter = val;
      } else if (!val) {
        state.teamFilter = null;
      }
      renderDashboard();
    });
    searchEl.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (!val) {
        state.teamFilter = null;
        renderDashboard();
      }
    });
  }
  const clearEl = document.getElementById('team-search-clear');
  if (clearEl) {
    clearEl.addEventListener('click', () => {
      state.teamFilter = null;
      renderDashboard();
    });
  }
}

function getTodayMatches() {
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
  return state.matches.filter(m => {
    if (!m.kickoff) return false;
    const d = new Date(m.kickoff).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    return d === todayStr;
  });
}

// ===== RENDER SCHEDULE =====
function renderSchedule(opts = {}) {
  const el = document.getElementById('view-schedule');
  const matches = state.matches;

  // Group by local Pacific date
  const byDate = {};
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

  for (const m of matches) {
    const dateKey = m.kickoff ? dtf.format(new Date(m.kickoff)) : 'TBD';
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(m);
  }

  let todayId = null;
  let html = '';
  for (const [date, dayMatches] of Object.entries(byDate)) {
    const firstMatch = dayMatches.find(m => m.kickoff);
    const isToday = firstMatch
      ? new Date(firstMatch.kickoff).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) === todayStr
      : false;
    const id = isToday ? ' id="schedule-today"' : '';
    if (isToday) todayId = 'schedule-today';
    html += `<div class="date-header"${id}>${date}</div>`;
    for (const m of dayMatches) {
      const label = m.stage === 'Group Stage' && m.group ? `Group ${m.group}` : (m.stage || '');
      html += matchCardHtml(m, label, { suppressStats: true });
    }
  }

  morphInto(el, html || '<div class="empty-state">No matches to display.</div>');

  // Scroll to today after render (skip on silent background refreshes)
  if (todayId && !opts.silent) {
    requestAnimationFrame(() => {
      const todayEl = document.getElementById(todayId);
      if (todayEl) {
        const headerH = document.getElementById('app-header')?.offsetHeight || 64;
        const top = todayEl.getBoundingClientRect().top + window.scrollY - headerH - 12;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  }
}

// ===== RENDER STANDINGS =====
function renderStandings() {
  const el = document.getElementById('view-standings');
  const statuses = state.liveMode ? ['FINISHED', 'IN_PLAY', 'PAUSED'] : ['FINISHED'];
  const computedStandings = state.liveMode ? computeStandings(state.matches, statuses) : state.standings;

  const modeLabel = state.liveMode
    ? `<span class="standings-mode-label live-mode">Live (includes in-play)</span>`
    : `<span class="standings-mode-label official">Official (finished only)</span>`;

  let html = `<div class="standings-header">
    <span class="standings-title">Group Standings</span>
    ${modeLabel}
  </div>`;

  html += `<div class="standings-grid">`;

  for (const grp of 'ABCDEFGHIJKL'.split('')) {
    const teams = computedStandings[grp] || [];
    html += `
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="group-header" style="padding:10px 14px;border-bottom:1px solid var(--border);margin-bottom:0;">
          <div class="group-pill">${grp}</div>
          <div class="group-name">Group ${grp}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:28px;">#</th>
              <th>Team</th>
              <th class="num">P</th>
              <th class="num">W</th>
              <th class="num">D</th>
              <th class="num">L</th>
              <th class="num">GF</th>
              <th class="num">GA</th>
              <th class="num">GD</th>
              <th class="num">Pts</th>
            </tr>
          </thead>
          <tbody>
    `;
    for (let i = 0; i < teams.length; i++) {
      const t = teams[i];
      const rowClass = i === 0 ? 'q1' : i === 1 ? 'q2' : i === 2 ? 'q3' : '';
      html += `
        <tr class="${rowClass}">
          <td><span class="pos">${i + 1}</span></td>
          <td>
            <div class="team-cell team-link" data-team="${t.team}" style="cursor:pointer;">
              <span class="flag-link" data-team="${t.team}">${flagImg(t.iso, t.team)}</span>
              <span>${t.team}</span>
            </div>
          </td>
          <td class="num">${t.played}</td>
          <td class="num">${t.won}</td>
          <td class="num">${t.drawn}</td>
          <td class="num">${t.lost}</td>
          <td class="num">${t.gf}</td>
          <td class="num">${t.ga}</td>
          <td class="num">${t.gd >= 0 ? '+' + t.gd : t.gd}</td>
          <td class="num" style="font-weight:700;">${t.pts}</td>
        </tr>
      `;
    }
    if (teams.length === 0) {
      html += `<tr><td colspan="10" class="empty-state">No matches played</td></tr>`;
    }
    html += `</tbody></table></div>`;
  }

  html += `</div>
  <div class="qualify-legend">
    <span><span class="swatch" style="background:var(--green);"></span> Auto qualify (1st/2nd)</span>
    <span><span class="swatch" style="background:var(--amber);"></span> Third place (best 8 advance)</span>
  </div>`;

  // Third-place wildcard section
  const thirdPlace = computeThirdPlaceRankings(computedStandings);
  if (thirdPlace.length) {
    html += `
      <div class="card" style="margin-top:24px;">
        <div class="card-title">Third-Place Wildcard Rankings</div>
        <p class="note-text" style="margin-bottom:10px;">Best 8 of 12 third-place teams advance to Round of 32</p>
        <table>
          <thead>
            <tr>
              <th style="width:28px;">#</th>
              <th>Team</th>
              <th class="num">Group</th>
              <th class="num">P</th>
              <th class="num">W</th>
              <th class="num">D</th>
              <th class="num">L</th>
              <th class="num">GF</th>
              <th class="num">GA</th>
              <th class="num">GD</th>
              <th class="num">Pts</th>
            </tr>
          </thead>
          <tbody>
    `;
    for (let i = 0; i < thirdPlace.length; i++) {
      const t = thirdPlace[i];
      const rowClass = i < 8 ? 'wildcard-qualify' : '';
      html += `
        <tr class="${rowClass}">
          <td><span class="pos-num">${i + 1}</span></td>
          <td>
            <div class="team-cell">
              ${flagImg(t.iso, t.team)}
              <span>${t.team}</span>
            </div>
          </td>
          <td class="num"><span class="group-label">${t.groupLetter}</span></td>
          <td class="num">${t.played}</td>
          <td class="num">${t.won}</td>
          <td class="num">${t.drawn}</td>
          <td class="num">${t.lost}</td>
          <td class="num">${t.gf}</td>
          <td class="num">${t.ga}</td>
          <td class="num">${t.gd >= 0 ? '+' + t.gd : t.gd}</td>
          <td class="num" style="font-weight:700;">${t.pts}</td>
        </tr>
      `;
    }
    html += `</tbody></table></div>`;
  }

  morphInto(el, html);
}

// ===== RENDER BRACKET =====
function renderBracket() {
  const el = document.getElementById('view-bracket');
  const groupMatches = state.matches.filter(m => m.stage === 'Group Stage');
  const groupStageComplete = groupMatches.length > 0 && groupMatches.every(m => m.status === 'FINISHED');

  const statuses = state.liveMode ? ['FINISHED', 'IN_PLAY', 'PAUSED'] : ['FINISHED'];
  const resolveGroupSlots = groupStageComplete || state.liveMode;
  const computedStandings = resolveGroupSlots
    ? (state.liveMode ? computeStandings(state.matches, statuses) : state.standings)
    : {};
  const thirdPlace = resolveGroupSlots ? computeThirdPlaceRankings(computedStandings) : [];
  const topEight = thirdPlace.slice(0, 8);
  const combinationString = resolveGroupSlots ? getThirdPlaceCombinationString(topEight) : '';

  function resolveAndRender(placeholder) {
    if (!placeholder) return { name: 'TBD', iso: null };
    if (!placeholder.startsWith('[')) return { name: placeholder, iso: null };
    if (!resolveGroupSlots) return { name: placeholder.replace(/^\[|\]$/g, ''), iso: null };
    return resolveTeam(placeholder, computedStandings, thirdPlace, combinationString);
  }

  function bMatchHtml(match) {
    const home = resolveAndRender(match.homeTeam);
    const away = resolveAndRender(match.awayTeam);
    const hasScore = match.status === 'FINISHED' || match.status === 'IN_PLAY' || match.status === 'PAUSED';
    const homeWon = hasScore && match.homeScore > match.awayScore;
    const awayWon = hasScore && match.awayScore > match.homeScore;

    return `
      <div class="b-match">
        <div class="b-num">M${match.matchNum}</div>
        <div class="b-team ${homeWon ? 'winner' : ''}" data-team="${home.name}" style="cursor:${TEAM_MASTER_DATA[home.name] ? 'pointer' : 'default'}">
          <span class="flag-link" data-team="${home.name}">${flagImg(home.iso, home.name)}</span>
          <span class="b-team-name team-link" data-team="${home.name}">${home.name}</span>
          ${hasScore ? `<span class="b-score">${match.homeScore}</span>` : ''}
        </div>
        <hr class="b-div">
        <div class="b-team ${awayWon ? 'winner' : ''}" data-team="${away.name}" style="cursor:${TEAM_MASTER_DATA[away.name] ? 'pointer' : 'default'}">
          <span class="flag-link" data-team="${away.name}">${flagImg(away.iso, away.name)}</span>
          <span class="b-team-name team-link" data-team="${away.name}">${away.name}</span>
          ${hasScore ? `<span class="b-score">${match.awayScore}</span>` : ''}
        </div>
      </div>
    `;
  }

  function bSlot(match) {
    return `<div class="b-slot">${bMatchHtml(match)}</div>`;
  }

  const r32 = state.matches.filter(m => m.stage === 'Round of 32');
  const r16 = state.matches.filter(m => m.stage === 'Round of 16');
  const qf = state.matches.filter(m => m.stage === 'Quarterfinals');
  const sf = state.matches.filter(m => m.stage === 'Semifinals');
  const final = state.matches.filter(m => m.stage === 'Final');
  const thirdPlaceMatch = state.matches.filter(m => m.stage === 'Third Place');

  let html = `<div class="bracket-wrapper"><div class="bracket">`;

  html += `<div class="bracket-round r32">
    <div class="round-label">Round of 32</div>
    ${r32.map(bSlot).join('')}
  </div>`;

  html += `<div class="bracket-round r16">
    <div class="round-label">Round of 16</div>
    ${r16.map(bSlot).join('')}
  </div>`;

  html += `<div class="bracket-round rqf">
    <div class="round-label">Quarterfinals</div>
    ${qf.map(bSlot).join('')}
  </div>`;

  html += `<div class="bracket-round rsf">
    <div class="round-label">Semifinals</div>
    ${sf.map(bSlot).join('')}
  </div>`;

  html += `<div class="bracket-round rfin">
    <div class="round-label">Final</div>
    ${final.map(bSlot).join('')}
    <div class="round-label" style="margin-top:16px;">3rd Place</div>
    ${thirdPlaceMatch.map(bSlot).join('')}
  </div>`;

  html += `</div></div>`;
  morphInto(el, html);
}

// ===== RENDER VIEW =====
function renderView(opts = {}) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

  const viewEl = document.getElementById(`view-${state.currentView}`);
  if (viewEl) viewEl.classList.add('active');

  const tabEl = document.querySelector(`.nav-tab[data-view="${state.currentView}"]`);
  if (tabEl) tabEl.classList.add('active');

  // Sync main top margin to actual header height (handles dynamic header height on mobile)
  const header = document.getElementById('app-header');
  const main = document.getElementById('app-main');
  if (header) header.dataset.view = state.currentView; // lets CSS hide the live-mode toggle on views it doesn't affect (e.g. Schedule)
  if (header && main) main.style.marginTop = header.offsetHeight + 'px';

  // Scroll to top on all views except schedule (which scrolls to today itself), and not on silent background refreshes
  const savedScroll = opts.silent ? window.scrollY : null;
  if (!opts.silent && state.currentView !== 'schedule') window.scrollTo({ top: 0, behavior: 'instant' });

  switch (state.currentView) {
    case 'dashboard': renderDashboard(); break;
    case 'schedule': renderSchedule({ silent: opts.silent }); break;
    case 'standings': renderStandings(); break;
    case 'bracket': renderBracket(); break;
  }

  if (savedScroll !== null) window.scrollTo({ top: savedScroll, behavior: 'instant' });
}

// ===== FETCH DATA =====

// combinations.json is static (495 fixed group-letter entries, never changes at
// runtime) — fetch it once on startup instead of re-downloading/re-parsing it on
// every fetchData() poll.
async function fetchCombinations() {
  try {
    const res = await fetch('./data/combinations.json');
    if (res.ok) state.combinations = await res.json();
  } catch (e) {
    console.error('combinations.json fetch error:', e);
  }
}

// fifa_rankings.json is regenerated by update_tracker.js whenever a newer FIFA ranking
// snapshot is added to blueprint_data/ — fetch it once on startup, same as combinations.json.
// Falls back to the TEAM_MASTER_DATA snapshot (see fifaRankOf) if this 404s or is stale.
async function fetchFifaRankings() {
  try {
    const res = await fetch('./data/fifa_rankings.json');
    if (res.ok) state.fifaRankings = (await res.json()).ranks || {};
  } catch (e) {
    console.error('fifa_rankings.json fetch error:', e);
  }
}

async function fetchData() {
  if (state._dataFetchInFlight) return; // avoid overlapping polls if a previous one is slow
  state._dataFetchInFlight = true;
  try {
    const res = await fetch('./data/data.json?' + Date.now());
    if (!res.ok) throw new Error('data.json fetch failed: ' + res.status);
    const data = await res.json();

    // The Actions cron only commits data.json every ~5 minutes, but we poll it every
    // 2 — most ticks see byte-identical content. Skip the match/standings rebuild and
    // re-render entirely when nothing has actually changed since the last fetch.
    if (data.lastUpdated && data.lastUpdated === state.fdLastUpdated) return;

    // Merge data.json onto existing match objects. While ESPN is reachable, it's the
    // source of truth for any match it's actively tracking (espnEventId set) — its
    // status/score/clock/stats take precedence over football-data.org's data.json,
    // which is only authoritative once ESPN is unreachable, or for matches ESPN
    // doesn't cover at all (its scoreboard is scoped to today's matches only).
    const ESPN_FIELDS = ['_espnClock','_espnDisplayClock','_espnPeriod','_espnFetchedAt',
      '_espnStats','_espnColors','_espnEvents','_espnHeadline','_espnCommentary','_commentarySeq','espnEventId'];
    const ESPN_AUTHORITATIVE_FIELDS = ['status', 'homeScore', 'awayScore', 'homeFairPlay', 'awayFairPlay'];
    const existingByNum = new Map(state.matches.map(m => [m.matchNum, m]));
    state.matches = (data.matches || []).map(nm => {
      const ex = existingByNum.get(nm.matchNum);
      if (!ex) return nm;
      const fields = (state.espnSynced && ex.espnEventId) ? [...ESPN_FIELDS, ...ESPN_AUTHORITATIVE_FIELDS] : ESPN_FIELDS;
      const espn = Object.fromEntries(fields.filter(k => k in ex).map(k => [k, ex[k]]));
      return { ...nm, ...espn };
    });
    state.standings = data.standings || {};
    state.lastUpdated = data.lastUpdated || null;
    state.fdLastUpdated = data.lastUpdated || null;

    // Update sync info — if ESPN has been syncing, don't overwrite with older timestamp
    if (!state.espnSynced) updateSyncPill(formatLastSync(state.lastUpdated));

    // Silent: this can fire mid-session (initial load, background poll, or a
    // resume re-sync) and must never yank the user's scroll position to the top.
    renderView({ silent: true });
  } catch (e) {
    console.error('fetchData error:', e);
  } finally {
    state._dataFetchInFlight = false;
  }
}

// ===== RESUME / VISIBILITY =====
// Installed Android PWAs throttle or fully suspend setInterval timers while
// backgrounded (screen off, app switched away). Without an explicit resume
// hook, the UI sits on stale data — wrong score, stale live badge, stale
// commentary — until the next throttled timer eventually fires. Force an
// immediate re-sync whenever the page becomes visible/focused again, and
// restart the interval timers so their next tick is measured from "now"
// instead of from whenever they last fired before being suspended.
function restartPollIntervals() {
  if (state.espnInterval) clearInterval(state.espnInterval);
  state.espnInterval = setInterval(fetchESPN, 10000);
  if (state.syncInterval) clearInterval(state.syncInterval);
  state.syncInterval = setInterval(fetchData, 2 * 60 * 1000);
}

async function resyncNow() {
  await Promise.all([fetchData(), fetchESPN()]); // each guards its own re-entrancy
  restartPollIntervals();
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') resyncNow();
});
window.addEventListener('online', resyncNow);
// `persisted` is true only for back/forward-cache restores (the common case when
// resuming an installed PWA on Android), not for the initial page load.
window.addEventListener('pageshow', (e) => { if (e.persisted) resyncNow(); });

// ===== TICK =====
function tick() {
  const clocks = document.querySelectorAll('.match-clock[data-matchnum]');
  clocks.forEach(clockEl => {
    const matchNum = parseInt(clockEl.dataset.matchnum, 10);
    const match = state.matches.find(m => m.matchNum === matchNum);
    if (!match) return;
    if (match.status === 'IN_PLAY') {
      const min = getMatchMinute(match);
      if (min !== null && min !== undefined) clockEl.textContent = min;
    }
  });

  // Also update last-sync display
  if (state.lastUpdated) {
    const label = formatLastSync(state.lastUpdated);
    updateSyncPill(state.espnSynced ? label + ' (ESPN)' : label);
  }
}

// ===== TEAM MODAL =====
function teamMatchRows(teamName) {
  const played = state.matches.filter(m =>
    (m.homeTeam === teamName || m.awayTeam === teamName) && m.status === 'FINISHED'
  );
  if (!played.length) return '<p style="color:var(--ink-3);font-size:13px;">No results yet.</p>';

  return played.map(m => {
    const isHome = m.homeTeam === teamName;
    const opp = isHome ? m.awayTeam : m.homeTeam;
    const oppIso = isHome ? m.awayIso : m.homeIso;
    const ts = isHome ? `${m.homeScore}–${m.awayScore}` : `${m.awayScore}–${m.homeScore}`;
    const myScore = isHome ? m.homeScore : m.awayScore;
    const oppScore = isHome ? m.awayScore : m.homeScore;
    const result = myScore > oppScore ? 'W' : myScore < oppScore ? 'L' : 'D';
    const rc = result === 'W' ? '#16A34A' : result === 'L' ? '#DC2626' : '#CA8A04';
    const kickoffStr = m.kickoff ? new Date(m.kickoff).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' }) : '';
    const label = m.stage === 'Group Stage' ? `Group ${m.group}` : (m.stage || '');
    return `
      <div class="tm-result-row">
        <span class="tm-result-badge" style="background:${rc}">${result}</span>
        <span class="tm-score">${ts}</span>
        ${flagImg(oppIso, opp)}
        <span class="tm-opp">${opp}</span>
        <span class="tm-meta">${[label, kickoffStr].filter(Boolean).join(' · ')}</span>
      </div>`;
  }).join('');
}

function teamStatsAggregate(teamName, espnDataByMatch) {
  // espnDataByMatch: Map of matchNum → parsed ESPN event data (may be empty for historical)
  const finished = state.matches.filter(m =>
    (m.homeTeam === teamName || m.awayTeam === teamName) && m.status === 'FINISHED'
  );
  if (!finished.length) return null;

  let poss = 0, shots = 0, onTarget = 0, corners = 0, fouls = 0, yellows = 0, reds = 0, n = 0;
  for (const m of finished) {
    const isHome = m.homeTeam === teamName;
    // Prefer fetched historical data, fall back to in-memory ESPN stats
    const espn = espnDataByMatch?.get(m.matchNum);
    const s = espn ? (isHome ? espn.stats.home : espn.stats.away)
                   : (m._espnStats ? (isHome ? m._espnStats.home : m._espnStats.away) : null);
    if (!s) continue;
    poss     += s.possessionPct || 0;
    shots    += s.totalShots    || 0;
    onTarget += s.shotsOnTarget || 0;
    corners  += s.wonCorners    || 0;
    fouls    += s.foulsCommitted || 0;
    yellows  += s.yellowCards   || 0;
    reds     += s.redCards      || 0;
    n++;
  }
  if (!n) return null;
  return {
    poss:     (poss / n).toFixed(0),
    shots:    (shots / n).toFixed(1),
    onTarget: (onTarget / n).toFixed(1),
    corners:  (corners / n).toFixed(1),
    fouls:    (fouls / n).toFixed(1),
    yellows, reds, n
  };
}

async function openTeamModal(teamName) {
  if (!teamName || !TEAM_MASTER_DATA[teamName]) return;
  const meta = TEAM_MASTER_DATA[teamName];
  const standings = state.standings[meta.group] || [];
  const standing = standings.find(t => t.team === teamName);
  const pos = standings.findIndex(t => t.team === teamName) + 1;

  // Remove any existing team modal
  document.getElementById('team-modal-overlay')?.remove();

  // Show skeleton immediately
  const overlay = document.createElement('div');
  overlay.id = 'team-modal-overlay';
  const posLabel = pos === 1 ? '1st' : pos === 2 ? '2nd' : pos === 3 ? '3rd' : pos ? `${pos}th` : '—';
  const recordHtml = standing
    ? `<div class="tm-record">
        <div class="tm-stat"><span class="tm-stat-num">${standing.pts}</span><span class="tm-stat-label">Pts</span></div>
        <div class="tm-stat"><span class="tm-stat-num">${standing.won}</span><span class="tm-stat-label">W</span></div>
        <div class="tm-stat"><span class="tm-stat-num">${standing.drawn}</span><span class="tm-stat-label">D</span></div>
        <div class="tm-stat"><span class="tm-stat-num">${standing.lost}</span><span class="tm-stat-label">L</span></div>
        <div class="tm-stat"><span class="tm-stat-num">${standing.gf}–${standing.ga}</span><span class="tm-stat-label">GF–GA</span></div>
        <div class="tm-stat"><span class="tm-stat-num">${posLabel}</span><span class="tm-stat-label">Group ${meta.group}</span></div>
      </div>`
    : '';

  overlay.innerHTML = `
    <div class="team-modal">
      <button class="team-modal-close" id="team-modal-close" aria-label="Close">✕</button>
      <div class="tm-header">
        ${flagImg(meta.iso, teamName)}
        <div>
          <div class="tm-name">${teamName}</div>
          <div class="tm-sub">Group ${meta.group}</div>
        </div>
      </div>
      ${recordHtml}
      <div id="tm-stats-section" class="tm-loading">Loading stats…</div>
      <div class="tm-section-label">Results</div>
      ${teamMatchRows(teamName)}
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => {
    overlay.classList.add('tm-out');
    overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
  };
  document.getElementById('team-modal-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); }, { once: true });
  requestAnimationFrame(() => overlay.classList.add('tm-in'));

  // Fetch historical ESPN data for each finished match day
  const finished = state.matches.filter(m =>
    (m.homeTeam === teamName || m.awayTeam === teamName) && m.status === 'FINISHED'
  );
  const espnDataByMatch = new Map();
  if (finished.length) {
    const dates = [...new Set(finished.map(m => kickoffToDateStr(m.kickoff)).filter(Boolean))];
    await Promise.all(dates.map(async dateStr => {
      const events = await fetchESPNDate(dateStr);
      for (const m of finished) {
        if (kickoffToDateStr(m.kickoff) !== dateStr) continue;
        const found = findESPNEvent(events, m.homeTeam, m.awayTeam);
        if (found) {
          const parsed = parseESPNEventData(found.comp, found.homeComp, found.awayComp, found.swapped);
          espnDataByMatch.set(m.matchNum, parsed);
        }
      }
    }));
  }

  const agg = teamStatsAggregate(teamName, espnDataByMatch);
  const statsEl = document.getElementById('tm-stats-section');
  if (statsEl) {
    statsEl.classList.remove('tm-loading');
    if (agg) {
      statsEl.innerHTML = `
        <div class="tm-section-label">Avg per match (${agg.n} played)</div>
        <div class="tm-agg-grid">
          <div class="tm-stat"><span class="tm-stat-num">${agg.poss}%</span><span class="tm-stat-label">Possession</span></div>
          <div class="tm-stat"><span class="tm-stat-num">${agg.shots}</span><span class="tm-stat-label">Shots</span></div>
          <div class="tm-stat"><span class="tm-stat-num">${agg.onTarget}</span><span class="tm-stat-label">On Target</span></div>
          <div class="tm-stat"><span class="tm-stat-num">${agg.corners}</span><span class="tm-stat-label">Corners</span></div>
          <div class="tm-stat"><span class="tm-stat-num">${agg.fouls}</span><span class="tm-stat-label">Fouls</span></div>
          <div class="tm-stat"><span class="tm-stat-num">${agg.yellows}</span><span class="tm-stat-label">Yellows</span></div>
          <div class="tm-stat"><span class="tm-stat-num">${agg.reds}</span><span class="tm-stat-label">Reds</span></div>
        </div>`;
    } else {
      statsEl.innerHTML = '';
    }
  }
}

// ===== MATCH DETAIL MODAL =====
function matchTimelineHtml(timeline, homeTeam, awayTeam) {
  if (!timeline.length) return '';
  const icons = {
    goal:    '⚽',
    ownGoal: '⚽ (og)',
    penalty: '⚽ (pen)',
    yellow:  '<span class="ycard">Y</span>',
    red:     '<span class="rcard">R</span>',
  };
  const rows = timeline.map(ev => {
    let icon;
    if (ev.isGoal && ev.isOwnGoal) icon = icons.ownGoal;
    else if (ev.isGoal && ev.isPenalty) icon = icons.penalty;
    else if (ev.isGoal) icon = icons.goal;
    else if (ev.isRed) icon = icons.red;
    else if (ev.isYellow) icon = icons.yellow;
    else return '';
    const side = ev.isHome ? 'home' : 'away';
    return `<div class="mdm-tl-row mdm-tl-${side}">
      <span class="mdm-tl-min">${ev.minute}'</span>
      <span class="mdm-tl-icon">${icon}</span>
      <span class="mdm-tl-player">${ev.player}</span>
    </div>`;
  }).filter(Boolean);
  if (!rows.length) return '';
  return `<div class="tm-section-label">Timeline</div><div class="mdm-timeline">${rows.join('')}</div>`;
}

function matchDetailStatsHtml(espnData, match) {
  const { stats, headline } = espnData;
  const h = stats.home, a = stats.away;
  const ph = h.possessionPct?.toFixed(0) ?? 0;
  const pa = a.possessionPct?.toFixed(0) ?? 0;
  const hColor = espnData.colors?.home || '#2563EB';
  const aColor = espnData.colors?.away || '#7C3AED';
  const barStyle = `background: linear-gradient(to right, ${hColor} ${ph}%, ${aColor} ${ph}%)`;

  const rows = [];
  if (h.totalShots || a.totalShots) rows.push([h.totalShots||0, 'Shots', a.totalShots||0]);
  if (h.shotsOnTarget || a.shotsOnTarget) rows.push([h.shotsOnTarget||0, 'On Target', a.shotsOnTarget||0]);
  if (h.wonCorners || a.wonCorners) rows.push([h.wonCorners||0, 'Corners', a.wonCorners||0]);
  if (h.foulsCommitted || a.foulsCommitted) rows.push([h.foulsCommitted||0, 'Fouls', a.foulsCommitted||0]);
  const yh = h.yellowCards||0, ya = a.yellowCards||0;
  if (yh || ya) rows.push([`<span class="ycard">${yh}</span>`, 'Yellows', `<span class="ycard">${ya}</span>`]);
  const rh = h.redCards||0, ra = a.redCards||0;
  if (rh || ra) rows.push([`<span class="rcard">${rh}</span>`, 'Reds', `<span class="rcard">${ra}</span>`]);

  return `
    <div class="tm-section-label">Stats</div>
    <div class="mdm-poss">
      <span style="color:${hColor};font-weight:700">${ph}%</span>
      <div class="mdm-poss-bar" style="${barStyle}"></div>
      <span style="color:${aColor};font-weight:700">${pa}%</span>
    </div>
    <div class="mdm-poss-label">Possession</div>
    ${rows.length ? `<div class="mdm-stats-grid">${rows.map(([hv,l,av]) =>
      `<span class="mdm-sg-h">${hv}</span><span class="mdm-sg-l">${l}</span><span class="mdm-sg-a">${av}</span>`
    ).join('')}</div>` : ''}
    ${headline ? `<div class="mdm-headline">"${headline}"</div>` : ''}
  `;
}

async function openMatchModal(matchNum) {
  const match = state.matches.find(m => m.matchNum === matchNum);
  if (!match) return;

  const isHome = true;
  const homeWon = match.homeScore !== null && match.awayScore !== null && match.homeScore > match.awayScore;
  const awayWon = match.homeScore !== null && match.awayScore !== null && match.awayScore > match.homeScore;
  const hasScore = match.status === 'FINISHED' || match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const stageName = match.stage === 'Group Stage' && match.group ? `Group ${match.group}` : (match.stage || '');
  const kickoffFmt = match.kickoff
    ? new Date(match.kickoff).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles', timeZoneName: 'short' })
    : '';

  document.getElementById('match-modal-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'match-modal-overlay';
  overlay.innerHTML = `
    <div class="team-modal match-modal">
      <button class="team-modal-close" id="match-modal-close" aria-label="Close">✕</button>
      <div class="mdm-stage">${stageName}</div>
      <div class="mdm-teams">
        <div class="mdm-team ${homeWon ? 'winner' : awayWon ? 'loser' : ''}">
          ${flagImg(match.homeIso, match.homeTeam)}
          <span class="mdm-team-name">${match.homeTeam}</span>
        </div>
        <div class="mdm-score">${hasScore ? `${match.homeScore} – ${match.awayScore}` : 'vs'}</div>
        <div class="mdm-team ${awayWon ? 'winner' : homeWon ? 'loser' : ''}">
          <span class="mdm-team-name">${match.awayTeam}</span>
          ${flagImg(match.awayIso, match.awayTeam)}
        </div>
      </div>
      <div class="mdm-meta">${[kickoffFmt, match.venue].filter(Boolean).join(' · ')}</div>
      <div id="mdm-body"><div class="tm-loading">Loading match data…</div></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => {
    overlay.classList.add('tm-out');
    overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
  };
  document.getElementById('match-modal-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); }, { once: true });
  requestAnimationFrame(() => overlay.classList.add('tm-in'));

  const dateStr = kickoffToDateStr(match.kickoff);
  const body = document.getElementById('mdm-body');

  if (!hasScore || !dateStr) {
    body.innerHTML = `<div class="mdm-meta" style="margin-top:12px;">No match data available yet.</div>`;
    return;
  }

  // Use already-fetched in-memory ESPN data if available (live/today), else fetch historical
  let espnData = null;
  if (match._espnStats) {
    espnData = {
      stats: match._espnStats,
      timeline: [], // live feed doesn't include full timeline with minutes in same format
      headline: match._espnHeadline || null,
      colors: match._espnColors || null,
    };
    // Still fetch historical for full timeline
    const events = await fetchESPNDate(dateStr);
    const found = findESPNEvent(events, match.homeTeam, match.awayTeam);
    if (found) espnData = parseESPNEventData(found.comp, found.homeComp, found.awayComp, found.swapped);
  } else {
    const events = await fetchESPNDate(dateStr);
    const found = findESPNEvent(events, match.homeTeam, match.awayTeam);
    if (found) espnData = parseESPNEventData(found.comp, found.homeComp, found.awayComp, found.swapped);
  }

  if (!body) return; // modal may have been closed while fetching
  if (!espnData) {
    body.innerHTML = `<div class="mdm-meta" style="margin-top:12px;">ESPN data not available for this match.</div>`;
    return;
  }

  const attendance = espnData.attendance ? `<div class="mdm-meta">Attendance: ${espnData.attendance.toLocaleString()}</div>` : '';
  body.innerHTML = attendance + matchTimelineHtml(espnData.timeline, match.homeTeam, match.awayTeam) + matchDetailStatsHtml(espnData, match);
}

// Delegated click handler for team links throughout the app
document.addEventListener('click', e => {
  const link = e.target.closest('.team-link, .flag-link');
  if (!link) return;
  const teamName = link.dataset.team;
  if (teamName) { e.stopPropagation(); openTeamModal(teamName); }
});

// Delegated click handler for match score column
document.addEventListener('click', e => {
  if (e.target.closest('.team-link, .flag-link')) return; // let team handler take it
  const scoreCol = e.target.closest('.score-col');
  if (!scoreCol) return;
  const card = scoreCol.closest('.match-card[data-matchnum]');
  if (!card) return;
  const matchNum = parseInt(card.dataset.matchnum, 10);
  if (matchNum) openMatchModal(matchNum);
});

// Delegated click handler for live commentary scroll controls (prev/next comment)
document.addEventListener('click', e => {
  const btn = e.target.closest('.mc-btn');
  if (!btn || btn.disabled) return;
  e.stopPropagation();
  const matchNum = parseInt(btn.dataset.matchnum, 10);
  const dir = parseInt(btn.dataset.dir, 10);
  const match = state.matches.find(m => m.matchNum === matchNum);
  if (!match?._espnCommentary?.length) return;
  const items = match._espnCommentary;
  let idx = items.findIndex(c => c.sequence === match._commentarySeq);
  if (idx === -1) idx = 0;
  idx = Math.max(0, Math.min(items.length - 1, idx + dir));
  match._commentarySeq = items[idx].sequence;
  document.querySelectorAll(`.match-commentary[data-matchnum="${matchNum}"]`).forEach(node => {
    node.classList.remove('mc-anim');
    void node.offsetWidth; // restart fade animation
    node.innerHTML = commentaryInnerHtml(match);
    node.classList.add('mc-anim');
  });
  if (idx === 0) {
    clearTimeout(commentaryResumeTimers.get(matchNum));
    commentaryResumeTimers.delete(matchNum);
  } else {
    scheduleCommentaryResume(matchNum);
  }
});

// ===== INIT =====
async function init() {
  // Nav tab listeners
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      state.currentView = tab.dataset.view;
      renderView();
    });
  });

  // Keep #app-main margin-top in sync with real header height on resize
  const header = document.getElementById('app-header');
  const main = document.getElementById('app-main');
  if (header && main) {
    const syncMargin = () => { main.style.marginTop = header.offsetHeight + 'px'; };
    syncMargin();
    new ResizeObserver(syncMargin).observe(header);
  }

  initNotifPermissionBtn();

  const footer = document.getElementById('app-footer');
  if (footer) footer.textContent = `WC2026 Dashboard ${APP_VERSION} · Updated ${APP_UPDATED}`;

  // Live mode toggle
  const toggle = document.getElementById('live-mode-toggle');
  if (toggle) {
    toggle.addEventListener('change', () => {
      state.liveMode = toggle.checked;
      renderView();
    });
  }

  // Initial load: data.json (full schedule + standings) and the static
  // combinations.json lookup table (fetched once, never refetched) in parallel.
  await Promise.all([fetchCombinations(), fetchFifaRankings(), fetchData()]);

  // Initial ESPN sync — overlays live scores immediately
  await fetchESPN();

  // Tick every second for live clocks
  if (state.tickInterval) clearInterval(state.tickInterval);
  state.tickInterval = setInterval(tick, 1000);

  // ESPN: poll every 10s for live scores; data.json: re-fetch every 2 minutes
  // for schedule/standings/knockout updates. Also restarted on resume from
  // background — see RESUME / VISIBILITY above.
  restartPollIntervals();

  // ---- Test / debug harness ----
  const testMatch = {
    matchNum: 0, stage: 'Group Stage', group: 'J',
    homeTeam: 'Argentina', homeIso: 'ar', homeScore: 2,
    awayTeam: 'Algeria',   awayIso: 'dz', awayScore: 1,
    venue: 'Arrowhead Stadium, Kansas City',
    status: 'FINISHED',
    _espnEvents: { home: ['L. Messi 37\'', 'J. Alvarez 78\''], away: ['R. Mahrez 55\''] },
    _espnStats: {
      home: { possessionPct: 62, totalShots: 14, shotsOnTarget: 6, wonCorners: 7, yellowCards: 1, redCards: 0 },
      away: { possessionPct: 38, totalShots: 8,  shotsOnTarget: 3, wonCorners: 3, yellowCards: 2, redCards: 0 },
    },
    _espnColors: { home: '#75AADB', away: '#006233' },
    _espnHeadline: 'Messi and Alvarez lead Argentina past Algeria in Group J thriller.',
  };

  window.testNotif = (type) => {
    armAudio();
    if (type === 'kickoff') {
      queueNotif({ type: 'kickoff', html: kickoffNotifHtml({ ...testMatch, homeScore: null, awayScore: null, status: 'SCHEDULED' }) });
    } else if (type === 'goal') {
      queueNotif({ type: 'goal', html: goalNotifHtml({ ...testMatch, homeScore: 1, awayScore: 0, status: 'IN_PLAY' }, 'Argentina', 'L. Messi 37\'') });
    } else if (type === 'final') {
      queueNotif({ type: 'final', html: finalNotifHtml(testMatch) });
    } else {
      console.log('Usage: testNotif("kickoff" | "goal" | "final")');
    }
  };

  // Debug panel — only shown when URL contains ?debug
  if (new URLSearchParams(location.search).has('debug')) {
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.innerHTML = `
      <span style="font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--ink-3);text-transform:uppercase;">Test alerts</span>
      <button onclick="testNotif('kickoff')">⚽ Kickoff</button>
      <button onclick="testNotif('goal')">🥅 Goal</button>
      <button onclick="testNotif('final')">🏁 Full Time</button>
    `;
    document.body.appendChild(panel);
  }
}

init();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/world_cup_dashboard/sw.js').catch(() => {});
}
