import { Idiomorph } from './vendor/idiomorph.esm.js';

// Bump both of these (and src/sw.js's CACHE string) on every change to a static
// frontend file, so the footer reflects what's actually deployed — see CLAUDE.md.
const APP_VERSION = 'v24.6';
const APP_UPDATED = '2026-06-30 03:27 UTC';

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
  espnNews: [],
  rssNews: [],
  liveMode: false,
  currentView: 'dashboard',
  teamFilter: null,
  lastUpdated: null,
  fdLastUpdated: null,
  tickInterval: null,
  syncInterval: null,
  espnInterval: null,
  heroStatInterval: null,
  _heroStatIdx: 0,
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
const ESPN_NEWS_URL = ESPN_SCOREBOARD_URL.replace('/scoreboard', '/news') + '?limit=50';

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
  'STATUS_DELAYED':     'PAUSED',
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
    const res = await fetch(`${ESPN_SCOREBOARD_URL}?dates=${espnTodayDateRange()}&_=${Date.now()}`);
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

    // saves/passPct live only in this summary endpoint's boxscore.teams[], not the
    // scoreboard endpoint's stats array — piggyback on this already-scheduled fetch
    // rather than adding a separate poll. Same live-preview pattern as homeFairPlay;
    // update_tracker.js's syncMatchStats() bakes the permanent value in once FINISHED.
    const boxTeams = data.boxscore?.teams || [];
    const homeId = String(TEAM_MASTER_DATA[current.homeTeam]?.espnId || '');
    const awayId = String(TEAM_MASTER_DATA[current.awayTeam]?.espnId || '');
    const homeBox = boxTeams.find(t => String(t.team?.id || '') === homeId);
    const awayBox = boxTeams.find(t => String(t.team?.id || '') === awayId);
    const boxStat = (teamEntry, name) => {
      const stat = (teamEntry?.statistics || []).find(s => s.name === name);
      if (!stat) return undefined;
      return stat.value !== undefined ? stat.value : parseFloat(stat.displayValue);
    };
    if (homeBox) { current.homeSaves = boxStat(homeBox, 'saves'); current.homePassPct = boxStat(homeBox, 'passPct'); }
    if (awayBox) { current.awaySaves = boxStat(awayBox, 'saves'); current.awayPassPct = boxStat(awayBox, 'passPct'); }
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

function shiftDateStr(dateStr, days) {
  const d = new Date(`${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

// fetchESPN()'s live poll omits `dates=` entirely and relies on ESPN's own default
// "today" boundary, which isn't anchored to Pacific time. A late-night Pacific kickoff
// (e.g. 8:59 PM PDT, 11:59 PM EDT) can fall on ESPN's previous scoreboard day, so once
// ESPN's boundary ticks over the live match silently drops out of the default response
// even though it's still in play. Request an explicit ±1 day window (Pacific-anchored,
// same basis as kickoffToDateStr/getTodayMatches) so today's matches are never excluded
// regardless of which day-boundary convention ESPN's default actually uses.
function espnTodayDateRange() {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }).replace(/-/g, '');
  return `${shiftDateStr(todayStr, -1)}-${shiftDateStr(todayStr, 1)}`;
}

// Late-night Pacific kickoffs (e.g. 8:59 PM PDT) can land on a different calendar
// day than ESPN's own `dates=` scoping for the same event, so a single Pacific-date
// lookup can come up empty. Try the computed date first, then the adjacent days.
async function findESPNEventNearDate(dateStr, homeTeam, awayTeam) {
  for (const candidate of [dateStr, shiftDateStr(dateStr, 1), shiftDateStr(dateStr, -1)]) {
    const events = await fetchESPNDate(candidate);
    const found = findESPNEvent(events, homeTeam, awayTeam);
    if (found) return found;
  }
  return null;
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

    // Permanent-shaped stat fields (cards/fouls/corners) for the hero stat pool —
    // live preview while ESPN tracks the match, same precedence pattern as
    // homeFairPlay. update_tracker.js's syncMatchStats() bakes these in permanently
    // once FINISHED. NOTE: saves/passPct are NOT in this scoreboard endpoint's stats
    // array at all (verified against blueprint_data) — they only exist in the
    // /summary endpoint's boxscore.teams[], so they're set separately by
    // fetchESPNCommentary() below rather than here.
    const finalHStats = match._espnStats.home, finalAStats = match._espnStats.away;
    match.homeYellowCards = finalHStats.yellowCards;
    match.awayYellowCards = finalAStats.yellowCards;
    match.homeRedCards    = finalHStats.redCards;
    match.awayRedCards    = finalAStats.redCards;
    match.homeFouls = finalHStats.foulsCommitted ?? 0;
    match.awayFouls = finalAStats.foulsCommitted ?? 0;
    match.homeCorners = finalHStats.wonCorners ?? 0;
    match.awayCorners = finalAStats.wonCorners ?? 0;
    match.homePossession = finalHStats.possessionPct ?? 0;
    match.awayPossession = finalAStats.possessionPct ?? 0;
    match.homeShots = finalHStats.totalShots ?? 0;
    match.awayShots = finalAStats.totalShots ?? 0;
    match.homeShotsOnTarget = finalHStats.shotsOnTarget ?? 0;
    match.awayShotsOnTarget = finalAStats.shotsOnTarget ?? 0;
    match.homeTackles = finalHStats.totalTackles ?? 0;
    match.awayTackles = finalAStats.totalTackles ?? 0;
    match.homeInterceptions = finalHStats.interceptions ?? 0;
    match.awayInterceptions = finalAStats.interceptions ?? 0;
    match.homeClearances = finalHStats.totalClearance ?? 0;
    match.awayClearances = finalAStats.totalClearance ?? 0;
    match.homeCrosses = finalHStats.totalCrosses ?? 0;
    match.awayCrosses = finalAStats.totalCrosses ?? 0;
    match.homeLongBalls = finalHStats.totalLongBalls ?? 0;
    match.awayLongBalls = finalAStats.totalLongBalls ?? 0;

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

// Venue strings are always "Stadium Name, City" (see data.json) — for
// condensed displays like the bracket, only the city is useful.
function venueCity(venue) {
  if (!venue) return '';
  const idx = venue.lastIndexOf(',');
  return idx === -1 ? venue : venue.slice(idx + 1).trim();
}

function updateSyncPill(espnLabel) {
  const el = document.getElementById('last-sync');
  if (!el) return;
  const pill = el.closest('.sync-pill');
  const isError = pill?.dataset.syncState === 'error';
  el.textContent = isError ? 'Updates Paused' : 'Live Updates';

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

function updateLiveModeFab() {
  const fab = document.getElementById('live-mode-fab');
  if (!fab) return;
  fab.classList.toggle('live', state.liveMode);
  fab.setAttribute('aria-pressed', String(state.liveMode));
  const label = fab.querySelector('.fab-label');
  if (label) label.textContent = state.liveMode ? 'Live' : 'Official';
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

  const period = match._espnPeriod || 1;

  // Extra time (periods 3/4): ESPN's displayClock string keeps formatting against the
  // 90' anchor ("90'+N'") instead of switching to 105'/120' once a match goes to ET, so
  // it can't be trusted here — always derive the minute from the raw elapsed clock instead.
  if (period === 3 || period === 4) {
    if (match._espnClock !== undefined && match._espnFetchedAt) {
      const elapsedSec = match._espnClock + (Date.now() - match._espnFetchedAt) / 1000;
      const min = Math.floor(elapsedSec / 60);
      const base = period === 3 ? 105 : 120;
      const start = period === 3 ? 91 : 106;
      if (min > base) return `${base}+${min - base}'`;
      return `${Math.max(start, min)}'`;
    }
    return null;
  }

  // ESPN clock: prefer displayClock during stoppage (status.clock freezes at 45:00 / 90:00)
  if (match._espnDisplayClock && match._espnDisplayClock.includes('+')) {
    // Format from ESPN: "45'+2'" or "90'+5'" → normalise to "45+2'" / "90+5'"
    return match._espnDisplayClock.replace("'+", '+').replace(/'+$/, "'").replace(/'\s*$/, "'");
  }
  if (match._espnClock !== undefined && match._espnFetchedAt) {
    const elapsedSec = match._espnClock + (Date.now() - match._espnFetchedAt) / 1000;
    const min = Math.floor(elapsedSec / 60);
    if (period === 1) {
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

// Whether toggling the Live/Official standings switch could actually change
// anything for a given group: only true if that group has a Group Stage
// match currently IN_PLAY/PAUSED, since those are the only matches the Live
// toggle adds on top of FINISHED ones. A group with no live match computes
// identically either way.
function groupHasLiveMatch(group) {
  return state.matches.some(m => m.stage === 'Group Stage' &&
    (m.status === 'IN_PLAY' || m.status === 'PAUSED') &&
    (TEAM_MASTER_DATA[m.homeTeam]?.group === group || TEAM_MASTER_DATA[m.awayTeam]?.group === group));
}

// The 3rd-place wildcard ranking draws its 12 candidates from every group at
// once, so a live match in *any* group can reshuffle it -- there's no single
// group to scope the check to.
function anyGroupHasLiveMatch() {
  return state.matches.some(m => m.stage === 'Group Stage' && (m.status === 'IN_PLAY' || m.status === 'PAUSED'));
}

// Whether toggling Live/Official could change what this bracket slot shows
// right now -- i.e. whether it's genuinely speculative, not just "this match
// hasn't been played yet."
//
// Round of 32 slots are fed directly off group standings, so *before* the
// group stage actually finishes they're the only ones a Live/Official toggle
// can disagree on (an already-FINISHED result elsewhere can shuffle group
// position under one mode and not the other, even with nothing live right
// now) -- gated on the same _xxxBracketResolved lock applyBracketResolutions
// computes purely off FINISHED matches. Once the group stage is complete,
// the backend (update_tracker.js's resolveBracketPlaceholders) has already
// baked real, final team names into every Round of 32 match, so there's
// nothing left to disagree on and this returns false unconditionally.
//
// Every later round only resolves via an actual match's W/L ([W##]/[L##]),
// so it's speculative only when that specific feeder is currently
// IN_PLAY/PAUSED with a non-tied score and Live mode is on -- the same
// refDecided condition resolveTeam's [W##]/[L##] branch uses to fill the
// slot speculatively in the first place.
function bracketSlotLiveAffected(match) {
  if (!state.liveMode) return false;

  if (match.stage === 'Round of 32') {
    const groupMatches = state.matches.filter(g => g.stage === 'Group Stage');
    const groupStageComplete = groupMatches.length > 0 && groupMatches.every(g => g.status === 'FINISHED');
    if (groupStageComplete) return false;
    return !(match._homeBracketResolved && match._awayBracketResolved);
  }

  for (const side of ['home', 'away']) {
    const placeholder = match[`${side}Team`];
    if (typeof placeholder !== 'string' || !placeholder.startsWith('[')) continue;
    const wl = placeholder.match(/^\[([WL])(\d+)\]$/);
    if (!wl) continue;
    const ref = state.matches.find(m => m.matchNum === parseInt(wl[2], 10));
    if (ref && (ref.status === 'IN_PLAY' || ref.status === 'PAUSED') && ref.homeScore !== ref.awayScore) return true;
  }
  return false;
}

// Replays a group's matches with one win/draw/loss combination applied to its
// still-undecided matches (1-0 / 0-0 / 0-1 representative scorelines -- exact
// margins aren't modeled, see computeClinchStatus below), then runs the result
// through the same tiebreaker pipeline real standings use.
function simulateGroupOutcome(groupMatches, remaining, choices) {
  const scoreFor = [[1, 0], [0, 0], [0, 1]];
  const scoreByMatchId = new Map(remaining.map((m, i) => [m.matchId, scoreFor[choices[i]]]));
  const synth = groupMatches.map(m => {
    if (m.status === 'FINISHED') return m;
    const [hs, as] = scoreByMatchId.get(m.matchId);
    return { ...m, status: 'FINISHED', homeScore: hs, awayScore: as, homeFairPlay: 0, awayFairPlay: 0 };
  });
  const teams = {};
  for (const m of synth) {
    for (const [team, iso, scored, conceded, fairPlay] of [
      [m.homeTeam, m.homeIso, m.homeScore, m.awayScore, m.homeFairPlay],
      [m.awayTeam, m.awayIso, m.awayScore, m.homeScore, m.awayFairPlay]
    ]) {
      if (!teams[team]) teams[team] = { team, iso, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0, fairPlayPoints: 0 };
      const s = teams[team];
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
  return sortStandingsWithHeadToHead(Object.values(teams), synth);
}

// Brute-forces every win/draw/loss combination of each group's still-undecided
// matches (at most 3^6 = 729, since a group is a closed 4-team/6-match round
// robin) through the real tiebreaker pipeline (sortStandingsWithHeadToHead),
// and records, per team, the full Set of final-position indices (0 = 1st ...
// 3 = 4th) that turn up across every simulated outcome. A team whose set
// collapses to a single value has that exact position mathematically locked
// in -- see computeLockedPositions -- while computeClinchStatus below derives
// its coarser won/advanced/eliminated verdicts from the same sets. Remaining
// matches are simulated with one representative scoreline per outcome (1-0 /
// 0-0 / 0-1) rather than every possible margin, so a result that would only
// be true (or only false) because of an extreme-blowout-dependent GD
// tiebreaker isn't modeled -- an accepted simplification in the same spirit
// as the fair-play yellow/red ambiguity documented elsewhere in this file.
//
// The same simulation loop also records, per group, the highest points total
// that ever lands on the 3rd-place slot (index 2) across every outcome --
// groupThirdCeiling. This is the precise cross-group "threat" figure
// computeClinchStatus needs for the wildcard bound below: a group's eventual
// 3rd-place finisher can never out-point groupThirdCeiling, even though
// individual teams in that group (1st/2nd-place-bound ones) can. Using a raw
// per-team ceiling there instead (the group's best team's max possible points)
// wildly overstates the threat a group poses to other groups' 3rd-place teams,
// since the highest-scoring team is essentially never the one occupying 3rd.
function computeGuaranteedPositions(matches) {
  const groupMatchesByGroup = {};
  for (const m of matches) {
    if (m.stage !== 'Group Stage') continue;
    const g = TEAM_MASTER_DATA[m.homeTeam]?.group;
    if (!g) continue;
    (groupMatchesByGroup[g] ||= []).push(m);
  }

  const guaranteedPositions = {};
  const groupThirdCeiling = {};
  for (const [g, groupMatches] of Object.entries(groupMatchesByGroup)) {
    const remaining = groupMatches.filter(m => m.status !== 'FINISHED');
    const teamsInGroup = [...new Set(groupMatches.flatMap(m => [m.homeTeam, m.awayTeam]))];
    for (const team of teamsInGroup) guaranteedPositions[team] = new Set();

    let thirdCeiling = -Infinity;
    const n = remaining.length;
    const total = Math.pow(3, n);
    for (let s = 0; s < total; s++) {
      const choices = [];
      let rem = s;
      for (let i = 0; i < n; i++) { choices.push(rem % 3); rem = Math.floor(rem / 3); }
      const sorted = simulateGroupOutcome(groupMatches, remaining, choices);
      sorted.forEach((t, idx) => guaranteedPositions[t.team].add(idx));
      if (sorted[2].pts > thirdCeiling) thirdCeiling = sorted[2].pts;
    }
    groupThirdCeiling[g] = thirdCeiling;
  }
  return { guaranteedPositions, groupMatchesByGroup, groupThirdCeiling };
}

// Maps each team to its exact group-finish position (0 = 1st, 1 = 2nd, ...)
// only when every simulated remaining-match outcome agrees -- i.e. mathematically
// locked in, not just "currently sitting there." Teams without a locked position
// are omitted. Used by applyBracketResolutions to fill Round of 32 slots ([1A],
// [2A], ...) ahead of the group stage actually finishing.
//
// Deliberately stops at exact group position, not the cross-group wildcard
// slots ([3ABCDF]-style): pinning a *specific* team into a wildcard bracket
// slot requires every one of the 12 groups' 3rd-place identity to be locked
// simultaneously (so the combinations.json lookup key can't still shift), which
// in practice only happens once the whole group stage is over anyway -- the
// same gate renderBracket() already applies, so there's nothing incremental to
// gain there the way there is for group winner/runner-up slots.
function computeLockedPositions(matches) {
  const { guaranteedPositions } = computeGuaranteedPositions(matches);
  const locked = {};
  for (const [team, positions] of Object.entries(guaranteedPositions)) {
    if (positions.size === 1) locked[team] = [...positions][0];
  }
  return locked;
}

// Patches Round of 32 placeholder slots ([1A], [2B], ...) with the real team
// name/iso the moment that team's group finish is mathematically locked --
// well before the group stage actually completes. This both fills in the
// Bracket view early (resolveAndRender there already treats any non-bracket-
// code string as a resolved team, so no separate render path is needed) and,
// more importantly, gets real team names onto state.matches well ahead of
// kickoff so mergeESPNData()'s ID/name-based matching can find the fixture
// the moment ESPN starts tracking it -- that matching requires homeTeam/
// awayTeam to already hold real names, not placeholder codes. Wildcard
// ([3ABCDF]-style) and [W]/[L] slots are left untouched; see
// computeLockedPositions for why wildcard slots can't resolve any earlier
// than today's groupStageComplete gate.
function applyBracketResolutions(matches) {
  const locked = computeLockedPositions(matches);
  const byGroupPos = {};
  for (const [team, pos] of Object.entries(locked)) {
    if (pos > 1) continue; // only 1st/2nd feed Round of 32 slots directly
    const grp = TEAM_MASTER_DATA[team]?.group;
    if (!grp) continue;
    (byGroupPos[grp] ||= {})[pos] = team;
  }

  for (const m of matches) {
    if (m.stage !== 'Round of 32') continue;
    for (const side of ['home', 'away']) {
      const code = (m[`${side}Team`] || '').match(/^\[([1-4])([A-L])\]$/);
      if (!code) continue;
      const pos = parseInt(code[1], 10) - 1;
      const grp = code[2];
      const team = byGroupPos[grp]?.[pos];
      if (!team) continue;
      m[`${side}Team`] = team;
      m[`${side}Iso`] = TEAM_MASTER_DATA[team]?.iso || null;
      m[`_${side}BracketResolved`] = true;
    }
  }
}

// Estimates, per team, the actual probability (0-1) of finishing in the
// cross-group wildcard top 8 -- the same style of number NYT/The Athletic
// show ("100%", ">99%", "88%") -- by jointly enumerating every remaining
// group-stage match across ALL groups at once (not per-group independently,
// since a wildcard spot is a cross-group competition). Each joint outcome
// re-runs the real tiebreak pipeline (simulateGroupOutcome's
// sortStandingsWithHeadToHead, plus the same pts/gd/gf/fairPlay/FIFA-rank
// cross-group sort computeThirdPlaceRankings uses) to find that outcome's
// actual top-8 group-letter set, then tallies how often each team -- and each
// distinct 8-letter group combination -- lands in it.
//
// Exhaustive enumeration (3^n for n total remaining matches across every
// group) is exact and used whenever n is small enough to stay fast (capped at
// 3^12 ~= 531k). Early in the tournament, when many more matches remain, it
// falls back to Monte Carlo random sampling -- an approximation, but adequate
// for a "highly likely" signal the same way outlets' own simulations are.
// computeWildcardProbabilities is expensive (a full brute-force re-enumeration
// every call) but its inputs -- which group-stage matches are finished/live
// and what each group's standings look like -- only actually change once
// every few minutes (data.json sync) or every 10s while a match is live, not
// on every single render. computeClinchStatus and thirdPlaceWildcardProjectable
// are each called multiple times per render cycle (legend, Schedule, Bracket),
// so without caching the same enumeration reruns 3+ times back-to-back on
// every poll tick even when nothing changed -- this is what was pegging the
// CPU on tab/view switches. wildcardProbabilitiesSignature captures every
// input the simulation actually reads (per-match status/score, per-group
// standings, and the Live/Official toggle) so the cache is invalidated the
// instant any of that changes, and reused otherwise.
let _wildcardProbCache = { sig: null, result: null };
function wildcardProbabilitiesSignature(matches, standings) {
  const matchSig = matches
    .filter(m => m.stage === 'Group Stage')
    .map(m => `${m.matchId}:${m.status}:${m.homeScore}:${m.awayScore}`)
    .join('|');
  const standingsSig = Object.keys(standings).sort().map(g =>
    `${g}=${standings[g].map(t => `${t.team},${t.pts},${t.gd},${t.gf},${t.fairPlayPoints}`).join(';')}`
  ).join('|');
  return `${state.liveMode ? 1 : 0}::${matchSig}::${standingsSig}`;
}
function computeWildcardProbabilitiesCached(matches, standings) {
  const combinations = state.combinations || {};
  // combinations.json is fetched once at startup and never changes afterward,
  // so it's safe to key the cache on just whether it's loaded yet rather than
  // its full contents.
  const sig = wildcardProbabilitiesSignature(matches, standings) + '::' + (Object.keys(combinations).length > 0 ? 1 : 0);
  if (_wildcardProbCache.sig === sig) return _wildcardProbCache.result;
  const result = computeWildcardProbabilities(matches, standings, combinations);
  _wildcardProbCache = { sig, result };
  return result;
}

function computeWildcardProbabilities(matches, standings, combinations) {
  const groupMatchesByGroup = {};
  for (const m of matches) {
    if (m.stage !== 'Group Stage') continue;
    const g = TEAM_MASTER_DATA[m.homeTeam]?.group;
    if (!g) continue;
    (groupMatchesByGroup[g] ||= []).push(m);
  }

  const groups = Object.keys(groupMatchesByGroup);
  const remainingByGroup = {};
  const allRemaining = [];
  for (const g of groups) {
    const remaining = groupMatchesByGroup[g].filter(m => m.status !== 'FINISHED');
    remainingByGroup[g] = remaining;
    for (const m of remaining) allRemaining.push({ g, m });
  }

  const n = allRemaining.length;
  // Each outcome re-runs simulateGroupOutcome (a full sort/tiebreak pass) once
  // per group that still has remaining matches, so the real per-outcome cost
  // is outcomes x active-groups, not just outcomes. 3^8 (6561) x ~6 groups is
  // still sub-100ms; 3^12 (531k) x 6 groups measured at 8+ seconds in
  // practice -- well past anything safe to run synchronously on the main
  // thread during a render. Monte Carlo takes over above this cap.
  const EXHAUSTIVE_CAP = 8;
  const exhaustive = n <= EXHAUSTIVE_CAP;
  const SAMPLES = 3000;
  const totalOutcomes = exhaustive ? Math.pow(3, n) : SAMPLES;

  const teamCounts = {};
  const groupSetCounts = {};
  // Per physical wildcard bracket slot (the 8 keys in SLOT_TO_OPPONENT's
  // values, e.g. "1D"), tallies which actual team ends up facing it. A given
  // slot's matchup can be effectively locked in (e.g. 1D always drawing
  // group B's 3rd-place team) long before the full 8-letter qualifying SET
  // is itself certain, because combinations.json's mapping for that opponent
  // key often barely depends on which OTHER 7 groups round out the top 8 --
  // see computeWildcardSlotResolutions below for how this gets used.
  const slotTeamCounts = {};

  for (let s = 0; s < totalOutcomes; s++) {
    const choiceSource = exhaustive ? [] : null;
    if (exhaustive) {
      let rem = s;
      for (let i = 0; i < n; i++) { choiceSource.push(rem % 3); rem = Math.floor(rem / 3); }
    }

    const choicesByGroup = {};
    allRemaining.forEach((entry, i) => {
      const choice = exhaustive ? choiceSource[i] : Math.floor(Math.random() * 3);
      (choicesByGroup[entry.g] ||= []).push(choice);
    });

    const thirds = [];
    for (const g of groups) {
      const remaining = remainingByGroup[g];
      if (remaining.length === 0) {
        const real = standings[g];
        if (real && real.length >= 3) thirds.push({ ...real[2], groupLetter: g });
        continue;
      }
      const sorted = simulateGroupOutcome(groupMatchesByGroup[g], remaining, choicesByGroup[g]);
      if (sorted.length >= 3) thirds.push({ ...sorted[2], groupLetter: g });
    }

    thirds.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf ||
      (b.fairPlayPoints || 0) - (a.fairPlayPoints || 0) ||
      (fifaRankOf(a.team) - fifaRankOf(b.team)) || a.team.localeCompare(b.team));

    const top8 = thirds.slice(0, 8);
    for (const t of top8) teamCounts[t.team] = (teamCounts[t.team] || 0) + 1;
    const setKey = top8.map(t => t.groupLetter).sort().join('');
    groupSetCounts[setKey] = (groupSetCounts[setKey] || 0) + 1;

    const combEntry = combinations && combinations[setKey];
    if (combEntry) {
      const byGroupLetter = {};
      for (const t of top8) byGroupLetter[t.groupLetter] = t;
      for (const opponentKey of Object.values(SLOT_TO_OPPONENT)) {
        const teamCode = combEntry[opponentKey]; // e.g. "3E"
        const t = teamCode && byGroupLetter[teamCode.replace('3', '')];
        if (!t) continue;
        const counts = (slotTeamCounts[opponentKey] ||= {});
        const key = t.team;
        counts[key] = (counts[key] || 0) + 1;
      }
    }
  }

  const teamProbability = {};
  for (const [team, count] of Object.entries(teamCounts)) teamProbability[team] = count / totalOutcomes;

  let bestSet = null, bestSetCount = 0;
  for (const [setKey, count] of Object.entries(groupSetCounts)) {
    if (count > bestSetCount) { bestSetCount = count; bestSet = setKey; }
  }
  const bestSetProbability = bestSet ? bestSetCount / totalOutcomes : 0;

  const slotResolutions = {};
  for (const [opponentKey, counts] of Object.entries(slotTeamCounts)) {
    let bestTeam = null, bestCount = 0;
    for (const [team, count] of Object.entries(counts)) {
      if (count > bestCount) { bestCount = count; bestTeam = team; }
    }
    if (bestTeam) {
      slotResolutions[opponentKey] = { team: bestTeam, iso: TEAM_MASTER_DATA[bestTeam]?.iso || null, pct: bestCount / totalOutcomes };
    }
  }

  return { teamProbability, bestSet, bestSetProbability, slotResolutions };
}

// Determines, per team, whether a group-stage outcome is already mathematically
// guaranteed -- regardless of how the group's remaining matches play out --
// and surfaces it as a single badge: clinched (group win / knockout berth /
// wildcard berth) or eliminated.
//
// Group position verdicts (win group / auto-qualify top 2 / can't reach top 2)
// reuse the exact per-team position sets from computeGuaranteedPositions --
// those stay strict/boolean since they only ever involve one group.
//
// Wildcard (3rd-place, top 8 of 12) instead uses the actual cross-group
// probability from computeWildcardProbabilities: a team currently sitting in
// its group's 3rd-place slot is "wildcardClinched" once that probability hits
// 1 (mathematically certain under every simulated outcome -- exact, not
// rounded, when the joint enumeration is exhaustive) and "wildcardProjected"
// once it's at or above WILDCARD_PROJECTED_THRESHOLD but short of certainty --
// mirroring how outlets report ">99%"/"100%" rather than waiting for the
// literal worst case to be eliminated.
const WILDCARD_PROJECTED_THRESHOLD = 0.99;

function computeClinchStatus(matches, standings) {
  const { guaranteedPositions, groupMatchesByGroup, groupThirdCeiling } = computeGuaranteedPositions(matches);

  const ceilingPts = {};
  for (const groupMatches of Object.values(groupMatchesByGroup)) {
    const finished = groupMatches.filter(m => m.status === 'FINISHED');
    const remaining = groupMatches.filter(m => m.status !== 'FINISHED');
    const teamsInGroup = [...new Set(groupMatches.flatMap(m => [m.homeTeam, m.awayTeam]))];

    for (const team of teamsInGroup) {
      const playedPts = finished.reduce((sum, m) => {
        if (m.homeTeam === team) return sum + (m.homeScore > m.awayScore ? 3 : m.homeScore === m.awayScore ? 1 : 0);
        if (m.awayTeam === team) return sum + (m.awayScore > m.homeScore ? 3 : m.awayScore === m.homeScore ? 1 : 0);
        return sum;
      }, 0);
      const remainingForTeam = remaining.filter(m => m.homeTeam === team || m.awayTeam === team).length;
      ceilingPts[team] = playedPts + 3 * remainingForTeam;
    }
  }

  const groupVerdict = {};
  for (const [team, positions] of Object.entries(guaranteedPositions)) {
    const all = [...positions];
    if (all.every(p => p === 0)) groupVerdict[team] = 'won';
    else if (all.every(p => p <= 1)) groupVerdict[team] = 'advanced';
    else if (all.every(p => p <= 2)) groupVerdict[team] = 'top3Locked';
    else if (all.every(p => p >= 2)) groupVerdict[team] = 'outOfTop2';
  }

  const { teamProbability } = computeWildcardProbabilitiesCached(matches, standings);

  const result = {};
  for (const [g, groupMatches] of Object.entries(groupMatchesByGroup)) {
    const teamsInGroup = [...new Set(groupMatches.flatMap(m => [m.homeTeam, m.awayTeam]))];
    const others = Object.keys(groupThirdCeiling).filter(og => og !== g);
    const currentThird = (standings[g] || [])[2]?.team;

    for (const team of teamsInGroup) {
      const verdict = groupVerdict[team];
      if (verdict === 'won') {
        result[team] = { icon: 'position', kind: 'won', label: `Clinched Group ${g} win` };
      } else if (verdict === 'advanced') {
        result[team] = { icon: 'knockout', kind: 'advanced', label: 'Clinched knockout berth (top 2)' };
      } else if (verdict === 'top3Locked' && team === currentThird) {
        const pct = teamProbability[team] ?? 0;
        if (pct >= 1) {
          result[team] = { icon: 'knockout', kind: 'wildcardClinched', pct, label: 'Clinched wildcard berth (3rd-place ranking)' };
        } else if (pct >= WILDCARD_PROJECTED_THRESHOLD) {
          const pctLabel = pct >= 0.999 ? '>99%' : `~${Math.round(pct * 100)}%`;
          result[team] = { icon: 'projected', kind: 'wildcardProjected', pct, label: `Projected wildcard berth (${pctLabel} likely, pending tiebreakers)` };
        }
      } else if (verdict === 'outOfTop2') {
        const threatsBeatCeiling = others.filter(og => groupThirdCeiling[og] > ceilingPts[team]).length;
        if (threatsBeatCeiling >= 8) {
          result[team] = { icon: 'eliminated', kind: 'eliminated', label: 'Eliminated -- cannot reach the knockout stage' };
        }
      }
    }
  }
  return result;
}

// True once the cross-group wildcard top-8 group-letter SET (not just each
// team individually) is settled with high confidence -- i.e. the specific
// combinations.json lookup key (e.g. "ABCDEFKL") that Schedule/Bracket need to
// resolve wildcard ([3XXXXX]-style) slots is overwhelmingly likely to be the
// final one. Reuses the same joint simulation as the per-team probabilities
// above, so a team can independently show "projected" while bracket-filling
// still waits on the full 8-letter set to clear the same threshold -- both
// numbers come from one underlying probability model instead of two separate
// gates. If the set is later wrong because of a genuine upset, the next
// standings recompute simply overwrites the slot like any other live-mode
// correction -- so filling in early here is no riskier than what Live mode
// already does for every slot, all the time.
function thirdPlaceWildcardProjectable(matches, standings) {
  const thirdPlace = computeThirdPlaceRankings(standings);
  if (thirdPlace.length < 8) return false;
  const { bestSetProbability } = computeWildcardProbabilitiesCached(matches, standings);
  return bestSetProbability >= WILDCARD_PROJECTED_THRESHOLD;
}

function getThirdPlaceCombinationString(topEight) {
  // topEight is array of group letters (up to 8)
  const letters = topEight.map(t => t.groupLetter || t).sort();
  return letters.join('');
}

// Resolves only a [3XXXXX]-style wildcard slot, via the per-slot probability
// from computeWildcardProbabilities -- used when the broader resolveGroupSlots
// gate is still false (the overall top-8 SET isn't certain enough yet) but
// THIS slot's specific matchup already is, because combinations.json's mapping
// for its opponent key barely depends on which other groups round out the
// top 8. Returns null (leaving the raw placeholder in place) for every other
// placeholder shape, since those genuinely do need the broader gate.
function resolveWildcardSlotOnly(placeholder, slotResolutions) {
  const m = placeholder.match(/^\[3([A-L]+)\]$/);
  if (!m) return null;
  const opponentKey = SLOT_TO_OPPONENT['3' + m[1]];
  const r = opponentKey && slotResolutions && slotResolutions[opponentKey];
  if (r && r.pct >= WILDCARD_PROJECTED_THRESHOLD) return { name: r.team, iso: r.iso };
  return null;
}

function resolveTeam(placeholder, computedStandings, computedThirdPlace, combinationString, slotResolutions) {
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
    // Fall back to the per-slot resolution: this specific bracket slot's
    // matchup can be locked in via combinations.json long before the full
    // 8-letter qualifying SET is itself certain (see slotResolutions in
    // computeWildcardProbabilities).
    const fallbackOpponentKey = SLOT_TO_OPPONENT[code];
    const fallback = fallbackOpponentKey && slotResolutions && slotResolutions[fallbackOpponentKey];
    if (fallback && fallback.pct >= WILDCARD_PROJECTED_THRESHOLD) {
      return { name: fallback.team, iso: fallback.iso };
    }
    return { name: `3rd (${thirdMatch[1]})`, iso: null };
  }

  // [W73], [L101] — winners/losers of match by matchNum
  const wlMatch = code.match(/^([WL])(\d+)$/);
  if (wlMatch) {
    const isWinner = wlMatch[1] === 'W';
    const refNum = parseInt(wlMatch[2], 10);
    const refMatch = state.matches.find(mm => mm.matchNum === refNum);
    // In Live mode, an in-play/paused match with a current leader resolves the
    // slot speculatively too -- a tied score changes nothing (falls through to
    // the raw placeholder below, same as before a match kicks off).
    const refDecided = refMatch && (refMatch.status === 'FINISHED' ||
      (state.liveMode && (refMatch.status === 'IN_PLAY' || refMatch.status === 'PAUSED') && refMatch.homeScore !== refMatch.awayScore));
    if (refDecided) {
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
    const period = match._espnPeriod || 1;
    const label = (period === 3 || period === 4) ? 'ET' : 'LIVE';
    return `<span class="badge badge-live">${label}</span>`;
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
  // Timestamp-based fallback: even if the setTimeout in scheduleCommentaryResume()
  // never fires (e.g. dropped during a backgrounded-tab timer throttle), every
  // regular re-render self-heals back to the latest comment once the inactivity
  // window has elapsed, since this check runs on every render, not just the timer.
  if (match._commentaryLastNav && Date.now() - match._commentaryLastNav >= COMMENTARY_RESUME_MS) {
    match._commentarySeq = null;
    match._commentaryLastNav = null;
  }
  let idx = items.findIndex(c => c.sequence === match._commentarySeq);
  if (idx === -1) idx = 0;
  // Only pin _commentarySeq to a concrete value when scrolled away from the latest.
  // Leaving it null/unset at idx 0 means we keep dynamically tracking whatever is
  // newest as further comments arrive, instead of freezing on today's "latest".
  match._commentarySeq = idx === 0 ? null : items[idx].sequence;
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
    match._commentarySeq = null;
    document.querySelectorAll(`.match-commentary[data-matchnum="${matchNum}"]`).forEach(node => {
      node.classList.remove('mc-anim');
      void node.offsetWidth;
      node.innerHTML = commentaryInnerHtml(match);
      node.classList.add('mc-anim');
    });
  }, COMMENTARY_RESUME_MS);
  commentaryResumeTimers.set(matchNum, timer);
}

// Steps a match's displayed commentary item by `dir` (1 = older, -1 = newer).
// Shared by the ‹/› button click handler and the commentary swipe gesture.
function navigateCommentary(matchNum, dir) {
  const match = state.matches.find(m => m.matchNum === matchNum);
  if (!match?._espnCommentary?.length) return;
  const items = match._espnCommentary;
  let idx = items.findIndex(c => c.sequence === match._commentarySeq);
  if (idx === -1) idx = 0;
  idx = Math.max(0, Math.min(items.length - 1, idx + dir));
  // Leave _commentarySeq null at idx 0 so we keep dynamically tracking the newest
  // comment as more arrive, rather than freezing on a snapshot of "latest right now".
  match._commentarySeq = idx === 0 ? null : items[idx].sequence;
  document.querySelectorAll(`.match-commentary[data-matchnum="${matchNum}"]`).forEach(node => {
    node.classList.remove('mc-anim');
    void node.offsetWidth; // restart fade animation
    node.innerHTML = commentaryInnerHtml(match);
    node.classList.add('mc-anim');
  });
  if (idx === 0) {
    clearTimeout(commentaryResumeTimers.get(matchNum));
    commentaryResumeTimers.delete(matchNum);
    match._commentaryLastNav = null;
  } else {
    match._commentaryLastNav = Date.now();
    scheduleCommentaryResume(matchNum);
  }
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
  if (isLive && !opts.suppressStats && match._espnCommentary?.length) {
    commentaryHtml = `<div class="match-commentary mc-anim" data-matchnum="${match.matchNum}">${commentaryInnerHtml(match)}</div>`;
  }

  // Stats are shown inline for live matches everywhere except the Schedule view
  // (which always suppresses them) — in that case the card itself opens the
  // match modal; otherwise the inline stats are the "details" already.
  const showsLiveStats = isLive && !opts.suppressStats;
  const clickable = !showsLiveStats;

  // News is opt-in per call site (Dashboard's Live & Today / Up Next cards) and
  // never shown on a currently-live match — that's what the commentary/stats
  // blocks above are for. Cache the fetched list on the match object so the
  // nav-button/swipe handlers (which fire well after this render) scroll
  // through the same set rather than recomputing (and reshuffling) it.
  let newsHtml = '';
  if (opts.showNews && !isLive) {
    const articles = getMatchNews(match, 5);
    match._newsArticles = articles;
    if (articles.length) {
      newsHtml = `<div class="match-news mc-anim" data-matchnum="${match.matchNum}">${newsScrollInnerHtml(match, articles)}</div>`;
      ensureNewsAdvance(match.matchNum);
    }
  }

  return `
    <div class="match-card ${isLive ? 'live' : opts.liveAffected ? 'live-affected' : ''} ${clickable ? 'clickable' : ''}" data-matchnum="${match.matchNum}" ${opts.liveAffected ? 'title="Speculative: based on live scores, not yet official"' : ''}>
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
      ${newsHtml}
    </div>
  `;
}

// Pool of rotating hero stats, including "Played" — all three hero slots rotate
// together through this pool (see the heroStatInterval setup in init()). Each entry
// is only included once its underlying data is actually known — cards/fouls/saves/
// corners/pass-accuracy lag behind goals since they depend on ESPN's stats array
// or update_tracker.js's backend sync, same lag the fair-play preview already has.
function computeHeroStats() {
  let played = 0, goals = 0, highestScoring = 0, cleanSheets = 0;
  let fouls = 0, foulsKnown = 0, saves = 0, savesKnown = 0, cards = 0, cardsKnown = 0;
  let corners = 0, cornersKnown = 0, passPctSum = 0, passPctKnown = 0;
  let shotsOnTarget = 0, shotsOnTargetKnown = 0, tackles = 0, tacklesKnown = 0;
  let interceptions = 0, interceptionsKnown = 0;
  for (const m of state.matches) {
    if (m.homeScore == null || m.awayScore == null) continue;
    const total = m.homeScore + m.awayScore;
    played++;
    goals += total;
    if (total > highestScoring) highestScoring = total;
    if (m.homeScore === 0) cleanSheets++;
    if (m.awayScore === 0) cleanSheets++;
    if (typeof m.homeFouls === 'number' && typeof m.awayFouls === 'number') {
      fouls += m.homeFouls + m.awayFouls;
      foulsKnown++;
    }
    if (typeof m.homeSaves === 'number' && typeof m.awaySaves === 'number') {
      saves += m.homeSaves + m.awaySaves;
      savesKnown++;
    }
    if (typeof m.homeYellowCards === 'number' && typeof m.awayYellowCards === 'number') {
      cards += m.homeYellowCards + m.awayYellowCards + (m.homeRedCards || 0) + (m.awayRedCards || 0);
      cardsKnown++;
    }
    if (typeof m.homeCorners === 'number' && typeof m.awayCorners === 'number') {
      corners += m.homeCorners + m.awayCorners;
      cornersKnown++;
    }
    if (typeof m.homePassPct === 'number' && typeof m.awayPassPct === 'number') {
      passPctSum += m.homePassPct + m.awayPassPct;
      passPctKnown += 2;
    }
    if (typeof m.homeShotsOnTarget === 'number' && typeof m.awayShotsOnTarget === 'number') {
      shotsOnTarget += m.homeShotsOnTarget + m.awayShotsOnTarget;
      shotsOnTargetKnown++;
    }
    if (typeof m.homeTackles === 'number' && typeof m.awayTackles === 'number') {
      tackles += m.homeTackles + m.awayTackles;
      tacklesKnown++;
    }
    if (typeof m.homeInterceptions === 'number' && typeof m.awayInterceptions === 'number') {
      interceptions += m.homeInterceptions + m.awayInterceptions;
      interceptionsKnown++;
    }
  }
  const pool = [
    { num: played, label: 'Played' },
    { num: goals, label: 'Goals scored' },
    { num: played ? (goals / played).toFixed(1) : '0.0', label: 'Goals / match' },
    { num: cleanSheets, label: 'Clean sheets' },
  ];
  if (highestScoring > 0) pool.push({ num: highestScoring, label: 'Highest-scoring match' });
  if (cardsKnown) pool.push({ num: cards, label: 'Cards shown' });
  if (foulsKnown) pool.push({ num: fouls, label: 'Fouls committed' });
  if (savesKnown) pool.push({ num: saves, label: 'Saves' });
  if (cornersKnown) pool.push({ num: corners, label: 'Corners won' });
  if (passPctKnown) pool.push({ num: (passPctSum / passPctKnown * 100).toFixed(1) + '%', label: 'Pass accuracy' });
  if (shotsOnTargetKnown) pool.push({ num: shotsOnTarget, label: 'Shots on target' });
  if (tacklesKnown) pool.push({ num: tackles, label: 'Tackles won' });
  if (interceptionsKnown) pool.push({ num: interceptions, label: 'Interceptions' });
  return pool;
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
        <input id="team-search" class="search-input" placeholder="Search team..." value="${state.teamFilter || ''}">
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
    const heroStatPool = computeHeroStats();
    const rotatingStats = [0, 1, 2].map(off => heroStatPool[(state._heroStatIdx + off) % heroStatPool.length]);
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
        <span><span class="swatch" style="background:var(--grad-green)"></span> Advance</span>
        <span><span class="swatch" style="background:var(--grad-live)"></span> 3rd wildcard</span>
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
          ${rotatingStats.map(s => `
          <div class="hero-stat">
            <div class="hero-stat-num">${s.num}</div>
            <div class="hero-stat-label">${s.label}</div>
          </div>`).join('')}
        </div>
      </div>

      <div class="card" style="grid-column:1/-1; margin-bottom:16px;">
        <div class="card-header">
          <div class="card-title">${liveCount > 0 ? '🔴 Live &amp; Today' : 'Today\'s Matches'}</div>
          <div class="card-meta">${liveAndTodayMeta}</div>
        </div>
        ${liveAndToday.length ? liveAndToday.map(m => matchCardHtml(m, null, { showNews: true })).join('') : '<div class="empty-state">No matches today.</div>'}
      </div>

      <div class="dashboard-grid">
        <div class="card">${standingsHtml}</div>
        <div class="card">
          <div class="card-header">
            <div class="card-title">Up Next</div>
            <div class="card-meta">Upcoming</div>
          </div>
          ${upNext.length ? upNext.map(m => matchCardHtml(m, null, { suppressStats: true, showNews: true })).join('') : '<div class="empty-state">No upcoming matches.</div>'}
        </div>
      </div>
    `;
    morphInto(el, html);
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

// Resolves any knockout placeholder team names (e.g. "[1A]", "[W73]",
// "[3BEFIJ]") on a match to actual team names, using the same Live/Official
// and per-slot-probability logic as renderSchedule()/renderBracket(). Shared
// so the match detail modal (openMatchModal) shows the same resolved
// matchups the Schedule/Bracket cards already do, instead of raw placeholder
// strings.
function resolveMatchTeams(m) {
  if (!m.homeTeam?.startsWith('[') && !m.awayTeam?.startsWith('[')) return m;

  const groupMatches = state.matches.filter(g => g.stage === 'Group Stage');
  const groupStageComplete = groupMatches.length > 0 && groupMatches.every(g => g.status === 'FINISHED');
  const resolveGroupSlots = groupStageComplete || state.liveMode || thirdPlaceWildcardProjectable(state.matches, state.standings);
  const statuses = state.liveMode ? ['FINISHED', 'IN_PLAY', 'PAUSED'] : ['FINISHED'];
  const computedStandings = resolveGroupSlots
    ? (state.liveMode ? computeStandings(state.matches, statuses) : state.standings)
    : {};
  const thirdPlace = resolveGroupSlots ? computeThirdPlaceRankings(computedStandings) : [];
  const combinationString = resolveGroupSlots ? getThirdPlaceCombinationString(thirdPlace.slice(0, 8)) : '';
  const { slotResolutions } = computeWildcardProbabilitiesCached(state.matches, state.standings);

  function resolveSide(placeholder) {
    if (!placeholder?.startsWith('[')) return null;
    if (resolveGroupSlots) return resolveTeam(placeholder, computedStandings, thirdPlace, combinationString, slotResolutions);
    return resolveWildcardSlotOnly(placeholder, slotResolutions);
  }
  const home = resolveSide(m.homeTeam);
  const away = resolveSide(m.awayTeam);
  if (!home && !away) return m;
  return {
    ...m,
    homeTeam: home ? home.name : m.homeTeam,
    homeIso: home ? home.iso : m.homeIso,
    awayTeam: away ? away.name : m.awayTeam,
    awayIso: away ? away.iso : m.awayIso,
  };
}

// ===== RENDER SCHEDULE =====
function renderSchedule(opts = {}) {
  const el = document.getElementById('view-schedule');
  const matches = state.matches;

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

  function resolvedMatch(m) {
    return resolveMatchTeams(m);
  }

  // Group by local Pacific date
  const byDate = {};
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  for (const m of matches) {
    const dateKey = m.kickoff ? dtf.format(new Date(m.kickoff)) : 'TBD';
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(m);
  }

  const modeLabel = state.liveMode
    ? `<span class="standings-mode-label live-mode">Live (includes in-play)</span>`
    : `<span class="standings-mode-label official">Official (finished only)</span>`;
  let html = `<div class="schedule-header">
    <span class="schedule-title">Schedule</span>
    ${modeLabel}
  </div>`;

  let todayId = null;
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
      const liveAffected = state.liveMode && bracketSlotLiveAffected(m);
      html += matchCardHtml(resolvedMatch(m), label, { suppressStats: true, liveAffected });
    }
  }

  morphInto(el, html || '<div class="empty-state">No matches to display.</div>');

  // Land at today's section instantly (no animation) on a fresh navigation to this
  // tab, so it reads as "this is where the page starts" rather than a visible jump.
  // Silent background refreshes never touch scroll position.
  if (todayId && !opts.silent) {
    requestAnimationFrame(() => {
      const todayEl = document.getElementById(todayId);
      if (todayEl) {
        const headerH = document.getElementById('app-header')?.offsetHeight || 64;
        const top = todayEl.getBoundingClientRect().top + window.scrollY - headerH - 12;
        window.scrollTo({ top, behavior: 'instant' });
      }
    });
  }
}

// Small inline dot used in standings rows to flag a clinched or eliminated
// outcome -- always derived from the official (finished-only) record via
// computeClinchStatus, independent of the Live/Official toggle, since
// "clinched" should never hinge on an in-progress score.
function clinchDotHtml(team, clinchStatus) {
  const entry = clinchStatus[team];
  if (!entry) return '';
  return `<span class="clinch-dot ${entry.icon}" title="${entry.label}">${entry.icon === 'eliminated' ? '✕' : '✓'}</span>`;
}

// ===== RENDER STANDINGS =====
function renderStandings() {
  const el = document.getElementById('view-standings');
  const statuses = state.liveMode ? ['FINISHED', 'IN_PLAY', 'PAUSED'] : ['FINISHED'];
  const computedStandings = state.liveMode ? computeStandings(state.matches, statuses) : state.standings;
  const clinchStatus = computeClinchStatus(state.matches, state.standings);

  const modeLabel = state.liveMode
    ? `<span class="standings-mode-label live-mode">Live (includes in-play)</span>`
    : `<span class="standings-mode-label official">Official (finished only)</span>`;

  let html = `<div class="standings-header">
    <span class="standings-title">Group Standings</span>
    ${modeLabel}
  </div>`;

  const liveTeams = new Set();
  for (const m of state.matches) {
    if (m.status === 'IN_PLAY' || m.status === 'PAUSED') {
      if (m.homeTeam) liveTeams.add(m.homeTeam);
      if (m.awayTeam) liveTeams.add(m.awayTeam);
    }
  }

  html += `<div class="standings-grid">`;

  for (const grp of 'ABCDEFGHIJKL'.split('')) {
    const teams = computedStandings[grp] || [];
    const liveAffected = state.liveMode && groupHasLiveMatch(grp);
    html += `
      <div class="card ${liveAffected ? 'live-affected' : ''}" style="padding:0;overflow:hidden;" ${liveAffected ? 'title="Speculative: based on live scores, not yet official"' : ''}>
        <div class="group-header" style="padding:10px 14px;margin-bottom:0;">
          <div class="group-pill">${grp}</div>
          <div class="group-name">Group ${grp}</div>
        </div>
        <div class="table-wrap">
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
      const liveDot = liveTeams.has(t.team) ? '<span class="live-dot" title="Currently playing"></span>' : '';
      html += `
        <tr class="${rowClass}">
          <td><span class="pos">${i + 1}</span></td>
          <td>
            <div class="team-cell">
              <span class="flag-link team-flag-wrap" data-team="${t.team}">${flagImg(t.iso, t.team)}${clinchDotHtml(t.team, clinchStatus)}</span>
              <span class="team-link" data-team="${t.team}">${t.team}</span>
              ${liveDot}
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
    html += `</tbody></table></div></div>`;
  }

  html += `</div>
  <div class="qualify-legend">
    <span><span class="swatch" style="background:var(--grad-green);"></span> Auto qualify (1st/2nd)</span>
    <span><span class="swatch" style="background:var(--grad-live);"></span> Third place (best 8 advance)</span>
    <span><span class="clinch-legend-swatch position">✓</span> Group win clinched</span>
    <span><span class="clinch-legend-swatch knockout">✓</span> Knockout clinched</span>
    <span><span class="clinch-legend-swatch projected">✓</span> Projected (highly likely)</span>
    <span><span class="clinch-legend-swatch eliminated">✕</span> Eliminated</span>
  </div>`;

  // Third-place wildcard section
  const thirdPlace = computeThirdPlaceRankings(computedStandings);
  if (thirdPlace.length) {
    const wildcardLiveAffected = state.liveMode && anyGroupHasLiveMatch();
    html += `
      <div class="card ${wildcardLiveAffected ? 'live-affected' : ''}" style="margin-top:24px;" ${wildcardLiveAffected ? 'title="Speculative: based on live scores, not yet official"' : ''}>
        <div class="card-title">Third-Place Wildcard Rankings</div>
        <p class="note-text" style="margin-bottom:10px;">Best 8 of 12 third-place teams advance to Round of 32</p>
        <table class="wildcard-table">
          <thead>
            <tr>
              <th style="width:28px;">#</th>
              <th>Team</th>
              <th class="num">Group</th>
              <th class="num wc-wdl">P</th>
              <th class="num wc-wdl">W</th>
              <th class="num wc-wdl">D</th>
              <th class="num wc-wdl">L</th>
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
              <span class="team-flag-wrap">${flagImg(t.iso, t.team)}${clinchDotHtml(t.team, clinchStatus)}</span>
              <span>${t.team}</span>
            </div>
          </td>
          <td class="num"><span class="group-label">${t.groupLetter}</span></td>
          <td class="num wc-wdl">${t.played}</td>
          <td class="num wc-wdl">${t.won}</td>
          <td class="num wc-wdl">${t.drawn}</td>
          <td class="num wc-wdl">${t.lost}</td>
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
  const resolveGroupSlots = groupStageComplete || state.liveMode || thirdPlaceWildcardProjectable(state.matches, state.standings);
  const computedStandings = resolveGroupSlots
    ? (state.liveMode ? computeStandings(state.matches, statuses) : state.standings)
    : {};
  const thirdPlace = resolveGroupSlots ? computeThirdPlaceRankings(computedStandings) : [];
  const topEight = thirdPlace.slice(0, 8);
  const combinationString = resolveGroupSlots ? getThirdPlaceCombinationString(topEight) : '';
  const { slotResolutions } = computeWildcardProbabilitiesCached(state.matches, state.standings);

  // bracketResolved: true when applyBracketResolutions() (clinch-math driven,
  // ahead of groupStageComplete) put this name here, as opposed to it being a
  // raw unresolved placeholder or a name resolved through the normal
  // resolveTeam() path below. Surfaced as a "confirmed" badge distinct from
  // live-mode's speculative fill -- see applyBracketResolutions for why.
  function resolveAndRender(placeholder, bracketResolved) {
    if (!placeholder) return { name: 'TBD', iso: null, confirmed: false };
    if (!placeholder.startsWith('[')) {
      return {
        name: placeholder,
        iso: TEAM_MASTER_DATA[placeholder]?.iso || null,
        confirmed: !!bracketResolved && !groupStageComplete,
      };
    }
    if (!resolveGroupSlots) {
      const slotOnly = resolveWildcardSlotOnly(placeholder, slotResolutions);
      if (slotOnly) return { ...slotOnly, confirmed: false };
      return { name: placeholder.replace(/^\[|\]$/g, ''), iso: null, confirmed: false };
    }
    return { ...resolveTeam(placeholder, computedStandings, thirdPlace, combinationString, slotResolutions), confirmed: false };
  }

  function bMatchHtml(match) {
    const home = resolveAndRender(match.homeTeam, match._homeBracketResolved);
    const away = resolveAndRender(match.awayTeam, match._awayBracketResolved);
    const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
    const hasScore = match.status === 'FINISHED' || isLive;
    const homeWon = hasScore && match.homeScore > match.awayScore;
    const awayWon = hasScore && match.awayScore > match.homeScore;
    // FINISHED winners are always decided; an IN_PLAY/PAUSED leader only counts
    // as decided in Live mode, matching the same Official/Live split already
    // used for [W##]/[L##] slot resolution.
    match._decided = (homeWon || awayWon) && (match.status === 'FINISHED' || state.liveMode);
    const confirmedDot = `<span class="clinch-dot position" title="Clinched — mathematically locked in, official fixture pending">✓</span>`;
    const kickoffFmt = match.kickoff ? new Date(match.kickoff).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' }) : '';
    const metaText = [kickoffFmt, venueCity(match.venue)].filter(Boolean).join(' · ');
    const metaTitle = [kickoffFmt, match.venue].filter(Boolean).join(' · ');

    const liveAffected = !isLive && bracketSlotLiveAffected(match);

    return `
      <div class="b-match ${isLive ? 'live' : liveAffected ? 'live-affected' : ''}" data-matchnum="${match.matchNum}" title="${metaTitle}${liveAffected ? ' · Speculative: based on live scores, not yet official' : ''}">
        ${metaText ? `<div class="b-meta">${metaText}</div>` : ''}
        <div class="b-team ${homeWon ? 'winner' : ''}" data-team="${home.name}" style="cursor:${TEAM_MASTER_DATA[home.name] ? 'pointer' : 'default'}">
          <span class="flag-link team-flag-wrap" data-team="${home.name}">${flagImg(home.iso, home.name)}${home.confirmed ? confirmedDot : ''}</span>
          <span class="b-team-name team-link" data-team="${home.name}">${home.name}</span>
          ${hasScore ? `<span class="b-score">${match.homeScore}</span>` : ''}
        </div>
        <hr class="b-div">
        <div class="b-team ${awayWon ? 'winner' : ''}" data-team="${away.name}" style="cursor:${TEAM_MASTER_DATA[away.name] ? 'pointer' : 'default'}">
          <span class="flag-link team-flag-wrap" data-team="${away.name}">${flagImg(away.iso, away.name)}${away.confirmed ? confirmedDot : ''}</span>
          <span class="b-team-name team-link" data-team="${away.name}">${away.name}</span>
          ${hasScore ? `<span class="b-score">${match.awayScore}</span>` : ''}
        </div>
      </div>
    `;
  }

  function bSlot(match, incomingAdvanced) {
    const html = bMatchHtml(match);
    const classes = [match._decided ? 'advanced' : '', incomingAdvanced ? 'incoming-advanced' : ''].filter(Boolean).join(' ');
    return `<div class="b-slot ${classes}">${html}</div>`;
  }

  // A round's incoming connector stub is a single pseudo-element shared by the
  // two matches feeding it (slot heights double per round to center on that
  // pair) -- colors green/blue as soon as *either* feeder is decided, not just
  // when both are, so a single early result lights up the path right away.
  function feederAdvanced(prevRound, idx) {
    return !!(prevRound[2 * idx]?._decided || prevRound[2 * idx + 1]?._decided);
  }

  // Round of 32 / Round of 16 matchNums are assigned chronologically (by kickoff
  // date/venue, per BRACKET_TEMPLATE), not by bracket-tree position. The slot
  // heights below double per round on the assumption that array index k of a
  // round is fed by indices 2k/2k+1 of the previous round, so rendering in raw
  // matchNum order misaligns the visual tree (e.g. match 94 — the real feeder
  // for match 81's winner — would render one slot below where match 81/82's
  // column actually sits). These orders are derived from the [W##] feeder
  // references baked into BRACKET_TEMPLATE and verified against the official
  // bracket graphic; QF/SF/Final matchNums already happen to be in tree order.
  const R32_TREE_ORDER = [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87];
  const R16_TREE_ORDER = [89, 90, 93, 94, 91, 92, 95, 96];
  const byTreeOrder = order => (a, b) => order.indexOf(a.matchNum) - order.indexOf(b.matchNum);

  const r32 = state.matches.filter(m => m.stage === 'Round of 32').sort(byTreeOrder(R32_TREE_ORDER));
  const r16 = state.matches.filter(m => m.stage === 'Round of 16').sort(byTreeOrder(R16_TREE_ORDER));
  const qf = state.matches.filter(m => m.stage === 'Quarterfinals');
  const sf = state.matches.filter(m => m.stage === 'Semifinals');
  const final = state.matches.filter(m => m.stage === 'Final');
  const thirdPlaceMatch = state.matches.filter(m => m.stage === 'Third Place');

  let html = `<div class="bracket-header-row"><div class="bracket-header-row-inner">
    <div class="bracket-round-title">Round of 32</div>
    <div class="bracket-round-title">Round of 16</div>
    <div class="bracket-round-title">Quarterfinals</div>
    <div class="bracket-round-title">Semifinals</div>
    <div class="bracket-round-title">Final</div>
  </div></div>`;

  html += `<div class="bracket-wrapper"><div class="bracket">`;

  html += `<div class="bracket-round r32">
    ${r32.map(m => bSlot(m, false)).join('')}
  </div>`;

  html += `<div class="bracket-round r16">
    ${r16.map((m, i) => bSlot(m, feederAdvanced(r32, i))).join('')}
  </div>`;

  html += `<div class="bracket-round rqf">
    ${qf.map((m, i) => bSlot(m, feederAdvanced(r16, i))).join('')}
  </div>`;

  html += `<div class="bracket-round rsf">
    ${sf.map((m, i) => bSlot(m, feederAdvanced(qf, i))).join('')}
  </div>`;

  const finalIncoming = feederAdvanced(sf, 0);
  html += `<div class="bracket-round rfin">
    <div class="rfin-body">
      <div class="final-group">
        <div class="final-slot ${finalIncoming ? 'incoming-advanced' : ''}">${final.map(bMatchHtml).join('')}</div>
        <div class="round-label third-label">3rd Place</div>
        ${thirdPlaceMatch.map(bMatchHtml).join('')}
      </div>
    </div>
  </div>`;

  html += `</div></div>`;
  morphInto(el, html);

  // Keep the frozen header row's horizontal position in sync with the
  // match columns below it, since it lives outside .bracket-wrapper's
  // scroll container (see CSS comment on .bracket-header-row).
  const wrapper = el.querySelector('.bracket-wrapper');
  const headerInner = el.querySelector('.bracket-header-row-inner');
  if (wrapper && headerInner && !wrapper.dataset.scrollSynced) {
    wrapper.dataset.scrollSynced = '1';
    wrapper.addEventListener('scroll', () => {
      el.querySelector('.bracket-header-row-inner').style.transform = `translateX(${-wrapper.scrollLeft}px)`;
    });
  }
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

  // Scroll to top on all views except schedule (which lands at today's section itself),
  // and not on silent background refreshes
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

// ESPN's general news feed for the tournament — fetched once on startup, same
// pattern as combinations.json/fifa_rankings.json. Each article's categories[]
// array tags it with team/event IDs that line up with TEAM_MASTER_DATA[team].espnId
// and match.espnEventId, so team/match relevance is filtered client-side rather
// than relying on ESPN's server-side team/event news endpoints (which don't work
// for soccer — confirmed via blueprint_data/espn_news_probe).
async function fetchESPNNews() {
  try {
    const res = await fetch(ESPN_NEWS_URL);
    if (res.ok) {
      const data = await res.json();
      // ESPN's article objects carry no source label of their own (unlike rss_news.json
      // items, which are tagged per-feed by update_tracker.js) — stamp one on so every
      // news badge, ESPN included, shows where it came from. See newsListHtml().
      state.espnNews = (data.articles || []).map(a => ({ ...a, source: a.source || 'ESPN' }));
    }
  } catch (e) {
    console.error('ESPN news fetch error:', e);
  }
}

// Common recency key across ESPN articles (`published`) and rss_news.json items (`pubDate`).
function articleTimestamp(a) {
  return new Date(a.published || a.pubDate || 0).getTime();
}

// Interleaves articles from multiple sources by actual recency, rather than listing
// one source's results in full before ever showing another's — see getTeamNews()/
// getMatchNews() for why this matters: with limit=1 (used on match cards), a naive
// "ESPN first, RSS only once ESPN runs out" order meant RSS items never got a chance
// to show at all whenever ESPN had any article for that team/match.
function mergeNewsByRecency(...lists) {
  return lists.flat().sort((a, b) => articleTimestamp(b) - articleTimestamp(a));
}

// Supplemental news from BBC Sport / The Guardian RSS feeds, baked into a static
// JSON file server-side by update_tracker.js (these hosts don't set CORS headers,
// so they can't be fetched directly from the browser) — same once-on-startup
// pattern as combinations.json/fifa_rankings.json. Each item already carries a
// `teams` array (substring-matched against TEAM_MASTER_DATA names) in lieu of
// ESPN's structured category IDs.
async function fetchRssNews() {
  try {
    const res = await fetch('./data/rss_news.json');
    if (res.ok) state.rssNews = (await res.json()).items || [];
  } catch (e) {
    console.error('rss_news.json fetch error:', e);
  }
}

function newsCategoryIds(article, type) {
  return (article.categories || [])
    .filter(c => c.type === type)
    .map(c => type === 'team' ? c.teamId : c.eventId);
}

// News mentioning a given team, most recent first (ESPN's feed is already sorted that way).
// Supplemented with rss_news.json items (BBC Sport / The Guardian, baked in server-side by
// update_tracker.js) tagged with this team via plain substring matching — see "teams" on
// each rss_news.json item. RSS items are appended after ESPN's so ESPN (richer, ID-matched)
// results always come first.
function getTeamNews(teamName, limit = 3) {
  const espnId = TEAM_MASTER_DATA[teamName]?.espnId;
  const espnArticles = espnId
    ? state.espnNews.filter(a => newsCategoryIds(a, 'team').includes(espnId))
    : [];
  const rssArticles = state.rssNews.filter(a => a.teams?.includes(teamName));
  return mergeNewsByRecency(espnArticles, rssArticles).slice(0, limit);
}

// News tagged with this specific match's ESPN event, falling back to news
// mentioning either team once the dedicated event coverage runs out (or for
// matches ESPN hasn't started tracking yet, which have no espnEventId at all).
// Supplemented with rss_news.json items mentioning either team, same as getTeamNews().
function getMatchNews(match, limit = 3) {
  let espnArticles = [];
  if (match.espnEventId) {
    const eventId = Number(match.espnEventId);
    espnArticles = state.espnNews.filter(a => newsCategoryIds(a, 'event').includes(eventId));
  }
  if (!espnArticles.length) {
    const homeId = TEAM_MASTER_DATA[match.homeTeam]?.espnId;
    const awayId = TEAM_MASTER_DATA[match.awayTeam]?.espnId;
    espnArticles = state.espnNews.filter(a => {
      const ids = newsCategoryIds(a, 'team');
      return (homeId && ids.includes(homeId)) || (awayId && ids.includes(awayId));
    });
  }
  const rssArticles = state.rssNews.filter(a =>
    a.teams?.includes(match.homeTeam) || a.teams?.includes(match.awayTeam));
  return mergeNewsByRecency(espnArticles, rssArticles).slice(0, limit);
}

function newsListHtml(articles) {
  if (!articles.length) return '';
  return `<div class="news-list">${articles.map(a => {
    const link = a.links?.web?.href;
    const img = a.images?.[0]?.url;
    return `<a class="news-item" href="${link}" target="_blank" rel="noopener noreferrer">
      ${img ? `<img class="news-thumb" src="${img}" alt="">` : '<span class="news-thumb news-thumb-placeholder">📰</span>'}
      <span class="news-text">
        <span class="news-headline">${a.headline}</span>
        ${a.source ? `<span class="news-source">${a.source}</span>` : ''}
      </span>
    </a>`;
  }).join('')}</div>`;
}

// ===== SCROLLING NEWS WIDGET (match cards) =====
// Like the live commentary ticker, but for the small news block shown on
// non-live match cards: ‹/› buttons that wrap around instead of disabling at
// the ends, swipe support, and a 10s auto-advance that pauses on hover and
// restarts (not resets the position, just the countdown) on manual navigation.
// No item counter — wrap-around makes "N/total" less meaningful than it is
// for commentary, which never wraps.
const NEWS_ADVANCE_MS = 10000;
const newsAdvanceTimers = new Map(); // matchNum -> intervalId
const newsHoverPaused = new Set();   // matchNums currently hovered

function newsScrollInnerHtml(match, articles) {
  if (!articles?.length) return '';
  const len = articles.length;
  let idx = ((match._newsIdx ?? 0) % len + len) % len;
  match._newsIdx = idx;
  const a = articles[idx];
  const link = a.links?.web?.href;
  const img = a.images?.[0]?.url;
  const navHtml = len > 1 ? `
    <div class="news-nav">
      <button class="news-btn" data-matchnum="${match.matchNum}" data-dir="-1" aria-label="Previous news">‹</button>
      <button class="news-btn" data-matchnum="${match.matchNum}" data-dir="1" aria-label="Next news">›</button>
    </div>` : '';
  return `<a class="news-item news-scroll-item" href="${link}" target="_blank" rel="noopener noreferrer">
      ${img ? `<img class="news-thumb" src="${img}" alt="">` : '<span class="news-thumb news-thumb-placeholder">📰</span>'}
      <span class="news-text">
        <span class="news-headline">${a.headline}</span>
        ${a.source ? `<span class="news-source">${a.source}</span>` : ''}
      </span>
    </a>${navHtml}`;
}

function startNewsAdvance(matchNum) {
  clearInterval(newsAdvanceTimers.get(matchNum));
  const timer = setInterval(() => {
    if (newsHoverPaused.has(matchNum)) return;
    navigateNews(matchNum, 1);
  }, NEWS_ADVANCE_MS);
  newsAdvanceTimers.set(matchNum, timer);
}

// Only (re)starts the timer the first time a match's news widget is rendered —
// repeated calls on every poll/re-render would otherwise keep resetting the
// 10s countdown before it ever fires.
function ensureNewsAdvance(matchNum) {
  if (newsAdvanceTimers.has(matchNum)) return;
  startNewsAdvance(matchNum);
}

// Steps a match's displayed news item by `dir` (wraps around at either end).
// Shared by the ‹/› button click handler and the news swipe gesture.
function navigateNews(matchNum, dir) {
  const match = state.matches.find(m => m.matchNum === matchNum);
  const articles = match?._newsArticles;
  if (!match || !articles?.length) return;
  const len = articles.length;
  match._newsIdx = ((match._newsIdx ?? 0) + dir) % len;
  if (match._newsIdx < 0) match._newsIdx += len;
  document.querySelectorAll(`.match-news[data-matchnum="${matchNum}"]`).forEach(node => {
    node.classList.remove('mc-anim');
    void node.offsetWidth; // restart fade animation
    node.innerHTML = newsScrollInnerHtml(match, articles);
    node.classList.add('mc-anim');
  });
  // Manual navigation resets the auto-advance countdown (not the position).
  startNewsAdvance(matchNum);
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
      '_espnStats','_espnColors','_espnEvents','_espnHeadline','_espnCommentary','_commentarySeq',
      '_commentaryLastNav','espnEventId'];
    const ESPN_AUTHORITATIVE_FIELDS = ['status', 'homeScore', 'awayScore', 'homeFairPlay', 'awayFairPlay',
      'homeYellowCards', 'awayYellowCards', 'homeRedCards', 'awayRedCards', 'homeFouls', 'awayFouls', 'homeSaves', 'awaySaves',
      'homeCorners', 'awayCorners', 'homePassPct', 'awayPassPct', 'homeShots', 'awayShots', 'homeShotsOnTarget', 'awayShotsOnTarget',
      'homeTackles', 'awayTackles', 'homeInterceptions', 'awayInterceptions', 'homeClearances', 'awayClearances',
      'homeCrosses', 'awayCrosses', 'homeLongBalls', 'awayLongBalls', 'homePossession', 'awayPossession', 'espnEventId'];
    const existingByNum = new Map(state.matches.map(m => [m.matchNum, m]));
    state.matches = (data.matches || []).map(nm => {
      const ex = existingByNum.get(nm.matchNum);
      if (!ex) return nm;
      const fields = (state.espnSynced && ex.espnEventId) ? [...ESPN_FIELDS, ...ESPN_AUTHORITATIVE_FIELDS] : ESPN_FIELDS;
      const espn = Object.fromEntries(fields.filter(k => k in ex).map(k => [k, ex[k]]));
      return { ...nm, ...espn };
    });
    // matchNum is assigned at backend bootstrap via a global UTC-chronological sort, which
    // doesn't line up with the Pacific-Time calendar-day grouping the Schedule/Dashboard views
    // use — two matches can land under the same PT day but cross a UTC-midnight boundary, putting
    // them out of order. Sort by actual kickoff instant (timezone-agnostic) so every consumer of
    // state.matches sees correct chronological order without needing its own sort.
    state.matches.sort((a, b) => {
      if (!a.kickoff || !b.kickoff) return 0;
      return new Date(a.kickoff) - new Date(b.kickoff);
    });
    // Fill in any Round of 32 slot whose group position is now mathematically
    // locked, ahead of the group stage actually completing -- see
    // applyBracketResolutions for why. Must re-run every poll since
    // state.matches was just rebuilt fresh from data.json above.
    applyBracketResolutions(state.matches);

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
    const label = m.stage || '';
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

function teamUpcomingRows(teamName) {
  const upcoming = state.matches.filter(m =>
    (m.homeTeam === teamName || m.awayTeam === teamName) && m.status !== 'FINISHED'
  ).sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  if (!upcoming.length) return '';

  const rows = upcoming.map(m => {
    const isHome = m.homeTeam === teamName;
    const opp = isHome ? m.awayTeam : m.homeTeam;
    const oppIso = isHome ? m.awayIso : m.homeIso;
    const isLive = m.status === 'IN_PLAY' || m.status === 'PAUSED';
    const dateLabel = m.kickoff
      ? new Date(m.kickoff).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })
      : 'TBD';
    const timeLabel = m.kickoff
      ? new Date(m.kickoff).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles', timeZoneName: 'short' })
      : '';
    const label = m.stage || '';
    const whenLabel = isLive ? 'Live' : [dateLabel, timeLabel].filter(Boolean).join(', ');
    return `
      <div class="tm-result-row">
        <span class="tm-result-badge" style="background:${isLive ? '#DC2626' : '#94A3B8'}">${isLive ? '●' : 'vs'}</span>
        ${flagImg(oppIso, opp)}
        <span class="tm-opp">${opp}</span>
        <span class="tm-meta">${[label, whenLabel].filter(Boolean).join(' · ')}</span>
      </div>`;
  }).join('');
  return rows;
}

// Reads straight from state.matches — homeShots/homePossession/etc. are populated
// either live (mergeESPNData(), while ESPN tracks the match) or permanently
// (update_tracker.js's syncMatchStats(), once FINISHED), so no ESPN fetch is needed
// here at all. This used to fire one historical ESPN lookup per finished match
// every time a team modal opened; now it's free, since the data is already cached
// in data.json by the time a match is finished.
function teamStatsAggregate(teamName) {
  const finished = state.matches.filter(m =>
    (m.homeTeam === teamName || m.awayTeam === teamName) && m.status === 'FINISHED'
  );
  if (!finished.length) return null;

  let poss = 0, shots = 0, onTarget = 0, corners = 0, fouls = 0, yellows = 0, reds = 0, n = 0;
  for (const m of finished) {
    const isHome = m.homeTeam === teamName;
    const myShots = isHome ? m.homeShots : m.awayShots;
    if (typeof myShots !== 'number') continue; // not yet synced — skip rather than dilute the average
    poss     += (isHome ? m.homePossession      : m.awayPossession)      || 0;
    shots    += myShots;
    onTarget += (isHome ? m.homeShotsOnTarget   : m.awayShotsOnTarget)   || 0;
    corners  += (isHome ? m.homeCorners         : m.awayCorners)        || 0;
    fouls    += (isHome ? m.homeFouls           : m.awayFouls)          || 0;
    yellows  += (isHome ? m.homeYellowCards     : m.awayYellowCards)    || 0;
    reds     += (isHome ? m.homeRedCards        : m.awayRedCards)       || 0;
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
  const upcomingHtml = teamUpcomingRows(teamName);
  const newsHtml = newsListHtml(getTeamNews(teamName));
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
          <div class="tm-sub">Group ${meta.group} · FIFA Rank #${fifaRankOf(teamName)}</div>
        </div>
      </div>
      ${recordHtml}
      <div id="tm-stats-section" class="tm-loading">Loading stats…</div>
      ${upcomingHtml ? `<div class="tm-section-label">Upcoming</div>${upcomingHtml}` : ''}
      <div class="tm-section-label">Results</div>
      ${teamMatchRows(teamName)}
      ${newsHtml ? `<div class="tm-section-label">News</div>${newsHtml}` : ''}
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

  const agg = teamStatsAggregate(teamName);
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
    ${headline ? `<div class="mdm-headline">${headline}</div>` : ''}
  `;
}

async function openMatchModal(matchNum) {
  const rawMatch = state.matches.find(m => m.matchNum === matchNum);
  if (!rawMatch) return;
  const match = resolveMatchTeams(rawMatch);

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
      ${(() => { const n = newsListHtml(getMatchNews(match)); return n ? `<div class="tm-section-label">News</div>${n}` : ''; })()}
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
    // Still fetch historical for full timeline. The historical re-fetch sometimes lacks
    // a headline that was present during live tracking (ESPN doesn't always backfill it),
    // so keep the live one as a fallback rather than letting the overwrite drop it.
    const liveHeadline = espnData.headline;
    const found = await findESPNEventNearDate(dateStr, match.homeTeam, match.awayTeam);
    if (found) {
      espnData = parseESPNEventData(found.comp, found.homeComp, found.awayComp, found.swapped);
      espnData.headline = espnData.headline || liveHeadline;
    }
  } else {
    const found = await findESPNEventNearDate(dateStr, match.homeTeam, match.awayTeam);
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

// Delegated click handler for match cards — whole card opens the match modal
// except live cards already showing inline stats (no .clickable class there).
document.addEventListener('click', e => {
  if (e.target.closest('.team-link, .flag-link, .mc-btn, .news-item, .news-btn')) return; // let those handlers take it
  const card = e.target.closest('.match-card.clickable[data-matchnum]');
  if (!card) return;
  const matchNum = parseInt(card.dataset.matchnum, 10);
  if (matchNum) openMatchModal(matchNum);
});

// Delegated click handler for bracket match cards — whole card opens the match modal.
document.addEventListener('click', e => {
  if (e.target.closest('.team-link, .flag-link')) return;
  const card = e.target.closest('.b-match[data-matchnum]');
  if (!card) return;
  const matchNum = parseInt(card.dataset.matchnum, 10);
  if (matchNum) openMatchModal(matchNum);
});

// Delegated handlers for the Dashboard's team search input — delegated on document
// (not bound inside renderDashboard) since #team-search/#team-search-clear are
// re-rendered on every renderDashboard() call (including the calls these very
// handlers trigger); binding directly to the element each render stacked a fresh
// listener on top of the old one every time, growing without bound and eventually
// crashing the page.
document.addEventListener('change', e => {
  if (e.target.id !== 'team-search') return;
  const val = e.target.value.trim();
  if (TEAM_MASTER_DATA[val]) {
    state.teamFilter = val;
  } else if (!val) {
    state.teamFilter = null;
  }
  renderDashboard();
});
document.addEventListener('input', e => {
  if (e.target.id !== 'team-search') return;
  if (!e.target.value.trim()) {
    state.teamFilter = null;
    renderDashboard();
  }
});
document.addEventListener('click', e => {
  if (!e.target.closest('#team-search-clear')) return;
  state.teamFilter = null;
  renderDashboard();
});

// Delegated click handler for live commentary scroll controls (prev/next comment)
document.addEventListener('click', e => {
  const btn = e.target.closest('.mc-btn');
  if (!btn || btn.disabled) return;
  e.stopPropagation();
  navigateCommentary(parseInt(btn.dataset.matchnum, 10), parseInt(btn.dataset.dir, 10));
});

// Delegated click handler for the news widget's scroll controls (prev/next, wraps)
document.addEventListener('click', e => {
  const btn = e.target.closest('.news-btn');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  navigateNews(parseInt(btn.dataset.matchnum, 10), parseInt(btn.dataset.dir, 10));
});

// Pause/resume the news widget's auto-advance on hover. mouseover/mouseout
// (not mouseenter/mouseleave, which don't bubble) delegated on document since
// .match-news nodes are replaced/morphed on every poll. el.contains(relatedTarget)
// filters out moves between the widget's own children.
document.addEventListener('mouseover', e => {
  const el = e.target.closest('.match-news');
  if (!el || el.contains(e.relatedTarget)) return;
  newsHoverPaused.add(parseInt(el.dataset.matchnum, 10));
});
document.addEventListener('mouseout', e => {
  const el = e.target.closest('.match-news');
  if (!el || el.contains(e.relatedTarget)) return;
  newsHoverPaused.delete(parseInt(el.dataset.matchnum, 10));
});

// ===== SWIPE GESTURES =====
// Delegated on document (not attached per-node) since match cards and view
// containers are wholesale-replaced/re-rendered on every poll — node-level
// listeners would be lost on the next refresh.
const SWIPE_MIN_DISTANCE = 50; // px
const SWIPE_MAX_OFF_AXIS_RATIO = 0.6; // vertical drift allowed, relative to horizontal distance
const NAV_VIEW_ORDER = ['dashboard', 'schedule', 'standings', 'bracket'];

let swipeStartX = null, swipeStartY = null, swipeStartTarget = null;

document.addEventListener('touchstart', e => {
  if (e.touches.length !== 1) return;
  swipeStartX = e.touches[0].clientX;
  swipeStartY = e.touches[0].clientY;
  swipeStartTarget = e.target;
}, { passive: true });

document.addEventListener('touchend', e => {
  if (swipeStartX === null) return;
  const touch = e.changedTouches[0];
  const dx = touch.clientX - swipeStartX;
  const dy = touch.clientY - swipeStartY;
  const startTarget = swipeStartTarget;
  swipeStartX = swipeStartY = swipeStartTarget = null;
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dy) > Math.abs(dx) * SWIPE_MAX_OFF_AXIS_RATIO) return;

  // Swiping over live commentary steps through comment history instead of
  // changing views: swipe right to go back to older comments (like a "back"
  // gesture), swipe left to return to newer ones.
  const commentaryEl = startTarget?.closest?.('.match-commentary');
  if (commentaryEl) {
    navigateCommentary(parseInt(commentaryEl.dataset.matchnum, 10), dx < 0 ? -1 : 1);
    return;
  }

  // Swiping over the news widget steps through its (wrap-around) item list:
  // swipe left for next, swipe right for previous.
  const newsEl = startTarget?.closest?.('.match-news');
  if (newsEl) {
    navigateNews(parseInt(newsEl.dataset.matchnum, 10), dx < 0 ? 1 : -1);
    return;
  }

  // Don't hijack horizontal swipes inside the bracket view — its rounds
  // scroll horizontally via native overflow and need the gesture themselves.
  if (startTarget?.closest?.('.bracket-wrapper')) return;

  const idx = NAV_VIEW_ORDER.indexOf(state.currentView);
  const nextIdx = idx + (dx < 0 ? 1 : -1);
  if (nextIdx < 0 || nextIdx >= NAV_VIEW_ORDER.length) return;
  state.currentView = NAV_VIEW_ORDER[nextIdx];
  renderView();
}, { passive: true });

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
    const syncMargin = () => {
      main.style.marginTop = header.offsetHeight + 'px';
      document.documentElement.style.setProperty('--header-h-actual', header.offsetHeight + 'px');
    };
    syncMargin();
    new ResizeObserver(syncMargin).observe(header);
  }

  initNotifPermissionBtn();

  const footer = document.getElementById('app-footer');
  if (footer) footer.textContent = `WC2026 Dashboard ${APP_VERSION} · Updated ${APP_UPDATED}`;

  // Live mode toggle (floating button)
  const fab = document.getElementById('live-mode-fab');
  if (fab) {
    fab.addEventListener('click', () => {
      state.liveMode = !state.liveMode;
      updateLiveModeFab();
      renderView({ silent: true }); // toggling shouldn't jerk the page back to the top
    });
    updateLiveModeFab();
  }

  // Initial load: data.json (full schedule + standings) and the static
  // combinations.json lookup table (fetched once, never refetched) in parallel.
  await Promise.all([fetchCombinations(), fetchFifaRankings(), fetchESPNNews(), fetchRssNews(), fetchData()]);

  // Initial ESPN sync — overlays live scores immediately
  await fetchESPN();

  // Tick every second for live clocks
  if (state.tickInterval) clearInterval(state.tickInterval);
  state.tickInterval = setInterval(tick, 1000);

  // ESPN: poll every 10s for live scores; data.json: re-fetch every 2 minutes
  // for schedule/standings/knockout updates. Also restarted on resume from
  // background — see RESUME / VISIBILITY above.
  restartPollIntervals();

  // Rotate the hero stat pool every 24s, swapping out all three displayed stats at
  // once (advance by 3, not 1) so each tick shows a fresh set rather than sliding one
  // stat at a time. Purely cosmetic (no fetch involved), so unlike the poll intervals
  // above it doesn't need restarting on PWA resume — a few missed rotations while
  // backgrounded is harmless.
  state.heroStatInterval = setInterval(() => {
    state._heroStatIdx += 3;
    if (state.currentView === 'dashboard' && !state.teamFilter) renderView({ silent: true });
  }, 24000);

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
