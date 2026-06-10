/* ============================================================================
   ARTEST | BrainRocket — BettingBarMobile  (PixiJS v8)
   ----------------------------------------------------------------------------
   A faithful v8 port of the DELIVERED `BettingBarMobile.pixi.js` betting panel,
   used as THE bar in every game. Design space 540x684 portrait. Same public API
   + events, so it is a drop-in:

     const bar = new BettingBarMobile({ bare:true });  // bare = no stage bg/scrim
     host.addChild(bar);  bar.fitBottom(viewW, viewH); // dock to screen bottom
     bar.setBalance(10000000); bar.setBet(50); bar.setLastWin(200000000);
     bar.on2('spin', ()=>startSpin());  bar.on2('bet:inc', ...); ...

   Events: spin · bet:inc · bet:dec · betmenu · autoplay · turbo · sound · menu
   Game-state extensions: setSpinning, setAutoplay, setTurbo, setAffordable,
   setSteppers, setDemo.

   RENDERING: v8 FillGradient (VECTOR) — crisp borders at any DPR, no masked
   gradient-sprites (the old blur source on retina/iPhone), no DropShadow/Blur
   filters (expensive on mobile; depth comes from inner gloss + the dark scrim).
   ============================================================================ */
import * as PIXI from 'pixi.js';

const DPR = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 3);

// CANDY / cotton-candy theme (2026-06-10 master pass) — brighter glossy
// grape-violet with candy-pink + cyan accents to MATCH Shining Pop (was a dark
// crystal skin that clashed with the candy game). Mirrors betting-bar-skin.js.
const G = {
  stage: [[0, '#241652'], [0.7, '#120b2e'], [1, '#08051c']],
  panel: [[0, '#46297a'], [0.5, '#2e1c58'], [1, '#19103e']],
  banner: [[0, '#1c1346'], [0.5, '#34206a'], [1, '#1c1346']],
  active: [[0, '#ffd9f4'], [0.45, '#ff5ab0'], [1, '#bf2496']],
  ring: [[0, '#ffe8fb'], [0.34, '#ff7ad0'], [0.66, '#9a4fcf'], [1, '#3e2076']],
  spin: [[0, '#34225e'], [0.6, '#1a1138'], [1, '#0c0826']],
  divider: [[0, 'rgba(255,122,208,0)'], [0.5, 'rgba(255,122,208,0.85)'], [1, 'rgba(255,122,208,0)']],
  glow: [[0, 'rgba(255,74,216,0.24)'], [0.55, 'rgba(255,74,216,0.09)'], [1, 'rgba(255,74,216,0)']],
};
// Value + icons stay WHITE-SMOKE (user: kill purple text); edge -> candy pink,
// labels warmer, plus a cyan candy-glass rim.
const COL = { edge: 0xff7ad0, label: 0xe9d6f5, value: 0xfdf2ff, cur: 0xeaddf8, icon: 0xfdf2ff, divider: 0xcf78e0, gloss: 0xffffff, cyan: 0xbfe8ff };
const FS = 1.1;   // global type-scale bump (user: "bigger all texts")
const FONT = "Inter, 'Helvetica Neue', 'Segoe UI', Arial, sans-serif";

// ── VECTOR gradients (FillGradient) — crisp at any scale, no mask blur ──
function fg(stops, dir) {
  const end = dir === 'h' ? { x: 1, y: 0 } : dir === 'd' ? { x: 1, y: 1 } : { x: 0, y: 1 };
  return new PIXI.FillGradient({
    type: 'linear', start: { x: 0, y: 0 }, end,
    colorStops: stops.map((s) => ({ offset: s[0], color: s[1] })), textureSpace: 'local',
  });
}
function fgRad(stops, cx, cy) {
  return new PIXI.FillGradient({
    type: 'radial', center: { x: cx, y: cy }, innerRadius: 0,
    outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.6,
    colorStops: stops.map((s) => ({ offset: s[0], color: s[1] })), textureSpace: 'local',
  });
}
function panel(w, h, rx, fill, ew, horiz, inRx) {
  const g = new PIXI.Graphics();
  g.roundRect(0, 0, w, h, rx).fill(fg(fill, horiz ? 'h' : 'v'));
  // glassy candy top-sheen — soft white highlight over the upper ~42% reads as a
  // glossy hard-candy surface (the old flat 0.06 inner stroke read cheap).
  g.roundRect(2.5, 2, w - 5, h * 0.42, Math.max(0, rx - 2)).fill({ color: COL.gloss, alpha: 0.12 });
  if (inRx !== undefined) g.roundRect(2, 2, w - 4, h - 4, inRx).stroke({ width: 1.1, color: COL.cyan, alpha: 0.15 });
  if (ew) g.roundRect(ew / 2, ew / 2, w - ew, h - ew, Math.max(0, rx - ew / 2)).stroke({ width: ew, color: COL.edge });
  return g;
}
function cbase(r, fill, sc, sw) {
  const g = new PIXI.Graphics();
  g.circle(0, 0, r).fill(fg(fill, 'v'));
  // glassy candy top-sheen (upper-left highlight) → glossy button
  g.ellipse(-r * 0.18, -r * 0.34, r * 0.62, r * 0.4).fill({ color: COL.gloss, alpha: 0.12 });
  if (sw) {
    // inset strokes (no edge bleed) → crisper border: candy rim + cyan glass inner
    g.circle(0, 0, r - sw * 0.5).stroke({ width: sw, color: sc != null ? sc : COL.edge, alpha: 0.92 });
    g.circle(0, 0, r - sw - 0.5).stroke({ width: 1, color: COL.cyan, alpha: 0.13 });
  }
  return g;
}
function T(t, sz, col, w, ax, mid, ls) {
  const o = new PIXI.Text({ text: t, style: { fontFamily: FONT, fontSize: Math.round(sz * FS), fontWeight: String(w || 700), fill: col, letterSpacing: ls || 0 } });
  o.resolution = Math.max(2, DPR); o.anchor.set(ax || 0, mid ? 0.5 : 0); return o;
}
function hit(c, h, fn) {
  c.eventMode = 'static'; c.cursor = 'pointer'; c.hitArea = h; let d = false;
  c.on('pointerdown', () => { d = true; c.scale.set(0.95); });
  const u = () => { if (!d) return; d = false; c.scale.set(1); };
  c.on('pointerup', () => { u(); fn && fn(); });
  c.on('pointerupoutside', u);
  return c;
}

export class BettingBarMobile extends PIXI.Container {
  constructor(opts) {
    super();
    opts = opts || {};
    this.DESIGN_W = 540; this.DESIGN_H = 684;
    this._bare = !!opts.bare; // skip the full stage bg + scrim (overlay mode)
    this._cbs = {};
    this._build();
  }
  on2(ev, cb) { (this._cbs[ev] = this._cbs[ev] || []).push(cb); return this; }
  _emit(ev) { (this._cbs[ev] || []).forEach((cb) => { try { cb(); } catch (e) { /* host handles */ } }); }

  _siblingPanel(w, h, label, value) {
    const c = new PIXI.Container();
    c.addChild(panel(w, h, h / 2, G.banner, 1.8, true, h / 2 - 2));
    const l = T(label, 13, COL.label, 700, 0, true, 1.5);
    const v = T(value, 17, COL.value, 700, 0, true);
    c.relayout = () => {
      v.scale.set(1);
      const maxV = w - 20 - l.width - 10;            // keep label + value inside the banner
      if (v.width > maxV && maxV > 10) v.scale.set(maxV / v.width);
      const tot = l.width + 10 + v.width;
      l.position.set(w / 2 - tot / 2, h / 2); v.position.set(w / 2 - tot / 2 + l.width + 10, h / 2);
    };
    c.addChild(l, v); c.label = l; c.value = v; c.relayout(); return c;
  }
  _spin(cx, cy, R) {
    const g = new PIXI.Container(); g.position.set(cx, cy); const inner = R * 0.7857;
    const base = new PIXI.Graphics();
    base.circle(0, 0, R).fill(fg(G.ring, 'd'));
    base.circle(0, 0, R - 1).stroke({ width: R * 0.057, color: COL.value, alpha: 0.6 });
    base.circle(0, 0, inner).fill(fgRad(G.spin, 0.4, 0.34));
    base.circle(0, 0, inner).stroke({ width: R * 0.031, color: 0xe8d0ff, alpha: 0.4 });
    base.ellipse(-R * 0.23, -R * 0.26, R * 0.49 / 2, R * 0.21 / 2).fill({ color: COL.gloss, alpha: 0.07 });
    g.addChild(base);
    // rotatable arrow (shown in idle/spin) + a stop square (shown while spinning)
    const a = new PIXI.Container(); const ar = R * 0.4;
    a.addChild(new PIXI.Graphics().arc(0, 0, ar, -1.206, -1.936 + 2 * Math.PI).stroke({ width: R * 0.107, color: COL.value, cap: 'round' }));
    const tip = ar + R * 0.02;
    a.addChild(new PIXI.Graphics().moveTo(0, -tip - R * 0.03).lineTo(-R * 0.114, -ar + R * 0.06).lineTo(-R * 0.171, -tip - R * 0.07).fill(COL.value));
    g.addChild(a);
    const stop = new PIXI.Graphics().roundRect(-R * 0.26, -R * 0.26, R * 0.52, R * 0.52, R * 0.12).fill({ color: COL.value, alpha: 0.98 }).stroke({ color: 0x8a2bc0, width: R * 0.03, alpha: 0.9 });
    stop.visible = false; g.addChild(stop);
    g._arrow = a; g._stop = stop;
    g.spin = () => {
      if (g.__s) return; g.__s = true; const s = performance.now();
      const tk = () => { const t = (performance.now() - s) / 700; a.rotation = Math.min(t, 1) * Math.PI * 2; if (t < 1) requestAnimationFrame(tk); else { a.rotation = 0; g.__s = false; } };
      requestAnimationFrame(tk);
    };
    return g;
  }
  _build() {
    const E = {}; this.elements = E;
    if (!this._bare) {
      this.addChild(new PIXI.Graphics().rect(0, 0, 540, 684).fill(fg(G.stage, 'v')));
      this.addChild(new PIXI.Graphics().rect(0, 300, 540, 384).fill({ color: 0x000000, alpha: 0.12 }));
    }
    this.addChild(new PIXI.Graphics().rect(0, 299.5, 540, 1.4).fill(fg(G.divider, 'h')));
    // soft hero glow under the spin — radial FillGradient (no blur filter)
    this.addChild(new PIXI.Graphics().circle(270, 392, 116).fill(fgRad(G.glow, 0.5, 0.5)));

    const lw = this._siblingPanel(200, 46, 'LAST WIN', '0.00'); lw.position.set(60, 210); this.addChild(lw); E.lastWinPanel = lw;
    const tb = this._siblingPanel(200, 46, 'TOTAL BET', '0'); tb.position.set(280, 210); this.addChild(tb); E.totalBetPanel = tb;

    const demo = new PIXI.Container(); demo.position.set(210, 272); demo.addChild(panel(120, 24, 12, G.panel, 1.1, false));
    const dt = T('DEMO MODE', 11, COL.cur, 700, 0.5, true, 2.5); dt.position.set(60, 12); demo.addChild(dt); demo.visible = false; this.addChild(demo); E.demoBadge = demo;

    const spin = this._spin(270, 392, 70); hit(spin, new PIXI.Circle(0, 0, 70), () => { if (!spin._stop.visible) spin.spin(); this._emit('spin'); }); this.addChild(spin); E.spinButton = spin;

    // autoplay button (+ count overlay for running state)
    const au = new PIXI.Container(); au.position.set(104, 506); au.addChild(cbase(30, G.panel, COL.edge, 1.8));
    const at = new PIXI.Graphics().poly([12, 0, -6, -10, -6, 10]).fill(fg(G.active, 'v')); au.addChild(at);
    const aCount = T('', 17, COL.value, 700, 0.5, true); aCount.visible = false; au.addChild(aCount);
    hit(au, new PIXI.Circle(0, 0, 30), () => this._emit('autoplay')); this.addChild(au); E.autoplayButton = au; au._glyph = at; au._count = aCount;

    // stepper pill  [-] value [+]
    const st = new PIXI.Container(); st.position.set(170, 479); st.addChild(panel(200, 54, 27, G.panel, 1.8, false, 25));
    [237, 303].forEach((x) => st.addChild(new PIXI.Graphics().moveTo(x - 170, 7).lineTo(x - 170, 47).stroke({ width: 1.3, color: COL.divider, alpha: 0.28 })));
    const mi = new PIXI.Container(); mi.addChild(new PIXI.Graphics().moveTo(19, 27).lineTo(47, 27).stroke({ width: 3, color: COL.icon, cap: 'round' }));
    const sv = T('0', 24, COL.value, 700, 0.5, true); sv.position.set(100, 27);
    const pi = new PIXI.Container(); pi.addChild(new PIXI.Graphics().moveTo(167, 13).lineTo(167, 41).moveTo(153, 27).lineTo(181, 27).stroke({ width: 3, color: COL.icon, cap: 'round' }));
    st.addChild(mi, sv, pi);
    mi.eventMode = 'static'; mi.cursor = 'pointer'; mi.hitArea = new PIXI.Rectangle(-3, -15, 70, 54);
    pi.eventMode = 'static'; pi.cursor = 'pointer'; pi.hitArea = new PIXI.Rectangle(133, -15, 70, 54);
    mi.on('pointertap', () => this._emit('bet:dec')); pi.on('pointertap', () => this._emit('bet:inc'));
    // tapping the value opens the bet menu (intuitive shortcut)
    sv.eventMode = 'static'; sv.cursor = 'pointer'; sv.hitArea = new PIXI.Rectangle(-30, -16, 60, 32); sv.on('pointertap', () => this._emit('betmenu'));
    st.minus = mi; st.plus = pi; st.value = sv; this.addChild(st); E.betStepper = st;

    // turbo button
    const tbtn = new PIXI.Container(); tbtn.position.set(436, 506); tbtn.addChild(cbase(30, G.panel, COL.edge, 1.8));
    const tbB = new PIXI.Graphics().poly([4, -12, -9, 3, -1, 3, -5, 14, 8, -2, 0, -2]).fill(fg(G.active, 'v')); tbtn.addChild(tbB);
    const tPip = new PIXI.Graphics(); tPip.visible = false; tbtn.addChild(tPip);
    hit(tbtn, new PIXI.Circle(0, 0, 30), () => this._emit('turbo')); this.addChild(tbtn); E.turboButton = tbtn; tbtn._glyph = tbB; tbtn._pip = tPip;

    // bottom balance bar (+ sound + menu)
    const bb = new PIXI.Container(); bb.position.set(14, 560); bb.addChild(panel(512, 44, 22, G.panel, 1.8, false, 20));
    const blbl = T('BALANCE', 13, COL.label, 700, 0, true, 1.2); blbl.position.set(22, 22);
    const bval = T('0', 15, COL.value, 700, 0, true);
    const bcur = T('USD', 11, COL.cur, 600, 0, true);
    const betlbl = T('BET', 12, COL.label, 700, 0, true, 1.2);
    const betval = T('0', 15, COL.value, 700, 0, true);
    bb.relayout = () => {
      bval.scale.set(1); betval.scale.set(1);              // scale-to-fit so long values don't crush
      if (bval.width > 120) bval.scale.set(120 / bval.width);
      bval.position.set(22 + blbl.width + 8, 22);
      bcur.position.set(22 + blbl.width + 8 + bval.width + 5, 22);
      if (betval.width > 90) betval.scale.set(90 / betval.width);
      const tot = betlbl.width + 7 + betval.width, cx = 256;
      betlbl.position.set(cx - tot / 2, 22); betval.position.set(cx - tot / 2 + betlbl.width + 7, 22);
    };
    bb.addChild(blbl, bval, bcur, betlbl, betval); bb.relayout();
    bb.addChild(new PIXI.Graphics().moveTo(430, 8).lineTo(430, 36).stroke({ width: 1.2, color: COL.divider, alpha: 0.3 }));
    const snd = new PIXI.Graphics()
      .moveTo(448, 17).lineTo(453, 17).lineTo(459, 12).lineTo(459, 32).lineTo(453, 27).lineTo(448, 27).fill(COL.icon);
    snd.arc(458.39, 22, 7, -1.0297, 1.0297).stroke({ width: 2, color: COL.icon, cap: 'round' });
    snd.moveTo(466, 12).arc(459.37, 22, 12, -0.9851, 0.9851).stroke({ width: 2, color: COL.icon, cap: 'round' });
    const sndSlash = new PIXI.Graphics().moveTo(446, 9).lineTo(473, 35).stroke({ width: 2.6, color: 0xff5ab0, cap: 'round' }); sndSlash.visible = false;
    const sB = new PIXI.Container(); sB.addChild(snd, sndSlash); sB.eventMode = 'static'; sB.cursor = 'pointer'; sB.hitArea = new PIXI.Rectangle(444, 6, 34, 32); sB.on('pointertap', () => this._emit('sound')); bb.addChild(sB); sB._slash = sndSlash;
    const mn = new PIXI.Graphics(); [16, 22, 28].forEach((y) => mn.moveTo(478, y).lineTo(500, y)); mn.stroke({ width: 2.6, color: COL.icon, cap: 'round' });
    const mB = new PIXI.Container(); mB.addChild(mn); mB.eventMode = 'static'; mB.cursor = 'pointer'; mB.hitArea = new PIXI.Rectangle(472, 6, 36, 32); mB.on('pointertap', () => this._emit('menu')); bb.addChild(mB);
    bb.balanceLabel = blbl; bb.balanceValue = bval; bb.balanceCurrency = bcur; bb.betLabel = betlbl; bb.betValue = betval; bb.soundButton = sB; bb.menuButton = mB;
    this.addChild(bb); E.balanceBar = bb;
  }

  // contain-fit + center (the delivered behavior)
  fit(W, H) {
    const s = Math.min(W / this.DESIGN_W, H / this.DESIGN_H);
    this.scale.set(s);
    this.position.set((W - this.DESIGN_W * s) / 2, (H - this.DESIGN_H * s) / 2);
    return s;
  }
  // Dock the bar COMPACTLY to the screen bottom. Only the visible control BAND
  // (banners → balance bar) is docked flush at the bottom; the panel's empty
  // top/bottom design margins are excluded. The band height is capped to a
  // fraction of the viewport so the REELS stay the biggest element. Returns
  // barTopY for the reel clamp.
  fitBottom(W, H, opts) {
    opts = opts || {};
    const BAND_TOP = 192, BAND_BOT = 606, band = BAND_BOT - BAND_TOP; // visible bar band (design units)
    const safeB = opts.safeBottom || 0;
    const maxBarH = (opts.maxFrac || 0.40) * H;       // bar ≤ 40% of height → reels dominate
    let s = Math.min(W / this.DESIGN_W, maxBarH / band);
    if (opts.maxScale) s = Math.min(s, opts.maxScale);
    this.scale.set(s);
    const bandBottom = H - safeB - 6;                  // flush to the bottom (small gutter)
    this.position.set((W - this.DESIGN_W * s) / 2, bandBottom - BAND_BOT * s);
    return { scale: s, barTopY: this.y + BAND_TOP * s, barH: band * s };
  }

  _fmt(n) { return Number(n).toLocaleString('en-US'); }
  setBalance(n) { const b = this.elements.balanceBar; b.balanceValue.text = this._fmt(n); b.relayout(); }
  setCurrency(c) { const b = this.elements.balanceBar; b.balanceCurrency.text = c; b.relayout(); }
  setLastWin(n) { const p = this.elements.lastWinPanel; p.value.text = this._fmt(n); p.relayout(); }
  setBet(n) {
    const v = this._fmt(n);
    this.elements.betStepper.value.text = v;
    const t = this.elements.totalBetPanel; t.value.text = v; t.relayout();
    const b = this.elements.balanceBar; b.betValue.text = v; b.relayout();
  }
  setDemo(on) { this.elements.demoBadge.visible = !!on; }
  setSoundOn(on) { const sb = this.elements.balanceBar.soundButton; sb.alpha = on ? 1 : 0.62; if (sb._slash) sb._slash.visible = !on; }

  // ── game-state extensions ────────────────────────────────────────────────
  setSpinning(on) { const s = this.elements.spinButton; s._arrow.visible = !on; s._stop.visible = !!on; }
  setAutoplay(count) {
    const au = this.elements.autoplayButton;
    const active = count != null && count !== false;
    au._count.text = (count === Infinity || count === 0) ? '∞' : String(count);
    au._count.visible = active; au._glyph.visible = !active;
  }
  setTurbo(mode) {
    const t = this.elements.turboButton;
    t._glyph.alpha = mode > 0 ? 1 : 0.45;
    t._pip.clear();
    if (mode === 2) { t._pip.circle(13, -13, 4).fill(0xdb5fd8).circle(13, -13, 5.4).stroke({ width: 1, color: 0x000000, alpha: 0.4 }); t._pip.visible = true; }
    else t._pip.visible = false;
  }
  setAffordable(on) { this.elements.spinButton.alpha = on ? 1 : 0.5; }
  setSteppers(minusOn, plusOn) { this.elements.betStepper.minus.alpha = minusOn ? 1 : 0.4; this.elements.betStepper.plus.alpha = plusOn ? 1 : 0.4; }
}
