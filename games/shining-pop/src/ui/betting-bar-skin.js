/* ============================================================================
   ARTEST | BrainRocket — STUDIO BETTING-PANEL SKIN  (PixiJS v8)
   ----------------------------------------------------------------------------
   The single visual source of truth for the studio betting bar, ported 1:1
   from the delivered BettingBarMobile spec (gold / Inter, design space 540x684).

   This module is PURE PRESENTATION. It exposes the delivered panel's palette,
   gold gradient system and element drawers so a host game can reproduce the
   exact panel look at its OWN computed positions — keeping the game's
   responsive layout + all its spin/bet/state wiring intact (the "conform in
   place" integration chosen for SHINING POP).

   Usage:
     import { makeSkin, BAR } from '../ui/betting-bar-skin.js';
     const skin = makeSkin(PIXI);            // build once (gradients cached)
     skin.panelInto(g, x, y, w, h, r);       // draw a gold panel into Graphics g
     skin.bannerInto(g, x, y, w, h);         // stadium LAST WIN / TOTAL BET banner
     skin.stepperInto(g, x, y, w, h);        // bet stepper pill + dividers
     skin.circleInto(g, cx, cy, r);          // autoplay / turbo circle button
     const face = skin.buildSpinFace(70);    // hero SPIN ring+center+arrow Container
   ============================================================================ */

// Delivered-panel palette (exact hex from the spec). Single source of truth so
// every game reads the same tokens.
export const BAR = {
  // gradient stop-lists  [offset, cssColor]
  GRAD: {
    stage:  [[0, '#15120b'], [0.7, '#0c0906'], [1, '#070503']],
    panel:  [[0, '#2d2822'], [0.5, '#1e1914'], [1, '#120e09']],
    banner: [[0, '#19130c'], [0.5, '#2a2317'], [1, '#19130c']],
    active: [[0, '#fadf8e'], [0.45, '#e9bf5a'], [1, '#ba852d']],
    ring:   [[0, '#fbe9aa'], [0.34, '#e2ba5e'], [0.66, '#ad7c2f'], [1, '#5c3d17']],
    spin:   [[0, '#2c261e'], [0.6, '#16120d'], [1, '#0a0806']],
    gold:   [[0, 'rgba(214,173,72,0)'], [0.5, 'rgba(236,198,101,0.7)'], [1, 'rgba(214,173,72,0)']],
  },
  // solid colors + their role
  label:      0xd6ab46, // gold caption text (LAST WIN / TOTAL BET / BALANCE / BET)
  value:      0xf6f1e6, // primary value text
  cur:        0x9a8d6f, // currency unit + DEMO + disabled text
  icon:       0xf1e9d7, // sound / menu / stepper +/- glyph stroke
  edge:       0xb88e40, // gold panel edge
  divider:    0xcaa24a, // internal hairline dividers (low alpha)
  ringInner:  0xfff1ca, // spin ring inner highlight stroke
  centerRim:  0xffeec2, // spin center rim stroke
  gloss:      0xffffff, // top-gloss highlight (low alpha)
  activeEdge: 0x80591c, // dark gold edge on active glyphs (autoplay/turbo)
  spinGlow:   0xe8b94a, // soft glow disc behind SPIN
  dark:       0x2c1d07, // dark text on a gold (active) fill
  // Inter first; graceful fallbacks if Inter isn't bundled yet (glyph shapes
  // differ only — spacing is measured at runtime so layout is unaffected).
  FONT: "Inter, 'Helvetica Neue', 'Segoe UI', Arial, sans-serif",
};

export function makeSkin(PIXI) {
  // ── Gradient factory (cached). v8 FillGradient, textureSpace:'local' so one
  // gradient maps to the bounds of whatever shape it fills, at any position. ──
  const cache = new Map();
  const lin = (key, stops, horiz) => {
    const k = 'L:' + key + (horiz ? ':h' : ':v');
    let g = cache.get(k);
    if (!g) {
      g = new PIXI.FillGradient({
        type: 'linear',
        start: { x: 0, y: 0 },
        end: horiz ? { x: 1, y: 0 } : { x: 0, y: 1 },
        colorStops: stops.map((s) => ({ offset: s[0], color: s[1] })),
        textureSpace: 'local',
      });
      cache.set(k, g);
    }
    return g;
  };
  const rad = (key, stops, cx, cy) => {
    const k = 'R:' + key;
    let g = cache.get(k);
    if (!g) {
      g = new PIXI.FillGradient({
        type: 'radial',
        center: { x: cx, y: cy }, innerRadius: 0,
        outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.62,
        colorStops: stops.map((s) => ({ offset: s[0], color: s[1] })),
        textureSpace: 'local',
      });
      cache.set(k, g);
    }
    return g;
  };

  const G = BAR.GRAD;

  // ── ELEMENT DRAWERS — draw the delivered panel's shapes into Graphics `g`
  // at absolute (x,y). Edge/inner-highlight proportions match the spec. ──

  // Gold panel: gradient body (vertical) + gold edge + inner white highlight.
  function panelInto(g, x, y, w, h, r, opts) {
    opts = opts || {};
    const ew = opts.edge != null ? opts.edge : 1.8;
    g.roundRect(x, y, w, h, r).fill(lin('panel', G.panel, false));
    if (ew) g.roundRect(x + ew / 2, y + ew / 2, w - ew, h - ew, Math.max(0, r - ew / 2))
      .stroke({ width: ew, color: BAR.edge, alpha: 1 });
    if (opts.inner !== false)
      g.roundRect(x + 2, y + 2, w - 4, h - 4, Math.max(0, r - 2))
        .stroke({ width: 1.2, color: BAR.gloss, alpha: 0.06 });
  }

  // Stadium banner (LAST WIN / TOTAL BET): horizontal banner gradient, full
  // stadium radius, gold edge.
  function bannerInto(g, x, y, w, h) {
    const r = h / 2;
    g.roundRect(x, y, w, h, r).fill(lin('banner', G.banner, true));
    g.roundRect(x + 0.9, y + 0.9, w - 1.8, h - 1.8, r - 0.9)
      .stroke({ width: 1.8, color: BAR.edge, alpha: 1 });
    g.roundRect(x + 2, y + 2, w - 4, h - 4, r - 2)
      .stroke({ width: 1.2, color: BAR.gloss, alpha: 0.06 });
  }

  // Bottom balance bar: gold panel (lower edge weight + inner highlight).
  function balanceBarInto(g, x, y, w, h, r) {
    panelInto(g, x, y, w, h, r != null ? r : h / 2, { edge: 1.8 });
  }

  // Bet stepper pill: gold panel + two vertical hairline dividers splitting it
  // into  [-] | value | [+]  (dividers at the spec's proportional thirds).
  function stepperInto(g, x, y, w, h) {
    panelInto(g, x, y, w, h, h / 2, { edge: 1.8 });
    // spec dividers at design x 237 & 303 within a 170-origin 200-wide pill →
    // proportional 0.335 and 0.665 of the width.
    [0.335, 0.665].forEach((p) => {
      const dx = x + w * p;
      g.moveTo(dx, y + h * 0.13).lineTo(dx, y + h * 0.87)
        .stroke({ width: 1.3, color: BAR.divider, alpha: 0.28 });
    });
  }

  // Circle button base (autoplay / turbo): gold panel circle + gold edge.
  function circleInto(g, cx, cy, r) {
    g.circle(cx, cy, r).fill(lin('panel', G.panel, false));
    g.circle(cx, cy, r).stroke({ width: 1.8, color: BAR.edge, alpha: 1 });
  }

  // Thin gold accent divider line (the panel's signature top hairline).
  function goldLineInto(g, x, y, w, thickness) {
    g.rect(x, y, w, thickness || 1.3).fill(lin('gold', G.gold, true));
  }

  // Soft glow disc behind SPIN (low-alpha warm gold; host may blur it).
  function spinGlowInto(g, cx, cy, r) {
    g.circle(cx, cy, r).fill({ color: BAR.spinGlow, alpha: 0.12 });
  }

  // ── HERO SPIN FACE — ring + center + circular arrow, built as a Container so
  // the host can rotate the arrow and add it once (matches the spec geometry,
  // proportions scaled from R). Returns { face, arrow, setStop(bool) }. ──
  function buildSpinFace(R) {
    const face = new PIXI.Container();
    const inner = R * 0.7857;

    // Outer ring (diagonal ring gradient) + inner highlight stroke.
    const ring = new PIXI.Graphics();
    ring.circle(0, 0, R).fill(lin('ring', G.ring, false));
    ring.circle(0, 0, R - 1).stroke({ width: R * 0.057, color: BAR.ringInner, alpha: 0.6 });
    face.addChild(ring);

    // Inner disc (radial spin gradient, off-center highlight) + rim + gloss.
    const center = new PIXI.Graphics();
    center.circle(0, 0, inner).fill(rad('spin', G.spin, 0.4, 0.34));
    center.circle(0, 0, inner).stroke({ width: R * 0.031, color: BAR.centerRim, alpha: 0.4 });
    center.ellipse(-R * 0.23, -R * 0.26, R * 0.49 / 2, R * 0.21 / 2)
      .fill({ color: BAR.gloss, alpha: 0.07 });
    face.addChild(center);

    // Circular arrow glyph (drawn as its own rotatable container).
    const arrow = new PIXI.Container();
    const ar = R * 0.4;
    const a = new PIXI.Graphics();
    a.arc(0, 0, ar, -1.206, -1.936 + 2 * Math.PI)
      .stroke({ width: R * 0.107, color: BAR.value, cap: 'round' });
    const tip = ar + R * 0.02;
    a.moveTo(0, -tip - R * 0.03)
      .lineTo(-R * 0.114, -ar + R * 0.06)
      .lineTo(-R * 0.171, -tip - R * 0.07)
      .fill(BAR.value);
    arrow.addChild(a);
    face.addChild(arrow);

    return { face, arrow };
  }

  // ── ACTIVE GLYPHS (autoplay triangle / turbo bolt) in the gold active
  // gradient with a dark gold edge. Returned as Graphics to add into a button. ──
  function buildAutoGlyph(scale) {
    const s = scale || 1;
    const g = new PIXI.Graphics();
    g.poly([12 * s, 0, -6 * s, -10 * s, -6 * s, 10 * s]).fill(lin('active', G.active, false));
    g.poly([12 * s, 0, -6 * s, -10 * s, -6 * s, 10 * s]).stroke({ width: 1, color: BAR.activeEdge, alpha: 0.9 });
    return g;
  }
  function buildTurboGlyph(scale) {
    const s = scale || 1;
    const pts = [4, -12, -9, 3, -1, 3, -5, 14, 8, -2, 0, -2].map((v) => v * s);
    const g = new PIXI.Graphics();
    g.poly(pts).fill(lin('active', G.active, false));
    g.poly(pts).stroke({ width: 1, color: BAR.activeEdge, alpha: 0.9 });
    return g;
  }

  // ── TEXT FACTORY — Inter (with fallback), panel weights/colors. ──
  function text(str, size, color, weight, letterSpacing) {
    const t = new PIXI.Text({
      text: str,
      style: {
        fontFamily: BAR.FONT,
        fontSize: size,
        fontWeight: String(weight || 700),
        fill: color,
        letterSpacing: letterSpacing || 0,
      },
    });
    t.resolution = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 3);
    return t;
  }

  return {
    BAR,
    grad: { lin, rad },
    panelInto, bannerInto, balanceBarInto, stepperInto, circleInto,
    goldLineInto, spinGlowInto, buildSpinFace, buildAutoGlyph, buildTurboGlyph, text,
  };
}
