// One-off preview generator for app icon options. Not part of the build.
import { createCanvas, registerFont } from 'canvas';
import { writeFileSync } from 'fs';

registerFont('/tmp/anybody-900-condensed.ttf', { family: 'Anybody', weight: '900' });

const SIZE = 512;

function baseGradient(ctx) {
  const g = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  g.addColorStop(0, '#2563EB');
  g.addColorStop(1, '#7C3AED');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

// ---------- Option A: classic flat-icon soccer ball ----------
// Center pentagon + radiating seams to small pentagon "patches" near the rim —
// the same simplified construction used by most flat soccer-ball icons
// (material/emoji style), which reads clearly even at 48px launcher size.
function pentagonPoints(cx, cy, r, startDeg) {
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const a = (startDeg + i * 72) * Math.PI / 180;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

function drawPoly(ctx, pts, fill) {
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawSoccerBall(ctx, cx, cy, r) {
  // Sphere base with soft shading
  const sphere = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.2, cx, cy, r);
  sphere.addColorStop(0, '#ffffff');
  sphere.addColorStop(0.75, '#f0f0f0');
  sphere.addColorStop(1, '#d6d6d6');
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = sphere;
  ctx.fill();
  ctx.clip();

  const black = '#1a1a1a';
  ctx.strokeStyle = black;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Central pentagon, point facing up
  const pentR = r * 0.30;
  const pentPts = pentagonPoints(cx, cy, pentR, -90);
  drawPoly(ctx, pentPts, black);

  // Seams radiating from each pentagon vertex out toward the rim, each
  // ending in a small dark patch — gives the classic truncated-icosahedron look
  const patchR = r * 0.16;
  ctx.lineWidth = r * 0.07;
  for (let i = 0; i < 5; i++) {
    const v = pentPts[i];
    const dirX = v.x - cx, dirY = v.y - cy;
    const dist = Math.hypot(dirX, dirY);
    const ux = dirX / dist, uy = dirY / dist;
    const patchCx = cx + ux * r * 0.74;
    const patchCy = cy + uy * r * 0.74;

    ctx.beginPath();
    ctx.moveTo(v.x, v.y);
    ctx.lineTo(patchCx - ux * patchR * 0.5, patchCy - uy * patchR * 0.5);
    ctx.stroke();

    const outerAngle = Math.atan2(uy, ux) * 180 / Math.PI - 90;
    drawPoly(ctx, pentagonPoints(patchCx, patchCy, patchR, outerAngle), black);
  }

  // subtle top-left highlight for sphere depth
  const hl = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.45, 0, cx - r * 0.4, cy - r * 0.45, r * 0.65);
  hl.addColorStop(0, 'rgba(255,255,255,0.5)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // outer rim line
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = r * 0.015;
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.stroke();
}

function renderOptionA(maskable) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  baseGradient(ctx);
  if (maskable) {
    // rounded square handled by OS; just keep ball within 80% safe zone
    drawSoccerBall(ctx, SIZE / 2, SIZE / 2, SIZE * 0.34);
  } else {
    roundRectClipBg(ctx);
    drawSoccerBall(ctx, SIZE / 2, SIZE / 2, SIZE * 0.40);
  }
  return canvas;
}

function roundRectClipBg(ctx) {
  // no-op here; "any" purpose icons are square, OS doesn't mask them
}

// ---------- Option B: WC / 2026 wordmark, using the app's heading font ----------
// Anybody condensed weight 900 — same family/width/weight used for headings in styles.css.
function renderOptionB(maskable) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  baseGradient(ctx);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';

  const safeW = maskable ? SIZE * 0.7 : SIZE * 0.82;

  // "WC" sized as large as fits the safe width
  let wcSize = SIZE * 0.46;
  ctx.font = `900 ${wcSize}px Anybody`;
  let wcWidth = ctx.measureText('WC').width;
  if (wcWidth > safeW) {
    wcSize *= safeW / wcWidth;
    ctx.font = `900 ${wcSize}px Anybody`;
    wcWidth = ctx.measureText('WC').width;
  }

  // "2026" scaled so its rendered width matches "WC"'s width
  let yearSize = SIZE * 0.16;
  ctx.font = `900 ${yearSize}px Anybody`;
  let yearWidth = ctx.measureText('2026').width;
  yearSize *= wcWidth / yearWidth;
  ctx.font = `900 ${yearSize}px Anybody`;
  yearWidth = ctx.measureText('2026').width;

  const gap = SIZE * 0.04;
  const totalH = wcSize * 0.72 + gap + yearSize * 0.72;
  const topY = (SIZE - totalH) / 2 + wcSize * 0.72;

  ctx.font = `900 ${wcSize}px Anybody`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('WC', SIZE / 2, topY);

  ctx.font = `900 ${yearSize}px Anybody`;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText('2026', SIZE / 2, topY + gap + yearSize * 0.72);

  return canvas;
}

for (const maskable of [false, true]) {
  const suffix = maskable ? 'maskable' : 'any';
  writeFileSync(`/tmp/icon-option-a-${suffix}.png`, renderOptionA(maskable).toBuffer('image/png'));
  writeFileSync(`/tmp/icon-option-b-${suffix}.png`, renderOptionB(maskable).toBuffer('image/png'));
}
console.log('done');
