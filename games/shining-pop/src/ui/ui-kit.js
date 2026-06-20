// Shared high-fidelity UI toolkit for the SHINING POP control surfaces.
//
// Everything here is procedural PIXI.Graphics (no external assets) so it stays
// inside the single-file casino-RGS build and renders crisp at any scale. The
// goal is an "expert" neon candy-glass look: layered depth (radial sphere base,
// inner shadow, top gloss, bottom rim light, crisp neon edge) plus a clean,
// correct, well-formed icon set — instead of the flat single-gradient buttons
// and crude hand-drawn glyphs the bars used before.
import * as PIXI from 'pixi.js';

export const THEME = {
  // candy neon palette (shared with the betting bars)
  edge: 0xff7ad0,
  edgeDeep: 0xbf2496,
  rim: 0xffd9f4,
  cyan: 0xbfe8ff,
  gloss: 0xffffff,
  icon: 0xfdf2ff,
  iconDim: 0xe9d6f5,
  shadow: 0x140a2c,
  // gradients
  btnBase: [[0, '#6a47a6'], [0.42, '#3a2468'], [1, '#160d33']],
  btnSpin: [[0, '#ffe8fb'], [0.34, '#ff7ad0'], [0.66, '#9a4fcf'], [1, '#3e2076']],
  btnSpinCore: [[0, '#3a2666'], [0.6, '#1a1138'], [1, '#0b0723']],
  activeGlyph: [[0, '#ffe6f7'], [0.45, '#ff66bd'], [1, '#c42a99']],
  panel: [[0, '#46297a'], [0.5, '#2e1c58'], [1, '#19103e']],
};

export function fg(stops, dir) {
  const end = dir === 'h' ? { x: 1, y: 0 } : dir === 'd' ? { x: 1, y: 1 } : { x: 0, y: 1 };
  return new PIXI.FillGradient({
    type: 'linear', start: { x: 0, y: 0 }, end,
    colorStops: stops.map((s) => ({ offset: s[0], color: s[1] })), textureSpace: 'local',
  });
}
export function fgRad(stops, cx, cy, outerR) {
  return new PIXI.FillGradient({
    type: 'radial', center: { x: cx, y: cy }, innerRadius: 0,
    outerCenter: { x: 0.5, y: 0.5 }, outerRadius: outerR || 0.62,
    colorStops: stops.map((s) => ({ offset: s[0], color: s[1] })), textureSpace: 'local',
  });
}

// ---- chrome -------------------------------------------------------------

// A glossy, 3-D circular button face. Light reads from the top: radial sphere
// base, a grounded bottom inner-shadow, a neon bottom rim-light bounce, a soft
// top gloss, and a crisp double edge (neon + cyan sheen).
export function glassCircle(r, opts = {}) {
  const base = opts.base || THEME.btnBase;
  const edge = opts.edge != null ? opts.edge : THEME.edge;
  const rim = opts.rim != null ? opts.rim : THEME.rim;
  const g = new PIXI.Graphics();
  // sphere base — radial, brightest toward the top
  g.circle(0, 0, r).fill(fgRad(base, 0.5, 0.30, 0.72));
  // bottom inner shadow → seats the face
  g.arc(0, 0, r * 0.97, 0.34, Math.PI - 0.34).stroke({ width: r * 0.12, color: THEME.shadow, alpha: 0.45, cap: 'round' });
  // bottom rim light → neon bounce
  g.arc(0, 0, r - r * 0.05, 0.5, Math.PI - 0.5).stroke({ width: r * 0.05, color: rim, alpha: 0.45, cap: 'round' });
  // top gloss highlight (two stacked ellipses, soft → bright)
  g.ellipse(0, -r * 0.40, r * 0.64, r * 0.38).fill({ color: THEME.gloss, alpha: 0.14 });
  g.ellipse(0, -r * 0.52, r * 0.38, r * 0.16).fill({ color: THEME.gloss, alpha: 0.30 });
  // crisp neon edge + inner cyan sheen
  g.circle(0, 0, r - r * 0.028).stroke({ width: Math.max(1.4, r * 0.052), color: edge, alpha: 0.96 });
  g.circle(0, 0, r - r * 0.11).stroke({ width: 1, color: THEME.cyan, alpha: 0.16 });
  return g;
}

// A glossy rounded panel/pill with the same language as glassCircle.
export function glassPanel(w, h, rx, opts = {}) {
  const base = opts.base || THEME.panel;
  const g = new PIXI.Graphics();
  g.roundRect(0, 0, w, h, rx).fill(fg(base, opts.horiz ? 'h' : 'v'));
  // top gloss band
  g.roundRect(2.5, 2, w - 5, h * 0.44, Math.max(0, rx - 2)).fill({ color: THEME.gloss, alpha: 0.12 });
  // bottom inner shadow band
  g.roundRect(3, h * 0.62, w - 6, h * 0.36, Math.max(0, rx - 3)).fill({ color: THEME.shadow, alpha: 0.18 });
  // inner cyan hairline
  g.roundRect(2, 2, w - 4, h - 4, Math.max(0, rx - 2)).stroke({ width: 1.1, color: THEME.cyan, alpha: 0.15 });
  // neon edge
  if (opts.edgeWidth) {
    const ew = opts.edgeWidth;
    g.roundRect(ew / 2, ew / 2, w - ew, h - ew, Math.max(0, rx - ew / 2)).stroke({ width: ew, color: opts.edge != null ? opts.edge : THEME.edge });
  }
  return g;
}

// ---- icons --------------------------------------------------------------
// Each icon draws centered at (0,0), sized to fit within radius ~s, and returns
// a Graphics. `col` defaults to the bright icon colour.

function strokeW(s, k) { return Math.max(2, s * k); }

// SPIN — two curved arrows (the universal refresh/spin glyph).
export function iconSpin(s, col = THEME.icon) {
  const g = new PIXI.Graphics();
  const w = strokeW(s, 0.20);
  const r = s * 0.92;
  const head = s * 0.30;
  // top arc (sweeps clockwise toward the right) + bottom arc (toward the left)
  g.arc(0, 0, r, -Math.PI * 0.86, Math.PI * 0.30).stroke({ width: w, color: col, cap: 'round' });
  g.arc(0, 0, r, Math.PI * 0.14, Math.PI * 1.30).stroke({ width: w, color: col, cap: 'round' });
  // arrowhead at top-right end (end angle Math.PI*0.30)
  const a1 = Math.PI * 0.30;
  const p1 = { x: Math.cos(a1) * r, y: Math.sin(a1) * r };
  const t1 = { x: -Math.sin(a1), y: Math.cos(a1) }; // tangent (cw)
  g.poly([
    p1.x + t1.x * head, p1.y + t1.y * head,
    p1.x - t1.x * head * 0.45 + (p1.x / r) * head, p1.y - t1.y * head * 0.45 + (p1.y / r) * head,
    p1.x - t1.x * head * 0.45 - (p1.x / r) * head, p1.y - t1.y * head * 0.45 - (p1.y / r) * head,
  ]).fill(col);
  // arrowhead at bottom-left end (end angle Math.PI*1.30)
  const a2 = Math.PI * 1.30;
  const p2 = { x: Math.cos(a2) * r, y: Math.sin(a2) * r };
  const t2 = { x: -Math.sin(a2), y: Math.cos(a2) };
  g.poly([
    p2.x + t2.x * head, p2.y + t2.y * head,
    p2.x - t2.x * head * 0.45 + (p2.x / r) * head, p2.y - t2.y * head * 0.45 + (p2.y / r) * head,
    p2.x - t2.x * head * 0.45 - (p2.x / r) * head, p2.y - t2.y * head * 0.45 - (p2.y / r) * head,
  ]).fill(col);
  return g;
}

// a small 4-point sparkle star (candy "shine").
function sparkleStar(g, cx, cy, rad, col = 0xffffff, alpha = 0.95) {
  g.poly([
    cx, cy - rad,
    cx + rad * 0.26, cy - rad * 0.26,
    cx + rad, cy,
    cx + rad * 0.26, cy + rad * 0.26,
    cx, cy + rad,
    cx - rad * 0.26, cy + rad * 0.26,
    cx - rad, cy,
    cx - rad * 0.26, cy - rad * 0.26,
  ]).fill({ color: col, alpha });
}

// draws the two spin arrows (arcs + heads) once, in a single colour/width.
// Two distinct ~144° arms 180° apart with clear gaps top + bottom, so it reads
// as a chasing twin-arrow "spin" — not a near-complete "refresh ring".
function spinArrowPath(g, r, w, headK, col) {
  const head = r * headK;
  const A = -0.42 * Math.PI, B = 0.38 * Math.PI;
  [0, Math.PI].forEach((off) => {
    const a1 = B + off;
    g.arc(0, 0, r, A + off, a1).stroke({ width: w, color: col, cap: 'round' });
    const px = Math.cos(a1) * r, py = Math.sin(a1) * r;
    const tx = -Math.sin(a1), ty = Math.cos(a1); // tangent (cw, travel dir)
    g.poly([
      px + tx * head, py + ty * head,
      px - tx * head * 0.5 + (px / r) * head, py - ty * head * 0.5 + (py / r) * head,
      px - tx * head * 0.5 - (px / r) * head, py - ty * head * 0.5 - (py / r) * head,
    ]).fill(col);
  });
}

// SPIN (candy) — glossy candy circular-arrows: deep-magenta candy outline, a
// bright candy-cream body, a top gloss sheen and sparkle shines. Gamified hero
// glyph for the spin button (replaces the flat utilitarian refresh ring).
export function iconSpinCandy(s, opts = {}) {
  const g = new PIXI.Graphics();
  const main = opts.main != null ? opts.main : 0xfff2fb;
  const outline = opts.outline != null ? opts.outline : 0x9a2370;
  const r = s * 0.86;
  const w = Math.max(2.5, s * 0.23);
  // candy outline (dark magenta, thicker) → bright candy-cream body
  spinArrowPath(g, r, w + Math.max(2, s * 0.13), 0.42, outline);
  spinArrowPath(g, r, w, 0.30, main);
  // sparkle shines — placed clear of the ring (top-right + bottom-left)
  sparkleStar(g, s * 0.92, -s * 0.86, s * 0.34, 0xffffff, 0.98);
  sparkleStar(g, -s * 1.02, s * 0.66, s * 0.22, 0xffe9fa, 0.9);
  return g;
}

// PLAY ▶ (autoplay / start) — rounded equilateral triangle.
export function iconPlay(s, col = THEME.icon) {
  const g = new PIXI.Graphics();
  const w = s * 1.02, h = s * 1.12;
  g.poly([-w * 0.42, -h * 0.5, w * 0.58, 0, -w * 0.42, h * 0.5]).fill(col);
  if (typeof col === 'number') g.stroke({ width: Math.max(1.5, s * 0.16), color: col, alpha: 1, join: 'round' });
  return g;
}

// TURBO — a clean, symmetric lightning bolt.
export function iconBolt(s, col = THEME.icon) {
  const g = new PIXI.Graphics();
  const x = s * 0.74, y = s * 1.06;
  g.poly([
    x * 0.30, -y,        // top
    -x * 0.62, y * 0.16, // left waist
    -x * 0.04, y * 0.16, // inner left
    -x * 0.30, y,        // bottom
    x * 0.62, -y * 0.16, // right waist
    x * 0.04, -y * 0.16, // inner right
  ]).fill(col);
  if (typeof col === 'number') g.stroke({ width: Math.max(1, s * 0.07), color: col, join: 'round' });
  return g;
}

// PLUS / MINUS — bold, rounded bars.
export function iconPlus(s, col = THEME.icon) {
  const g = new PIXI.Graphics();
  const w = strokeW(s, 0.30);
  g.moveTo(-s, 0).lineTo(s, 0).moveTo(0, -s).lineTo(0, s).stroke({ width: w, color: col, cap: 'round' });
  return g;
}
export function iconMinus(s, col = THEME.icon) {
  const g = new PIXI.Graphics();
  const w = strokeW(s, 0.30);
  g.moveTo(-s, 0).lineTo(s, 0).stroke({ width: w, color: col, cap: 'round' });
  return g;
}

// SOUND — speaker cone + two waves; `off` swaps the waves for a slash.
export function iconSound(s, col = THEME.icon, off = false) {
  const g = new PIXI.Graphics();
  const w = Math.max(1.6, s * 0.13);
  // speaker body (cone) — filled
  g.poly([
    -s * 0.95, -s * 0.30,
    -s * 0.55, -s * 0.30,
    -s * 0.05, -s * 0.72,
    -s * 0.05, s * 0.72,
    -s * 0.55, s * 0.30,
    -s * 0.95, s * 0.30,
  ]).fill(col);
  if (off) {
    g.moveTo(s * 0.18, -s * 0.55).lineTo(s * 0.95, s * 0.55)
      .moveTo(s * 0.95, -s * 0.55).lineTo(s * 0.18, s * 0.55)
      .stroke({ width: w, color: col, cap: 'round' });
  } else {
    g.arc(-s * 0.05, 0, s * 0.55, -0.9, 0.9).stroke({ width: w, color: col, cap: 'round' });
    g.arc(-s * 0.05, 0, s * 0.92, -0.8, 0.8).stroke({ width: w, color: col, cap: 'round' });
  }
  return g;
}

// MENU — three rounded bars (hamburger).
export function iconMenu(s, col = THEME.icon) {
  const g = new PIXI.Graphics();
  const w = Math.max(2, s * 0.22);
  [-s * 0.62, 0, s * 0.62].forEach((y) => g.moveTo(-s, y).lineTo(s, y));
  g.stroke({ width: w, color: col, cap: 'round' });
  return g;
}

// CLOSE ✕ — rounded.
export function iconClose(s, col = THEME.icon) {
  const g = new PIXI.Graphics();
  const w = strokeW(s, 0.26);
  g.moveTo(-s, -s).lineTo(s, s).moveTo(s, -s).lineTo(-s, s).stroke({ width: w, color: col, cap: 'round' });
  return g;
}

// COINS — a small stack (used by the bet/coins button).
export function iconCoins(s, col = THEME.edge) {
  const g = new PIXI.Graphics();
  const rx = s * 0.92, ry = s * 0.34;
  const mk = (yc, fill) => g.ellipse(0, yc, rx, ry).fill(fill).ellipse(0, yc, rx, ry).stroke({ width: Math.max(1, s * 0.06), color: THEME.edgeDeep, alpha: 0.8 });
  mk(s * 0.50, 0x9a4bd0);
  mk(s * 0.04, 0xc06fda);
  g.ellipse(0, -s * 0.42, rx, ry).fill(0xe7b3ff);
  g.ellipse(0, -s * 0.42, rx, ry).stroke({ width: Math.max(1, s * 0.06), color: THEME.edgeDeep, alpha: 0.7 });
  return g;
}

// ---- hero spin button ---------------------------------------------------
// A self-contained glossy spin button with arrow glyph, stop state, and a soft
// idle breathing pulse on the outer ring. Returns a Container with .spin(),
// ._arrow, ._stop and ._setIdle(on).
export function spinButton(R, opts = {}) {
  const g = new PIXI.Container();
  const inner = R * 0.78;
  // soft idle glow halo (pulses; sits behind the face so it never fights the
  // press-scale on the button container)
  const glow = new PIXI.Graphics();
  glow.circle(0, 0, R * 1.22).fill({ color: THEME.edge, alpha: 0.30 });
  glow.circle(0, 0, R * 1.08).fill({ color: THEME.edge, alpha: 0.22 });
  glow.alpha = 0;
  g.addChild(glow);
  g._glow = glow;
  const base = new PIXI.Graphics();
  // outer neon ring
  base.circle(0, 0, R).fill(fgRad(THEME.btnSpin, 0.5, 0.34, 0.72));
  base.circle(0, 0, R - 1).stroke({ width: R * 0.05, color: THEME.rim, alpha: 0.55 });
  base.arc(0, 0, R - R * 0.04, 0.5, Math.PI - 0.5).stroke({ width: R * 0.045, color: THEME.gloss, alpha: 0.30, cap: 'round' });
  // recessed glossy core
  base.circle(0, 0, inner).fill(fgRad(THEME.btnSpinCore, 0.42, 0.32, 0.62));
  base.circle(0, 0, inner).stroke({ width: R * 0.03, color: THEME.rim, alpha: 0.4 });
  base.arc(0, 0, inner * 0.96, Math.PI + 0.4, 2 * Math.PI - 0.4).stroke({ width: R * 0.06, color: THEME.shadow, alpha: 0.5, cap: 'round' });
  base.ellipse(0, -R * 0.30, R * 0.42, R * 0.18).fill({ color: THEME.gloss, alpha: 0.16 });
  g.addChild(base);

  // arrow glyph (gamified candy circular-arrows)
  const a = new PIXI.Container();
  a.addChild(iconSpinCandy(R * 0.40));
  g.addChild(a);

  // stop glyph (square)
  const stop = new PIXI.Graphics()
    .roundRect(-R * 0.24, -R * 0.24, R * 0.48, R * 0.48, R * 0.12).fill({ color: THEME.icon, alpha: 0.98 })
    .roundRect(-R * 0.24, -R * 0.24, R * 0.48, R * 0.48, R * 0.12).stroke({ color: THEME.edgeDeep, width: R * 0.03, alpha: 0.9 });
  stop.visible = false;
  g.addChild(stop);

  g._arrow = a; g._stop = stop;
  g.spin = () => {
    if (g.__s) return; g.__s = true; const s0 = performance.now();
    const tk = () => { const t = (performance.now() - s0) / 650; a.rotation = Math.min(t, 1) * Math.PI * 2; if (t < 1) requestAnimationFrame(tk); else { a.rotation = 0; g.__s = false; } };
    requestAnimationFrame(tk);
  };
  // soft idle breathing on the glow halo (a "ready to spin" pulse). Pulsing the
  // halo — not the button scale — keeps the press feedback in hit() clean.
  g._idle = null;
  g._setIdle = (on) => {
    if (on && !g._idle && typeof window !== 'undefined' && window.gsap) {
      glow.alpha = 0.25; glow.scale.set(0.94);
      g._idle = window.gsap.timeline({ repeat: -1, yoyo: true })
        .to(glow, { alpha: 0.7, duration: 1.0, ease: 'sine.inOut' }, 0)
        .to(glow.scale, { x: 1.06, y: 1.06, duration: 1.0, ease: 'sine.inOut' }, 0);
    } else if (!on && g._idle) {
      g._idle.kill(); g._idle = null;
      if (window.gsap) window.gsap.to(glow, { alpha: 0, duration: 0.25 }); else glow.alpha = 0;
    }
  };
  return g;
}
