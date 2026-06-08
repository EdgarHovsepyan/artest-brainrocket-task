/* ============================================================================
   ARTEST | BrainRocket — BettingBarMobile  (PixiJS v8)
   ----------------------------------------------------------------------------
   A faithful v8 port of the DELIVERED `BettingBarMobile.pixi.js` (v7) from
   BETTING PANEL INFO.zip — the studio's betting panel, used as THE bar in
   every game. Design space 540x684 portrait. Same public API + events as the
   delivered file, so it is a drop-in:

     const bar = new BettingBarMobile({ bare:true });  // bare = no stage bg/scrim
     host.addChild(bar);  bar.fitBottom(viewW, viewH); // dock to screen bottom
     bar.setBalance(10000000); bar.setBet(50); bar.setLastWin(200000000);
     bar.on2('spin', ()=>startSpin());  bar.on2('bet:inc', ...); ...

   Events: spin · bet:inc · bet:dec · autoplay · turbo · sound · menu
   Game-state extensions (not in the delivered file, additive): setSpinning,
   setAutoplay, setTurbo, setAffordable, setSteppers.

   v7→v8 port notes: Graphics `.beginFill().draw*().endFill()` → `.shape().fill()`,
   `.lineStyle().draw*()` → `.shape().stroke()`, `PIXI.Text(t,style)` →
   `new PIXI.Text({text,style})`, `BlurFilter(9)` → `new BlurFilter({strength:9})`.
   DropShadowFilter (pixi-filters) is optional — degrades to no shadow.
   ============================================================================ */
import * as PIXI from 'pixi.js';

const DPR = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 3);
const DSF =
  (PIXI.filters && PIXI.filters.DropShadowFilter) ||
  (typeof window !== 'undefined' && window.__PIXI_FILTERS__ && window.__PIXI_FILTERS__.DropShadowFilter) ||
  null;

// Delivered gold palette (exact stop-lists from the zip).
const G = {
  stage: [[0, '#15120b'], [0.7, '#0c0906'], [1, '#070503']],
  panel: [[0, '#2d2822'], [0.5, '#1e1914'], [1, '#120e09']],
  banner: [[0, '#19130c'], [0.5, '#2a2317'], [1, '#19130c']],
  active: [[0, '#fadf8e'], [0.45, '#e9bf5a'], [1, '#ba852d']],
  ring: [[0, '#fbe9aa'], [0.34, '#e2ba5e'], [0.66, '#ad7c2f'], [1, '#5c3d17']],
  spin: [[0, '#2c261e'], [0.6, '#16120d'], [1, '#0a0806']],
  gold: [[0, 'rgba(214,173,72,0)'], [0.5, 'rgba(236,198,101,0.7)'], [1, 'rgba(214,173,72,0)']],
};
const FONT = "Inter, 'Helvetica Neue', 'Segoe UI', Arial, sans-serif";

function mkShadow(dy, blur, alpha) {
  if (!DSF) return null;
  try { return new DSF({ offset: { x: 0, y: dy }, blur, alpha, color: 0x000000, quality: 5 }); }
  catch (e) { return null; }
}
const fSh = () => mkShadow(3, 5, 0.5);
const fSpin = () => mkShadow(9, 14, 0.55);
const fSoft = () => new PIXI.BlurFilter({ strength: 9 });
const setF = (o, f) => { if (f) o.filters = [f]; return o; };

// canvas linear/radial gradient → Texture (faithful to the delivered approach)
function grad(w, h, stops, horiz) {
  const sw = Math.max(1, Math.ceil(w * DPR)), sh = Math.max(1, Math.ceil(h * DPR));
  const c = document.createElement('canvas'); c.width = sw; c.height = sh;
  const x = c.getContext('2d');
  const g = horiz ? x.createLinearGradient(0, 0, sw, 0) : x.createLinearGradient(0, 0, 0, sh);
  stops.forEach((s) => g.addColorStop(s[0], s[1]));
  x.fillStyle = g; x.fillRect(0, 0, sw, sh);
  return PIXI.Texture.from(c);
}
function radial(d, stops, cx, cy) {
  const sd = Math.ceil(d * DPR);
  const c = document.createElement('canvas'); c.width = c.height = sd;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(sd * cx, sd * cy, 0, sd * 0.5, sd * 0.5, sd * 0.55);
  stops.forEach((s) => g.addColorStop(s[0], s[1]));
  x.fillStyle = g; x.fillRect(0, 0, sd, sd);
  return PIXI.Texture.from(c);
}
function gs(w, h, stops, horiz) { const s = new PIXI.Sprite(grad(w, h, stops, horiz)); s.width = w; s.height = h; return s; }

function panel(w, h, rx, fill, ew, horiz, inRx) {
  const c = new PIXI.Container();
  const sp = gs(w, h, fill, horiz);
  const m = new PIXI.Graphics().roundRect(0, 0, w, h, rx).fill(0xffffff);
  sp.mask = m; c.addChild(sp, m);
  if (ew) c.addChild(new PIXI.Graphics().roundRect(ew / 2, ew / 2, w - ew, h - ew, rx - ew / 2).stroke({ width: ew, color: 0xb88e40 }));
  if (inRx !== undefined) c.addChild(new PIXI.Graphics().roundRect(2, 2, w - 4, h - 4, inRx).stroke({ width: 1.2, color: 0xffffff, alpha: 0.06 }));
  return c;
}
function cbase(r, fill, sc, sw) {
  const c = new PIXI.Container();
  const d = r * 2; const sp = gs(d, d, fill); sp.position.set(-r, -r);
  const m = new PIXI.Graphics().circle(0, 0, r).fill(0xffffff); sp.mask = m; c.addChild(sp, m);
  if (sw) c.addChild(new PIXI.Graphics().circle(0, 0, r).stroke({ width: sw, color: sc != null ? sc : 0xb88e40 }));
  return c;
}
function T(t, sz, col, w, ax, mid, ls) {
  const o = new PIXI.Text({ text: t, style: { fontFamily: FONT, fontSize: sz, fontWeight: String(w || 700), fill: col, letterSpacing: ls || 0 } });
  o.resolution = DPR; o.anchor.set(ax || 0, mid ? 0.5 : 0); return o;
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
    const p = panel(w, h, h / 2, G.banner, 1.8, true, h / 2 - 2); setF(p, fSh()); c.addChild(p);
    const l = T(label, 13, 0xd6ab46, 700, 0, true, 1.5);
    const v = T(value, 17, 0xf6f1e6, 700, 0, true);
    c.relayout = () => { const tot = l.width + 10 + v.width; l.position.set(w / 2 - tot / 2, h / 2); v.position.set(w / 2 - tot / 2 + l.width + 10, h / 2); };
    c.addChild(l, v); c.label = l; c.value = v; c.relayout(); return c;
  }
  _spin(cx, cy, R) {
    const g = new PIXI.Container(); g.position.set(cx, cy); const inner = R * 0.7857;
    const rs = gs(R * 2, R * 2, G.ring, true); rs.position.set(-R, -R);
    const rm = new PIXI.Graphics().circle(0, 0, R).fill(0xffffff); rs.mask = rm; g.addChild(rs, rm);
    g.addChild(new PIXI.Graphics().circle(0, 0, R - 1).stroke({ width: R * 0.057, color: 0xfff1ca, alpha: 0.6 }));
    const ct = new PIXI.Sprite(radial(inner * 2, G.spin, 0.4, 0.34)); ct.anchor.set(0.5);
    const cm = new PIXI.Graphics().circle(0, 0, inner).fill(0xffffff); ct.mask = cm; g.addChild(ct, cm);
    g.addChild(new PIXI.Graphics().circle(0, 0, inner).stroke({ width: R * 0.031, color: 0xffeec2, alpha: 0.4 }));
    g.addChild(new PIXI.Graphics().ellipse(-R * 0.23, -R * 0.26, R * 0.49 / 2, R * 0.21 / 2).fill({ color: 0xffffff, alpha: 0.07 }));
    // rotatable arrow (shown in idle/spin) + a stop square (shown while spinning)
    const a = new PIXI.Container(); const ar = R * 0.4;
    a.addChild(new PIXI.Graphics().arc(0, 0, ar, -1.206, -1.936 + 2 * Math.PI).stroke({ width: R * 0.107, color: 0xf6f1e6, cap: 'round' }));
    const tip = ar + R * 0.02;
    a.addChild(new PIXI.Graphics().moveTo(0, -tip - R * 0.03).lineTo(-R * 0.114, -ar + R * 0.06).lineTo(-R * 0.171, -tip - R * 0.07).fill(0xf6f1e6));
    g.addChild(a);
    const stop = new PIXI.Graphics().roundRect(-R * 0.26, -R * 0.26, R * 0.52, R * 0.52, R * 0.12).fill({ color: 0xf6f1e6, alpha: 0.98 }).stroke({ color: 0xba852d, width: R * 0.03, alpha: 0.9 });
    stop.visible = false; g.addChild(stop);
    setF(g, fSpin());
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
      this.addChild(gs(540, 684, G.stage));
      this.addChild(new PIXI.Graphics().rect(0, 300, 540, 384).fill({ color: 0x000000, alpha: 0.12 }));
    }
    const g1 = gs(540, 1.3, G.gold, true); g1.position.set(0, 299.5); this.addChild(g1);
    const glow = new PIXI.Graphics().circle(270, 392, 92).fill({ color: 0xe8b94a, alpha: 0.12 }); glow.filters = [fSoft()]; this.addChild(glow);

    const lw = this._siblingPanel(200, 46, 'LAST WIN', '0.00'); lw.position.set(60, 210); this.addChild(lw); E.lastWinPanel = lw;
    const tb = this._siblingPanel(200, 46, 'TOTAL BET', '0'); tb.position.set(280, 210); this.addChild(tb); E.totalBetPanel = tb;

    const demo = new PIXI.Container(); demo.position.set(210, 272); demo.addChild(panel(120, 24, 12, G.panel, 1.1, false));
    const dt = T('DEMO MODE', 11, 0x9a8d6f, 700, 0.5, true, 2.5); dt.position.set(60, 12); demo.addChild(dt); demo.visible = false; this.addChild(demo); E.demoBadge = demo;

    const spin = this._spin(270, 392, 70); hit(spin, new PIXI.Circle(0, 0, 70), () => { if (!spin._stop.visible) spin.spin(); this._emit('spin'); }); this.addChild(spin); E.spinButton = spin;

    // autoplay button (+ count overlay for running state)
    const au = new PIXI.Container(); au.position.set(104, 506); const ac = cbase(30, G.panel, 0xb88e40, 1.8); setF(ac, fSh()); au.addChild(ac);
    const at = gs(18, 20, G.active); at.position.set(-6, -10);
    const am = new PIXI.Graphics().moveTo(12, 0).lineTo(-6, -10).lineTo(-6, 10).fill(0xffffff); at.mask = am; au.addChild(at, am);
    const aCount = T('', 17, 0xf6f1e6, 700, 0.5, true); aCount.visible = false; au.addChild(aCount);
    hit(au, new PIXI.Circle(0, 0, 30), () => this._emit('autoplay')); this.addChild(au); E.autoplayButton = au; au._glyph = at; au._count = aCount;

    // stepper pill  [-] value [+]
    const st = new PIXI.Container(); st.position.set(170, 479); const sp = panel(200, 54, 27, G.panel, 1.8, false, 25); setF(sp, fSh()); st.addChild(sp);
    [237, 303].forEach((x) => st.addChild(new PIXI.Graphics().moveTo(x - 170, 7).lineTo(x - 170, 47).stroke({ width: 1.3, color: 0xcaa24a, alpha: 0.28 })));
    const mi = new PIXI.Container(); mi.addChild(new PIXI.Graphics().moveTo(19, 27).lineTo(47, 27).stroke({ width: 3, color: 0xf1e9d7, cap: 'round' }));
    const sv = T('0', 24, 0xf6f1e6, 700, 0.5, true); sv.position.set(100, 27);
    const pi = new PIXI.Container(); pi.addChild(new PIXI.Graphics().moveTo(167, 13).lineTo(167, 41).moveTo(153, 27).lineTo(181, 27).stroke({ width: 3, color: 0xf1e9d7, cap: 'round' }));
    st.addChild(mi, sv, pi);
    mi.eventMode = 'static'; mi.cursor = 'pointer'; mi.hitArea = new PIXI.Rectangle(-3, -15, 70, 54);
    pi.eventMode = 'static'; pi.cursor = 'pointer'; pi.hitArea = new PIXI.Rectangle(133, -15, 70, 54);
    mi.on('pointertap', () => this._emit('bet:dec')); pi.on('pointertap', () => this._emit('bet:inc'));
    // tapping the value opens the bet menu (intuitive shortcut)
    sv.eventMode = 'static'; sv.cursor = 'pointer'; sv.hitArea = new PIXI.Rectangle(-30, -16, 60, 32); sv.on('pointertap', () => this._emit('betmenu'));
    st.minus = mi; st.plus = pi; st.value = sv; this.addChild(st); E.betStepper = st;

    // turbo button
    const tbtn = new PIXI.Container(); tbtn.position.set(436, 506); const tc = cbase(30, G.panel, 0xb88e40, 1.8); setF(tc, fSh()); tbtn.addChild(tc);
    const tbB = gs(17, 26, G.active); tbB.position.set(-9, -12);
    const tm = new PIXI.Graphics().moveTo(4, -12).lineTo(-9, 3).lineTo(-1, 3).lineTo(-5, 14).lineTo(8, -2).lineTo(0, -2).fill(0xffffff); tbB.mask = tm; tbtn.addChild(tbB, tm);
    const tPip = new PIXI.Graphics(); tPip.visible = false; tbtn.addChild(tPip);
    hit(tbtn, new PIXI.Circle(0, 0, 30), () => this._emit('turbo')); this.addChild(tbtn); E.turboButton = tbtn; tbtn._glyph = tbB; tbtn._pip = tPip;

    // bottom balance bar (+ sound + menu)
    const bb = new PIXI.Container(); bb.position.set(14, 560); const bbp = panel(512, 44, 22, G.panel, 1.8, false, 20); setF(bbp, fSh()); bb.addChild(bbp);
    const blbl = T('BALANCE', 13, 0xd6ab46, 700, 0, true, 1.2); blbl.position.set(22, 22);
    const bval = T('0', 15, 0xf6f1e6, 700, 0, true);
    const bcur = T('USD', 11, 0x9a8d6f, 600, 0, true);
    const betlbl = T('BET', 12, 0xd6ab46, 700, 0, true, 1.2);
    const betval = T('0', 15, 0xf6f1e6, 700, 0, true);
    bb.relayout = () => {
      bval.position.set(22 + blbl.width + 8, 22);
      bcur.position.set(22 + blbl.width + 8 + bval.width + 5, 22);
      const tot = betlbl.width + 7 + betval.width, cx = 256;
      betlbl.position.set(cx - tot / 2, 22); betval.position.set(cx - tot / 2 + betlbl.width + 7, 22);
    };
    bb.addChild(blbl, bval, bcur, betlbl, betval); bb.relayout();
    bb.addChild(new PIXI.Graphics().moveTo(430, 8).lineTo(430, 36).stroke({ width: 1.2, color: 0xcaa24a, alpha: 0.3 }));
    const snd = new PIXI.Graphics()
      .moveTo(448, 17).lineTo(453, 17).lineTo(459, 12).lineTo(459, 32).lineTo(453, 27).lineTo(448, 27).fill(0xf1e9d7);
    snd.arc(458.39, 22, 7, -1.0297, 1.0297).stroke({ width: 2, color: 0xf1e9d7, cap: 'round' });
    snd.moveTo(466, 12).arc(459.37, 22, 12, -0.9851, 0.9851).stroke({ width: 2, color: 0xf1e9d7, cap: 'round' });
    const sB = new PIXI.Container(); sB.addChild(snd); sB.eventMode = 'static'; sB.cursor = 'pointer'; sB.hitArea = new PIXI.Rectangle(444, 6, 34, 32); sB.on('pointertap', () => this._emit('sound')); bb.addChild(sB);
    const mn = new PIXI.Graphics(); [16, 22, 28].forEach((y) => mn.moveTo(478, y).lineTo(500, y)); mn.stroke({ width: 2.6, color: 0xf1e9d7, cap: 'round' });
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
  // dock the bar to the screen bottom (width-fit), returning the on-screen
  // top Y of the bar region (banners) so the host can keep reels above it.
  fitBottom(W, H, maxScale) {
    let s = W / this.DESIGN_W;
    if (maxScale) s = Math.min(s, maxScale);
    this.scale.set(s);
    this.position.set((W - this.DESIGN_W * s) / 2, H - this.DESIGN_H * s);
    return { scale: s, barTopY: this.y + 200 * s }; // 200 ≈ banners' top in design space
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
  setSoundOn(on) { this.elements.balanceBar.soundButton.alpha = on ? 1 : 0.4; }

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
    if (mode === 2) { t._pip.circle(13, -13, 4).fill(0xe9bf5a).circle(13, -13, 5.4).stroke({ width: 1, color: 0x000000, alpha: 0.4 }); t._pip.visible = true; }
    else t._pip.visible = false;
  }
  setAffordable(on) { this.elements.spinButton.alpha = on ? 1 : 0.5; }
  setSteppers(minusOn, plusOn) { this.elements.betStepper.minus.alpha = minusOn ? 1 : 0.4; this.elements.betStepper.plus.alpha = plusOn ? 1 : 0.4; }
}
