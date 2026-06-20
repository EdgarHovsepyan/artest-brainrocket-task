


export const BAR = {

  

  
  GRAD: {
    stage:  [[0, '#241652'], [0.7, '#120b2e'], [1, '#08051c']],
    panel:  [[0, '#46297a'], [0.5, '#2e1c58'], [1, '#19103e']],   
    banner: [[0, '#1c1346'], [0.5, '#34206a'], [1, '#1c1346']],
    active: [[0, '#ffd9f4'], [0.45, '#ff5ab0'], [1, '#bf2496']],   
    ring:   [[0, '#ffe8fb'], [0.34, '#ff7ad0'], [0.66, '#9a4fcf'], [1, '#3e2076']],
    spin:   [[0, '#34225e'], [0.6, '#1a1138'], [1, '#0c0826']],
    gold:   [[0, 'rgba(255,122,208,0)'], [0.5, 'rgba(255,122,208,0.85)'], [1, 'rgba(255,122,208,0)']],
  },
  
  label:      0xeeb6e8, 
  value:      0xfdf2ff, 
  cur:        0xae97d2, 
  icon:       0xf6e8ff, 
  edge:       0xff7ad0, 
  divider:    0xcf78e0, 
  ringInner:  0xffe4fb, 
  centerRim:  0xffd6f4, 
  gloss:      0xffffff, 
  cyan:       0xffe0f4,
  activeEdge: 0x6e1f56, 
  spinGlow:   0xff4ad8, 
  dark:       0x24082c, 

  FONT: "Fredoka, 'Helvetica Neue', 'Segoe UI', Arial, sans-serif",
};

export function makeSkin(PIXI) {

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



  
  function panelInto(g, x, y, w, h, r, opts) {
    opts = opts || {};
    const ew = opts.edge != null ? opts.edge : 1.8;
    g.roundRect(x, y, w, h, r).fill(lin('panel', G.panel, false));

    g.roundRect(x + 2.5, y + 2, w - 5, h * 0.42, Math.max(0, r - 2)).fill({ color: BAR.gloss, alpha: 0.13 });
    if (ew) g.roundRect(x + ew / 2, y + ew / 2, w - ew, h - ew, Math.max(0, r - ew / 2))
      .stroke({ width: ew, color: BAR.edge, alpha: 1 });
    if (opts.inner !== false)
      g.roundRect(x + 2, y + 2, w - 4, h - 4, Math.max(0, r - 2))
        .stroke({ width: 1.3, color: BAR.cyan, alpha: 0.26 });
  }


  function bannerInto(g, x, y, w, h) {
    const r = h / 2;
    g.roundRect(x, y, w, h, r).fill(lin('banner', G.banner, true));
    g.roundRect(x + 2, y + 1.5, w - 4, h * 0.46, r - 1.5).fill({ color: BAR.gloss, alpha: 0.11 });   
    g.roundRect(x + 0.9, y + 0.9, w - 1.8, h - 1.8, r - 0.9)
      .stroke({ width: 1.8, color: BAR.edge, alpha: 1 });
    g.roundRect(x + 2, y + 2, w - 4, h - 4, r - 2)
      .stroke({ width: 1.1, color: BAR.cyan, alpha: 0.13 });
  }

  
  function balanceBarInto(g, x, y, w, h, r) {
    panelInto(g, x, y, w, h, r != null ? r : h / 2, { edge: 1.8 });
  }


  function stepperInto(g, x, y, w, h) {
    panelInto(g, x, y, w, h, h / 2, { edge: 1.8 });

    [0.335, 0.665].forEach((p) => {
      const dx = x + w * p;
      g.moveTo(dx, y + h * 0.13).lineTo(dx, y + h * 0.87)
        .stroke({ width: 1.3, color: BAR.divider, alpha: 0.28 });
    });
  }

  
  function circleInto(g, cx, cy, r) {
    g.circle(cx, cy, r).fill(lin('panel', G.panel, false));
    
    g.ellipse(cx - r * 0.18, cy - r * 0.34, r * 0.62, r * 0.4).fill({ color: BAR.gloss, alpha: 0.12 });
    g.circle(cx, cy, r - 1.4).stroke({ width: 1, color: BAR.cyan, alpha: 0.14 });
    g.circle(cx, cy, r).stroke({ width: 1.8, color: BAR.edge, alpha: 1 });
  }

  
  function goldLineInto(g, x, y, w, thickness) {
    g.rect(x, y, w, thickness || 1.3).fill(lin('gold', G.gold, true));
  }

  
  function spinGlowInto(g, cx, cy, r) {
    g.circle(cx, cy, r).fill({ color: BAR.spinGlow, alpha: 0.12 });
  }


  
  function buildSpinFace(R) {
    const face = new PIXI.Container();
    const inner = R * 0.7857;

    
    const ring = new PIXI.Graphics();
    ring.circle(0, 0, R).fill(lin('ring', G.ring, false));
    ring.circle(0, 0, R - 1).stroke({ width: R * 0.057, color: BAR.ringInner, alpha: 0.6 });
    face.addChild(ring);

    
    const center = new PIXI.Graphics();
    center.circle(0, 0, inner).fill(rad('spin', G.spin, 0.4, 0.34));
    center.circle(0, 0, inner).stroke({ width: R * 0.031, color: BAR.centerRim, alpha: 0.4 });
    center.ellipse(-R * 0.23, -R * 0.26, R * 0.49 / 2, R * 0.21 / 2)
      .fill({ color: BAR.gloss, alpha: 0.07 });
    face.addChild(center);

    
    const arrow = new PIXI.Container();
    // Twin circular-arrow spin glyph — two ~145° arms 180° apart, each with a
    // leading arrowhead (replaces the single reload-style arc).
    const ar = R * 0.40, lw = R * 0.098;
    const a = new PIXI.Graphics();
    const span = Math.PI * 0.80;
    const arm = (a0) => {
      const a1 = a0 + span;
      a.arc(0, 0, ar, a0, a1).stroke({ width: lw, color: BAR.value, cap: 'round' });
      const ex = ar * Math.cos(a1), ey = ar * Math.sin(a1);
      const tx = -Math.sin(a1), ty = Math.cos(a1);   // clockwise tangent (travel dir)
      const rx = Math.cos(a1),  ry = Math.sin(a1);   // radial (outward)
      const head = lw * 1.65, halfW = lw * 1.40;
      a.moveTo(ex + tx * head,  ey + ty * head)
        .lineTo(ex + rx * halfW, ey + ry * halfW)
        .lineTo(ex - rx * halfW, ey - ry * halfW)
        .fill(BAR.value);
    };
    arm(-0.30 * Math.PI);
    arm( 0.70 * Math.PI);
    arrow.addChild(a);
    face.addChild(arrow);

    return { face, arrow };
  }


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
