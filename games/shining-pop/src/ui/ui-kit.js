// Shared high-fidelity UI toolkit for the SHINING POP control surfaces.
//
// Everything here is procedural PIXI.Graphics (no external assets) so it stays
// inside the single-file casino-RGS build and renders crisp at any scale. The
// goal is a PREMIUM neon candy-glass look: gem-like layered depth (seat shadow,
// radial sphere base, grounded inner shadow, neon bevel + 2-tone edge, top
// specular gloss, candy bloom) plus a clean, crisp, well-formed icon set.
import * as PIXI from 'pixi.js';

export const THEME = {
  // candy neon palette (shared with the betting bars)
  edge: 0xff77cf,       // candy-magenta neon edge
  edgeDeep: 0xb42490,   // deep magenta — under-layer of the 2-tone bevel / icon shade
  edgeBloom: 0xff8fd8,  // soft outer bloom around lit candy edges
  rim: 0xffd9f4,        // bright candy rim highlight (top bevel + bottom bounce)
  cyan: 0xcdebff,       // cool glass sheen
  gloss: 0xffffff,
  icon: 0xfff2fb,       // bright candy-white icon body
  iconDim: 0xe6c9ef,
  iconShade: 0x6f2a5c,  // icon outline / shade for definition
  shadow: 0x0b0522,     // seat / inner shadow
  // gradients (top → bottom)
  btnBase: [[0, '#9168cf'], [0.42, '#4a2e82'], [1, '#1b1040']], // glossy grape sphere, bright top
  btnSpin: [[0, '#ffe8fb'], [0.30, '#ff7ad0'], [0.64, '#9a4fcf'], [1, '#3a1d71']],
  btnSpinCore: [[0, '#48326f'], [0.55, '#1d1340'], [1, '#0a0622']],
  activeGlyph: [[0, '#ffe6f7'], [0.45, '#ff66bd'], [1, '#c42a99']],
  panel: [[0, '#553597'], [0.5, '#301d5e'], [1, '#160d37']],     // grape glass body
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

// Paint a premium glass pill/panel INTO an existing Graphics at the origin.
// The single source of truth for every rectangular surface (both bars route
// their local panels through here so web + mobile read identically).
//   opts: { fill: stops[], horiz, edge, edgeWidth, glow, gloss }
export function glassInto(g, w, h, rx, opts = {}) {
  const base = opts.fill || THEME.panel;
  const horiz = !!opts.horiz;
  const edge = opts.edge != null ? opts.edge : THEME.edge;
  const ew = opts.edgeWidth || 0;
  // optional draw-origin offset (default top-left). lets centred surfaces
  // (e.g. the game's modal cards drawn around their own origin) reuse this recipe.
  const X = opts.x || 0, Y = opts.y || 0;
  // SLEEKER MINIMAL PREMIUM: flat refined gradient body — no neon bloom halo.
  g.roundRect(X, Y, w, h, rx).fill(fg(base, horiz ? 'h' : 'v'));
  // one soft top sheen for the glass read (no glint dash, no stacked gel band)
  if (opts.gloss !== false) {
    g.roundRect(X + 1.5, Y + 1.5, w - 3, h * 0.5, Math.max(0, rx - 1.5)).fill({ color: THEME.gloss, alpha: 0.05 });
  }
  // faint bottom grounding (subtle, keeps the surface seated)
  g.roundRect(X + 2, Y + h * 0.70, w - 4, h * 0.28, Math.max(0, rx - 2)).fill({ color: THEME.shadow, alpha: 0.12 });
  // ONE clean refined edge — fintech-crisp. Floored to >=2.2px so it stays >=1
  // device-pixel after the bar's ~0.56x downscale at resolution 1 (no aliasing /
  // "crushed" edge); antialiasing then renders it as a clean hairline.
  if (ew) {
    const eww = Math.max(2.2, ew);
    g.roundRect(X + eww / 2, Y + eww / 2, w - eww, h - eww, Math.max(0, rx - eww / 2)).stroke({ width: eww, color: edge, alpha: 0.82 });
  }
  // top inner light line (>=1.6px so it survives the downscale instead of vanishing)
  g.moveTo(X + rx, Y + 1.2).lineTo(X + w - rx, Y + 1.2).stroke({ width: 1.6, color: THEME.gloss, alpha: 0.12 });
  return g;
}

// A glossy, 3-D candy-gem circular button face. Light reads from the top:
// seat shadow, radial sphere base, grounded inner shadow, neon bottom bounce,
// a bright top bevel crescent, soft+sharp top gloss, a crisp 2-tone neon edge.
export function glassCircle(r, opts = {}) {
  const base = opts.base || THEME.btnBase;
  const edge = opts.edge != null ? opts.edge : THEME.edge;
  const rim = opts.rim != null ? opts.rim : THEME.rim;
  const g = new PIXI.Graphics();
  // SLEEKER MINIMAL PREMIUM — soft contact shadow, gentle sphere, one clean edge,
  // a single subtle sheen. No neon bloom, no 2-tone edge, no stacked bevels.
  g.circle(0, r * 0.05, r * 0.99).fill({ color: THEME.shadow, alpha: 0.22 });
  g.circle(0, 0, r).fill(fgRad(base, 0.5, 0.34, 0.88));
  // subtle bottom grounding
  g.arc(0, 0, r * 0.96, 0.5, Math.PI - 0.5).stroke({ width: r * 0.10, color: THEME.shadow, alpha: 0.16, cap: 'round' });
  // ONE clean refined edge — floored to >=2.4px so the small buttons (r~30) stay
  // crisp (not aliased / "crushed") after the bar's ~0.56x downscale at resolution 1.
  g.circle(0, 0, r - r * 0.02).stroke({ width: Math.max(2.4, r * 0.052), color: edge, alpha: 0.8 });
  // a single soft top sheen + highlight arc (arc floored >=1.8px so it survives)
  g.ellipse(0, -r * 0.40, r * 0.50, r * 0.22).fill({ color: THEME.gloss, alpha: 0.10 });
  g.arc(0, 0, r - r * 0.07, Math.PI + 0.72, 2 * Math.PI - 0.72).stroke({ width: Math.max(1.8, r * 0.04), color: THEME.gloss, alpha: 0.22, cap: 'round' });
  return g;
}

// A glossy rounded panel/pill in the same language as glassCircle.
export function glassPanel(w, h, rx, opts = {}) {
  const g = new PIXI.Graphics();
  return glassInto(g, w, h, rx, { fill: opts.base, horiz: opts.horiz, edge: opts.edge, edgeWidth: opts.edgeWidth || 0 });
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
  g.arc(0, 0, r, -Math.PI * 0.86, Math.PI * 0.30).stroke({ width: w, color: col, cap: 'round' });
  g.arc(0, 0, r, Math.PI * 0.14, Math.PI * 1.30).stroke({ width: w, color: col, cap: 'round' });
  const a1 = Math.PI * 0.30;
  const p1 = { x: Math.cos(a1) * r, y: Math.sin(a1) * r };
  const t1 = { x: -Math.sin(a1), y: Math.cos(a1) };
  g.poly([
    p1.x + t1.x * head, p1.y + t1.y * head,
    p1.x - t1.x * head * 0.45 + (p1.x / r) * head, p1.y - t1.y * head * 0.45 + (p1.y / r) * head,
    p1.x - t1.x * head * 0.45 - (p1.x / r) * head, p1.y - t1.y * head * 0.45 - (p1.y / r) * head,
  ]).fill(col);
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

// Draws ONE chasing-arrow ring pass: a TOP arc + a BOTTOM arc (180° apart) with
// clear gaps at left & right, each ending in a fat tangent arrowhead so it reads
// unmistakably as a clockwise "spin" — the classic refresh ring, never letters.
function spinArrowPath(g, r, w, headK, col) {
  const head = r * headK;
  const A = 0.16 * Math.PI, B = 0.84 * Math.PI;    // bottom arm 28.8°→151.2° (≈122°)
  [0, Math.PI].forEach((off) => {
    const a0 = A + off, a1 = B + off;              // a1 = leading (clockwise) tip
    g.arc(0, 0, r, a0, a1).stroke({ width: w, color: col, cap: 'round' });
    const px = Math.cos(a1) * r, py = Math.sin(a1) * r;
    const tx = -Math.sin(a1), ty = Math.cos(a1);   // clockwise tangent (travel dir)
    const nx = Math.cos(a1), ny = Math.sin(a1);    // outward radial
    g.poly([
      px + tx * head * 1.12, py + ty * head * 1.12, // tip leads the travel
      px + nx * head * 0.82, py + ny * head * 0.82, // outer corner
      px - nx * head * 0.82, py - ny * head * 0.82, // inner corner
    ]).fill(col);
  });
}

// SPIN (candy) — glossy candy circular-arrows: deep-magenta candy outline, a
// bright candy-cream body, plus sparkle shines. Gamified hero glyph for the
// spin button.
export function iconSpinCandy(s, opts = {}) {
  // SLEEKER MINIMAL: clean twin circular-arrows (clear "spin"), crisp monoline,
  // no sparkles / no heavy candy outline (those read busy & as an "S").
  const g = new PIXI.Graphics();
  const main = opts.main != null ? opts.main : 0xfff4fb;
  const r = s * 0.84;
  const w = Math.max(2.5, s * 0.155);
  spinArrowPath(g, r, w, 0.42, main);
  return g;
}

// PLAY ▶ (autoplay / start) — rounded equilateral triangle.
export function iconPlay(s, col = THEME.icon) {
  const g = new PIXI.Graphics();
  const w = s * 1.04, h = s * 1.16;
  g.poly([-w * 0.40, -h * 0.5, w * 0.60, 0, -w * 0.40, h * 0.5]).fill(col);
  if (typeof col === 'number')
    g.stroke({ width: Math.max(1, Math.round(s * 0.08)), color: col, alpha: 1, join: 'round', cap: 'round' });
  return g;
}

// TURBO — a clean lightning bolt, point-symmetric through the origin.
export function iconBolt(s, col = THEME.icon) {
  const g = new PIXI.Graphics();
  const x = s * 0.76, y = s * 1.08;
  const pts = [
    x * 0.20, -y,
    -x * 0.48, y * 0.10,
    x * 0.04, y * 0.10,
    -x * 0.20, y,
    x * 0.48, -y * 0.10,
    -x * 0.04, -y * 0.10,
  ];
  g.poly(pts).fill(col);
  if (typeof col === 'number') g.stroke({ width: Math.max(1, Math.round(s * 0.07)), color: col, join: 'round', cap: 'round' });
  return g;
}

// PLUS / MINUS — bold, rounded bars.
export function iconPlus(s, col = THEME.icon) {
  const g = new PIXI.Graphics();
  const w = strokeW(s, 0.32);
  g.moveTo(-s, 0).lineTo(s, 0).moveTo(0, -s).lineTo(0, s).stroke({ width: w, color: col, cap: 'round' });
  return g;
}
export function iconMinus(s, col = THEME.icon) {
  const g = new PIXI.Graphics();
  const w = strokeW(s, 0.32);
  g.moveTo(-s, 0).lineTo(s, 0).stroke({ width: w, color: col, cap: 'round' });
  return g;
}

// SOUND — speaker cone + two waves; `off` swaps the waves for a slash.
export function iconSound(s, col = THEME.icon, off = false) {
  const g = new PIXI.Graphics();
  const w = Math.max(2, Math.round(s * 0.14));
  g.poly([
    -s * 0.92, -s * 0.3,
    -s * 0.52, -s * 0.3,
    -s * 0.02, -s * 0.72,
    -s * 0.02, s * 0.72,
    -s * 0.52, s * 0.3,
    -s * 0.92, s * 0.3,
  ]).fill(col);
  if (off) {
    g.moveTo(s * 0.24, -s * 0.5).lineTo(s * 0.94, s * 0.5)
      .moveTo(s * 0.94, -s * 0.5).lineTo(s * 0.24, s * 0.5)
      .stroke({ width: w, color: col, cap: 'round' });
  } else {
    g.arc(-s * 0.02, 0, s * 0.5, -0.8, 0.8).stroke({ width: w, color: col, cap: 'round' });
    g.arc(-s * 0.02, 0, s * 0.85, -0.8, 0.8).stroke({ width: w, color: col, cap: 'round' });
  }
  return g;
}

// MENU — three rounded bars (hamburger).
export function iconMenu(s, col = THEME.icon) {
  const g = new PIXI.Graphics();
  const w = Math.max(2, s * 0.24);
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

// COINS — a clean glossy candy-chip stack (the bet/coins button). Three stacked
// discs, each with a deep rim, a brighter top face, and a small shine on top.
export function iconCoins(s) {
  // SLEEKER MINIMAL: a clean casino-chip stack — bright candy faces (high contrast
  // on the dark gem), crisp thin edges, a center ring per chip, one clean shine.
  const g = new PIXI.Graphics();
  const rx = s * 0.92, ry = s * 0.38;
  const chip = (yc, side, face) => {
    g.ellipse(0, yc + ry * 0.46, rx, ry).fill(side);
    g.rect(-rx, yc - ry * 0.06, rx * 2, ry * 0.52).fill(side);
    g.ellipse(0, yc, rx, ry).fill(face);
    g.ellipse(0, yc, rx, ry).stroke({ width: Math.max(1, s * 0.05), color: 0x5a2a86, alpha: 0.55 });
    g.ellipse(0, yc, rx * 0.5, ry * 0.5).stroke({ width: Math.max(1, s * 0.04), color: 0x5a2a86, alpha: 0.32 });
  };
  chip(s * 0.42, 0x6a37a0, 0xcf9fe8);
  chip(s * 0.02, 0x7a42b2, 0xe6c2f6);
  chip(-s * 0.40, 0x9a5fd0, 0xfdf2ff);
  g.ellipse(-s * 0.28, -s * 0.50, rx * 0.30, ry * 0.30).fill({ color: 0xffffff, alpha: 0.7 });
  return g;
}

// ---- hero spin button ---------------------------------------------------
// A self-contained glossy candy-gem spin button with arrow glyph, stop state,
// and a soft idle breathing pulse. Returns a Container with .spin(), ._arrow,
// ._stop, ._glow and ._setIdle(on).
export function spinButton(R, opts = {}) {
  const g = new PIXI.Container();
  const inner = R * 0.78;
  // soft idle glow halo (pulses; sits behind the face)
  const glow = new PIXI.Graphics();
  glow.circle(0, 0, R * 1.24).fill({ color: THEME.edge, alpha: 0.30 });
  glow.circle(0, 0, R * 1.09).fill({ color: THEME.edge, alpha: 0.22 });
  glow.alpha = 0;
  g.addChild(glow);
  g._glow = glow;

  const base = new PIXI.Graphics();
  // seat shadow
  base.circle(0, R * 0.10, R * 1.02).fill({ color: THEME.shadow, alpha: 0.5 });
  // outer candy ring (radial gem) — sleeker minimal: no neon bloom halo

  base.circle(0, 0, R).fill(fgRad(THEME.btnSpin, 0.5, 0.30, 0.80));
  base.circle(0, 0, R - 1).stroke({ width: R * 0.05, color: THEME.rim, alpha: 0.6 });
  // 2-tone outer edge
  base.circle(0, 0, R - 0.5).stroke({ width: R * 0.045, color: THEME.edgeDeep, alpha: 0.55 });
  // top bevel + bottom seat on the ring
  base.arc(0, 0, R - R * 0.04, Math.PI + 0.5, 2 * Math.PI - 0.5).stroke({ width: R * 0.05, color: THEME.gloss, alpha: 0.34, cap: 'round' });
  base.arc(0, 0, R - R * 0.06, 0.5, Math.PI - 0.5).stroke({ width: R * 0.05, color: THEME.shadow, alpha: 0.35, cap: 'round' });
  // recessed glossy core
  base.circle(0, 0, inner).fill(fgRad(THEME.btnSpinCore, 0.42, 0.30, 0.64));
  base.circle(0, 0, inner).stroke({ width: R * 0.03, color: THEME.rim, alpha: 0.4 });
  base.arc(0, 0, inner * 0.96, Math.PI + 0.4, 2 * Math.PI - 0.4).stroke({ width: R * 0.06, color: THEME.shadow, alpha: 0.5, cap: 'round' });
  g.addChild(base);

  // arrow glyph (gamified candy circular-arrows)
  const a = new PIXI.Container();
  a.addChild(iconSpinCandy(R * 0.42));
  g.addChild(a);

  // stop glyph (rounded square)
  const stop = new PIXI.Graphics()
    .roundRect(-R * 0.24, -R * 0.24, R * 0.48, R * 0.48, R * 0.13).fill({ color: THEME.icon, alpha: 0.98 })
    .roundRect(-R * 0.24, -R * 0.24, R * 0.48, R * 0.48, R * 0.13).stroke({ color: THEME.edgeDeep, width: R * 0.03, alpha: 0.9 });
  stop.visible = false;
  g.addChild(stop);

  g._arrow = a; g._stop = stop;
  g.spin = () => {
    if (g.__s) return; g.__s = true; const s0 = performance.now();
    const tk = () => { const t = (performance.now() - s0) / 650; a.rotation = Math.min(t, 1) * Math.PI * 2; if (t < 1) requestAnimationFrame(tk); else { a.rotation = 0; g.__s = false; } };
    requestAnimationFrame(tk);
  };
  g._idle = null;
  g._setIdle = (on) => {
    // WCAG 2.3.3 — honour prefers-reduced-motion: show a STATIC "ready" glow
    // instead of the breathing pulse.
    const reduce = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (g._idle) { g._idle.kill(); g._idle = null; }
    if (!on) {
      if (typeof window !== 'undefined' && window.gsap) window.gsap.to(glow, { alpha: 0, duration: 0.25 });
      else glow.alpha = 0;
      return;
    }
    if (reduce || typeof window === 'undefined' || !window.gsap) {
      glow.alpha = 0.5; glow.scale.set(1);   // static ready-glow, no motion
      return;
    }
    glow.alpha = 0.28; glow.scale.set(0.95);
    g._idle = window.gsap.timeline({ repeat: -1, yoyo: true })
      .to(glow, { alpha: 0.62, duration: 1.7, ease: 'sine.inOut' }, 0)
      .to(glow.scale, { x: 1.05, y: 1.05, duration: 1.7, ease: 'sine.inOut' }, 0);
  };
  return g;
}
