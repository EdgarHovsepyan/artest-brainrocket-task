
import * as PIXI from 'pixi.js';
import {
  glassCircle, glassInto, glassPanel, spinButton, iconPlay, iconBolt, iconPlus, iconMinus, iconSound, iconMenu,
} from './ui-kit.js';

const DPR = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 3);

// glyph accent colours
const GLYPH = 0xfdf2ff;       // utility icons (±, sound, menu)
const ACCENT = 0xff66bd;      // active accent (autoplay / turbo)


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

const COL = { edge: 0xff7ad0, label: 0xe9d6f5, value: 0xfdf2ff, cur: 0xeaddf8, icon: 0xfdf2ff, divider: 0xcf78e0, gloss: 0xffffff, cyan: 0xbfe8ff };
const FS = 1.1;   
const FONT = "Fredoka, 'Helvetica Neue', 'Segoe UI', Arial, sans-serif";


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
function panel(w, h, rx, fill, ew, horiz, inRx) {   // inRx kept for call-site compatibility (glassInto derives its own inner rim)
  // premium candy-glass via the shared toolkit — matches the web bar exactly.
  const g = new PIXI.Graphics();
  glassInto(g, w, h, rx, { fill, horiz, edge: COL.edge, edgeWidth: ew || 0 });
  return g;
}
function T(t, sz, col, w, ax, mid, ls) {
  const o = new PIXI.Text({ text: t, style: { fontFamily: FONT, fontSize: Math.round(sz * FS), fontWeight: String(w || 700), fill: col, letterSpacing: ls || 0 } });
  o.resolution = Math.max(2, DPR); o.anchor.set(ax || 0, mid ? 0.5 : 0); return o;
}
// Unified press-physics (polish KB #59): 0.94 squash in (<100ms) + elastic
// settle out — matches the web bar exactly.
function hit(c, h, fn) {
  c.eventMode = 'static'; c.cursor = 'pointer'; c.hitArea = h; let d = false;
  const press = () => { d = true; const g = (typeof window !== 'undefined') && window.gsap; if (g) g.to(c.scale, { x: 0.94, y: 0.94, duration: 0.06, ease: 'power3.out', overwrite: true }); else c.scale.set(0.94); };
  const rel = () => { if (!d) return; d = false; const g = (typeof window !== 'undefined') && window.gsap; if (g) g.to(c.scale, { x: 1, y: 1, duration: 0.5, ease: 'elastic.out(1, 0.55)', overwrite: true }); else c.scale.set(1); };
  c.on('pointerdown', press);
  c.on('pointerup', () => { rel(); fn && fn(); });
  c.on('pointerupoutside', rel);
  return c;
}

export class BettingBarMobile extends PIXI.Container {
  constructor(opts) {
    super();
    opts = opts || {};
    this.DESIGN_W = 540; this.DESIGN_H = 684;
    this._bare = !!opts.bare; 
    this._cbs = {};
    this._build();
  }
  on2(ev, cb) { (this._cbs[ev] = this._cbs[ev] || []).push(cb); return this; }
  _emit(ev) { (this._cbs[ev] || []).forEach((cb) => { try { cb(); } catch (e) {  } }); }

  _siblingPanel(w, h, label, value) {
    const c = new PIXI.Container();
    c.addChild(panel(w, h, h / 2, G.banner, 1.8, true, h / 2 - 2));
    const l = T(label, 13, COL.label, 700, 0, true, 1.5);
    const v = T(value, 17, COL.value, 700, 0, true);
    c.relayout = () => {
      v.scale.set(1);
      const maxV = w - 20 - l.width - 10;            
      if (v.width > maxV && maxV > 10) v.scale.set(maxV / v.width);
      const tot = l.width + 10 + v.width;
      l.position.set(w / 2 - tot / 2, h / 2); v.position.set(w / 2 - tot / 2 + l.width + 10, h / 2);
    };
    c.addChild(l, v); c.label = l; c.value = v; c.relayout(); return c;
  }
  _spin(cx, cy, R) {
    const g = spinButton(R);
    g.position.set(cx, cy);
    return g;
  }
  _build() {
    const E = {}; this.elements = E;
    if (!this._bare) {
      this.addChild(new PIXI.Graphics().rect(0, 0, 540, 684).fill(fg(G.stage, 'v')));
      this.addChild(new PIXI.Graphics().rect(0, 300, 540, 384).fill({ color: 0x000000, alpha: 0.12 }));
    }
    this.addChild(new PIXI.Graphics().rect(0, 299.5, 540, 1.4).fill(fg(G.divider, 'h')));
    
    this.addChild(new PIXI.Graphics().circle(270, 392, 116).fill(fgRad(G.glow, 0.5, 0.5)));

    const lw = this._siblingPanel(200, 46, 'LAST WIN', '0.00'); lw.position.set(60, 210); this.addChild(lw); E.lastWinPanel = lw;
    const tb = this._siblingPanel(200, 46, 'TOTAL BET', '0'); tb.position.set(280, 210); this.addChild(tb); E.totalBetPanel = tb;

    const demo = new PIXI.Container(); demo.position.set(210, 272); demo.addChild(panel(120, 24, 12, G.panel, 1.1, false));
    const dt = T('DEMO MODE', 11, COL.cur, 700, 0.5, true, 2.5); dt.position.set(60, 12); demo.addChild(dt); demo.visible = false; this.addChild(demo); E.demoBadge = demo;

    const spin = this._spin(270, 392, 70); hit(spin, new PIXI.Circle(0, 0, 78), () => { if (!spin._stop.visible) spin.spin(); this._emit('spin'); }); this.addChild(spin); E.spinButton = spin;
    if (spin._setIdle) spin._setIdle(true);   // "ready" glow until the first spin

    
    const au = new PIXI.Container(); au.position.set(104, 506); au.addChild(glassCircle(30));
    const at = iconPlay(13, ACCENT); au.addChild(at);
    const aCount = T('', 17, COL.value, 700, 0.5, true); aCount.visible = false; au.addChild(aCount);
    hit(au, new PIXI.Circle(0, 0, 38), () => this._emit('autoplay')); this.addChild(au); E.autoplayButton = au; au._glyph = at; au._count = aCount;

    
    const st = new PIXI.Container(); st.position.set(170, 479); st.addChild(glassPanel(200, 54, 27, { edgeWidth: 1.8 }));
    [237, 303].forEach((x) => st.addChild(new PIXI.Graphics().moveTo(x - 170, 7).lineTo(x - 170, 47).stroke({ width: 1.3, color: COL.divider, alpha: 0.28 })));
    const mi = new PIXI.Container(); { const gi = iconMinus(12, GLYPH); gi.position.set(33, 27); mi.addChild(gi); }
    const sv = T('0', 24, COL.value, 700, 0.5, true); sv.position.set(100, 27);
    const pi = new PIXI.Container(); { const gi = iconPlus(12, GLYPH); gi.position.set(167, 27); pi.addChild(gi); }
    st.addChild(mi, sv, pi);
    mi.eventMode = 'static'; mi.cursor = 'pointer'; mi.hitArea = new PIXI.Rectangle(-3, -15, 70, 54);
    pi.eventMode = 'static'; pi.cursor = 'pointer'; pi.hitArea = new PIXI.Rectangle(133, -15, 70, 54);
    mi.on('pointertap', () => this._emit('bet:dec')); pi.on('pointertap', () => this._emit('bet:inc'));
    
    sv.eventMode = 'static'; sv.cursor = 'pointer'; sv.hitArea = new PIXI.Rectangle(-30, -16, 60, 32); sv.on('pointertap', () => this._emit('betmenu'));
    st.minus = mi; st.plus = pi; st.value = sv; this.addChild(st); E.betStepper = st;

    
    const tbtn = new PIXI.Container(); tbtn.position.set(436, 506); tbtn.addChild(glassCircle(30));
    const tbB = iconBolt(14, ACCENT); tbtn.addChild(tbB);
    const tPip = new PIXI.Graphics(); tPip.visible = false; tbtn.addChild(tPip);
    hit(tbtn, new PIXI.Circle(0, 0, 38), () => this._emit('turbo')); this.addChild(tbtn); E.turboButton = tbtn; tbtn._glyph = tbB; tbtn._pip = tPip;

    
    const bb = new PIXI.Container(); bb.position.set(14, 560); bb.addChild(panel(512, 44, 22, G.panel, 1.8, false, 20));
    const blbl = T('BALANCE', 13, COL.label, 700, 0, true, 1.2); blbl.position.set(22, 22);
    const bval = T('0', 15, COL.value, 700, 0, true);
    const bcur = T('USD', 11, COL.cur, 600, 0, true);
    const betlbl = T('BET', 12, COL.label, 700, 0, true, 1.2);
    const betval = T('0', 15, COL.value, 700, 0, true);
    bb.relayout = () => {
      bval.scale.set(1); betval.scale.set(1);              
      if (bval.width > 120) bval.scale.set(120 / bval.width);
      bval.position.set(22 + blbl.width + 8, 22);
      bcur.position.set(22 + blbl.width + 8 + bval.width + 5, 22);
      if (betval.width > 90) betval.scale.set(90 / betval.width);
      const tot = betlbl.width + 7 + betval.width, cx = 256;
      betlbl.position.set(cx - tot / 2, 22); betval.position.set(cx - tot / 2 + betlbl.width + 7, 22);
    };
    bb.addChild(blbl, bval, bcur, betlbl, betval); bb.relayout();
    bb.addChild(new PIXI.Graphics().moveTo(430, 8).lineTo(430, 36).stroke({ width: 1.2, color: COL.divider, alpha: 0.3 }));
    const sndOn = iconSound(9, COL.icon, false); sndOn.position.set(460, 22);
    const sndOff = iconSound(9, COL.icon, true); sndOff.position.set(460, 22); sndOff.visible = false;
    const sB = new PIXI.Container(); sB.addChild(sndOn, sndOff); sB.eventMode = 'static'; sB.cursor = 'pointer'; sB.hitArea = new PIXI.Rectangle(444, 6, 34, 32); sB.on('pointertap', () => this._emit('sound')); bb.addChild(sB); sB._slash = sndOff; sB._on = sndOn;
    const mn = iconMenu(9, COL.icon); mn.position.set(489, 22);
    const mB = new PIXI.Container(); mB.addChild(mn); mB.eventMode = 'static'; mB.cursor = 'pointer'; mB.hitArea = new PIXI.Rectangle(472, 6, 36, 32); mB.on('pointertap', () => this._emit('menu')); bb.addChild(mB);
    bb.balanceLabel = blbl; bb.balanceValue = bval; bb.balanceCurrency = bcur; bb.betLabel = betlbl; bb.betValue = betval; bb.soundButton = sB; bb.menuButton = mB;
    this.addChild(bb); E.balanceBar = bb;
  }

  
  fit(W, H) {
    const s = Math.min(W / this.DESIGN_W, H / this.DESIGN_H);
    this.scale.set(s);
    this.position.set((W - this.DESIGN_W * s) / 2, (H - this.DESIGN_H * s) / 2);
    return s;
  }

  

  fitBottom(W, H, opts) {
    opts = opts || {};
    const BAND_TOP = 192, BAND_BOT = 606, band = BAND_BOT - BAND_TOP; 
    const safeB = opts.safeBottom || 0;
    const maxBarH = (opts.maxFrac || 0.40) * H;       
    let s = Math.min(W / this.DESIGN_W, maxBarH / band);
    if (opts.maxScale) s = Math.min(s, opts.maxScale);
    this.scale.set(s);
    const bandBottom = H - safeB - 6;                  
    this.position.set((W - this.DESIGN_W * s) / 2, bandBottom - BAND_BOT * s);
    return { scale: s, barTopY: this.y + BAND_TOP * s, barH: band * s };
  }

  _fmt(n) { const v = Number(n); return (Number.isFinite(v) ? v : 0).toLocaleString('en-US'); }
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
  setSoundOn(on) { const sb = this.elements.balanceBar.soundButton; sb.alpha = on ? 1 : 0.62; if (sb._slash) sb._slash.visible = !on; if (sb._on) sb._on.visible = !!on; }

  
  setSpinning(on) { const s = this.elements.spinButton; s._arrow.visible = !on; s._stop.visible = !!on; if (s._setIdle) s._setIdle(!on); }
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
