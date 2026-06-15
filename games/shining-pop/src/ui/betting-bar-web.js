
import * as PIXI from 'pixi.js';

const DPR = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 3);


const G = {
  stage: [[0, '#241652'], [0.7, '#120b2e'], [1, '#08051c']],
  panel: [[0, '#46297a'], [0.5, '#2e1c58'], [1, '#19103e']],
  banner: [[0, '#1c1346'], [0.5, '#34206a'], [1, '#1c1346']],
  active: [[0, '#ffd9f4'], [0.45, '#ff5ab0'], [1, '#bf2496']],
  ring: [[0, '#ffe8fb'], [0.34, '#ff7ad0'], [0.66, '#9a4fcf'], [1, '#3e2076']],
  spin: [[0, '#34225e'], [0.6, '#1a1138'], [1, '#0c0826']],
};
const COL = {
  
  label: 0xe9d6f5, value: 0xfdf2ff, cur: 0xeaddf8, icon: 0xfdf2ff,
  edge: 0xff7ad0, divider: 0xcf78e0, ringInner: 0xffe4fb, centerRim: 0xffd6f4,
  activeEdge: 0x6e1f56, dark: 0x24082c, pillStroke: 0xffc8ef, gloss: 0xffffff, cyan: 0xbfe8ff,
};
const FS = 1.1;   
const FONT = "Inter, 'Helvetica Neue', 'Segoe UI', Arial, sans-serif";


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
    outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.62,
    colorStops: stops.map((s) => ({ offset: s[0], color: s[1] })), textureSpace: 'local',
  });
}
function panel(w, h, rx, fill, ew, horiz) {
  const g = new PIXI.Graphics();
  g.roundRect(0, 0, w, h, rx).fill(fg(fill, horiz ? 'h' : 'v'));
  
  g.roundRect(2.5, 2, w - 5, h * 0.42, Math.max(0, rx - 2)).fill({ color: COL.gloss, alpha: 0.12 });
  g.roundRect(2, 2, w - 4, h - 4, Math.max(0, rx - 2)).stroke({ width: 1.1, color: COL.cyan, alpha: 0.15 });
  if (ew) g.roundRect(ew / 2, ew / 2, w - ew, h - ew, Math.max(0, rx - ew / 2)).stroke({ width: ew, color: COL.edge });
  return g;
}
function cbase(r, fill, sw) {
  const g = new PIXI.Graphics();
  g.circle(0, 0, r).fill(fg(fill, 'v'));
  g.ellipse(-r * 0.18, -r * 0.34, r * 0.62, r * 0.4).fill({ color: COL.gloss, alpha: 0.12 });   
  if (sw) {
    
    g.circle(0, 0, r - sw * 0.5).stroke({ width: sw, color: COL.edge, alpha: 0.92 });
    g.circle(0, 0, r - sw - 0.5).stroke({ width: 1, color: COL.cyan, alpha: 0.13 });
  }
  return g;
}
function T(t, sz, col, w, ax, mid, ls) {
  const o = new PIXI.Text({ text: t, style: { fontFamily: FONT, fontSize: Math.round(sz * FS), fontWeight: String(w || 700), fill: col, letterSpacing: ls || 0 } });

  
  o.resolution = Math.max(3, DPR); o.anchor.set(ax || 0, mid ? 0.5 : 0); return o;
}
function hit(c, h, fn) {
  c.eventMode = 'static'; c.cursor = 'pointer'; c.hitArea = h; let d = false;
  c.on('pointerdown', () => { d = true; c.scale.set(0.95); });
  const u = () => { if (!d) return; d = false; c.scale.set(1); };
  c.on('pointerup', () => { u(); fn && fn(); }); c.on('pointerupoutside', u); return c;
}

export class BettingBarWeb extends PIXI.Container {
  constructor(opts) {
    super();
    opts = opts || {};
    this.DESIGN_W = 2400; this.DESIGN_H = 300;
    this._bare = !!opts.bare;
    this._cbs = {};
    this._build();
  }
  on2(ev, cb) { (this._cbs[ev] = this._cbs[ev] || []).push(cb); return this; }
  _emit(ev, arg) { (this._cbs[ev] || []).forEach((cb) => { try { cb(arg); } catch (e) {} }); }

  _spin(cx, cy, R) {
    const g = new PIXI.Container(); g.position.set(cx, cy); const inner = R * 0.7857;
    const base = new PIXI.Graphics();
    base.circle(0, 0, R).fill(fg(G.ring, 'd'));
    base.circle(0, 0, R - 1).stroke({ width: R * 0.057, color: COL.ringInner, alpha: 0.6 });
    base.circle(0, 0, inner).fill(fgRad(G.spin, 0.4, 0.34));
    base.circle(0, 0, inner).stroke({ width: R * 0.031, color: COL.centerRim, alpha: 0.4 });
    base.ellipse(-R * 0.23, -R * 0.26, R * 0.49 / 2, R * 0.21 / 2).fill({ color: COL.gloss, alpha: 0.07 });
    g.addChild(base);
    const a = new PIXI.Container(); const ar = R * 0.4;
    a.addChild(new PIXI.Graphics().arc(0, 0, ar, -1.206, -1.936 + 2 * Math.PI).stroke({ width: R * 0.107, color: COL.value, cap: 'round' }));
    const tip = ar + R * 0.02;
    a.addChild(new PIXI.Graphics().moveTo(0, -tip - R * 0.03).lineTo(-R * 0.114, -ar + R * 0.06).lineTo(-R * 0.171, -tip - R * 0.07).fill(COL.value));
    g.addChild(a);
    const stop = new PIXI.Graphics().roundRect(-R * 0.26, -R * 0.26, R * 0.52, R * 0.52, R * 0.12).fill({ color: COL.value, alpha: 0.98 }).stroke({ color: 0x8a2bc0, width: R * 0.03, alpha: 0.9 });
    stop.visible = false; g.addChild(stop);
    g._arrow = a; g._stop = stop;
    g.spin = () => { if (g.__s) return; g.__s = true; const s = performance.now(); const tk = () => { const t = (performance.now() - s) / 700; a.rotation = Math.min(t, 1) * Math.PI * 2; if (t < 1) requestAnimationFrame(tk); else { a.rotation = 0; g.__s = false; } }; requestAnimationFrame(tk); };
    return g;
  }
  _circleBtn(cx, cy, r, glyphFn) {
    const c = new PIXI.Container(); c.position.set(cx, cy);
    c.addChild(cbase(r, G.panel, 1.8));
    if (glyphFn) glyphFn(c);
    return c;
  }
  _build() {
    const E = {}; this.elements = E;
    if (!this._bare) {
      const bg = new PIXI.Graphics(); bg.rect(0, 0, 2400, 300).fill(fg(G.stage, 'v')); bg.rect(0, 118, 2400, 182).fill({ color: 0x000000, alpha: 0.22 }); this.addChild(bg);
    }
    
    const acc = new PIXI.Container(); acc.position.set(40, 148); this.addChild(acc);
    acc.addChild(panel(440, 76, 38, G.panel, 2, false));
    const menu = new PIXI.Graphics(); [27, 38, 49].forEach((y) => menu.moveTo(40, y).lineTo(70, y)); menu.stroke({ width: 3.2, color: COL.icon, cap: 'round' });
    const menuB = new PIXI.Container(); menuB.addChild(menu); menuB.eventMode = 'static'; menuB.cursor = 'pointer'; menuB.hitArea = new PIXI.Rectangle(20, 0, 70, 76); menuB.on('pointertap', () => this._emit('menu')); acc.addChild(menuB);
    const snd = new PIXI.Graphics().moveTo(112, 32).lineTo(118, 32).lineTo(126, 25).lineTo(126, 51).lineTo(118, 44).lineTo(112, 44).fill(COL.icon);
    snd.arc(120, 38, 11, -0.9, 0.9).stroke({ width: 2.6, color: COL.icon }); snd.arc(120, 38, 17, -0.9, 0.9).stroke({ width: 2.6, color: COL.icon });
    const sndSlash = new PIXI.Graphics().moveTo(106, 24).lineTo(134, 52).stroke({ width: 3, color: COL.icon, cap: 'round' }); sndSlash.visible = false; 
    const sndB = new PIXI.Container(); sndB.addChild(snd, sndSlash); sndB.eventMode = 'static'; sndB.cursor = 'pointer'; sndB.hitArea = new PIXI.Rectangle(100, 12, 44, 52);
    sndB.on('pointerdown', () => sndB.scale.set(0.9)); sndB.on('pointerup', () => sndB.scale.set(1)); sndB.on('pointerupoutside', () => sndB.scale.set(1));
    sndB.on('pointertap', () => { if (this._volPanel) this._volPanel.visible = !this._volPanel.visible; });
    acc.addChild(sndB); acc._snd = snd; acc._sndSlash = sndSlash;
    acc.addChild(new PIXI.Graphics().moveTo(170, 14).lineTo(170, 62).stroke({ width: 1.6, color: COL.divider, alpha: 0.3 }));
    const blbl = T('BALANCE', 17, COL.label, 700, 0, false, 2.0); blbl.position.set(192, 13); acc.addChild(blbl);
    const bval = T('0', 28, COL.value, 700, 0, false); bval.position.set(192, 33); acc.addChild(bval);
    const bcur = T('USD', 16, COL.cur, 600, 0, false); bcur.position.set(192, 41); acc.addChild(bcur);
    acc._bval = bval; acc._bcur = bcur; acc._BX = 192; E.account = acc;

    
    const sibling = (x, w, label, value) => {
      const c = new PIXI.Container(); c.position.set(x, 148); this.addChild(c);
      c.addChild(panel(w, 76, 38, G.banner, 2, true));
      const l = T(label, 18, COL.label, 700, 0, true, 1.6); const v = T(value, 27, COL.value, 700, 0, true);
      c.relayout = () => {
        v.scale.set(1);
        const maxV = w - 24 - l.width - 14;
        if (v.width > maxV && maxV > 12) v.scale.set(maxV / v.width);
        const tot = l.width + 14 + v.width;
        l.position.set(w / 2 - tot / 2, 38); v.position.set(w / 2 - tot / 2 + l.width + 14, 38);
      };
      c.addChild(l, v); c.label = l; c.value = v; c.relayout(); return c;
    };
    E.lastWin = sibling(500, 320, 'LAST WIN', '0.00');
    E.totalBet = sibling(840, 240, 'TOTAL BET', '0');

    
    const SX = 1100, SW = 800, CELLW = 132, PCX = SW / 2; 
    const sel = new PIXI.Container(); sel.position.set(SX, 148); this.addChild(sel);
    sel.addChild(panel(SW, 76, 38, G.panel, 2, false));
    const cMask = new PIXI.Graphics().roundRect(12, 8, SW - 24, 60, 30).fill(0xffffff); sel.addChild(cMask);
    const track = new PIXI.Container(); track.mask = cMask; sel.addChild(track);

    
    
    const pill = new PIXI.Graphics()
      .roundRect(-62, 8, 124, 60, 30).fill(fg(G.active, 'v'))
      .roundRect(-62, 8, 124, 60, 30).stroke({ width: 2, color: COL.pillStroke });
    track.addChild(pill);
    sel.eventMode = 'static'; sel.cursor = 'grab'; sel.hitArea = new PIXI.Rectangle(0, 0, SW, 76);
    const car = { track, pill, CELLW, PCX, levels: [], cells: [], active: 0, drag: false, lastX: 0, vx: 0, moved: 0, emitted: -1, fmt: (v) => String(v) };
    this._car = car;

    const contentW = () => car.levels.length * CELLW;
    const clampTrack = (x) => {
      const cw = contentW();
      if (cw <= SW - 24) return (SW - cw) / 2; 
      return Math.max(SW - 12 - cw, Math.min(12, x)); 
    };
    const trackXFor = (i) => clampTrack(PCX - (i * CELLW + CELLW / 2));
    const pillXFor = (i) => i * CELLW + CELLW / 2; 
    const nearest = () => Math.max(0, Math.min(car.levels.length - 1, Math.round((PCX - track.x - CELLW / 2) / CELLW)));
    const restyle = () => car.cells.forEach((c, i) => { const cen = i === car.active; c.style.fill = cen ? COL.dark : COL.value; c.scale.set(cen ? 1 : 0.78); c.alpha = cen ? 1 : 0.6; });
    car._restyle = restyle;
    car._snapTo = (i, animate) => {
      car.active = Math.max(0, Math.min(car.levels.length - 1, i)); car.emitted = car.active;
      const tx = trackXFor(car.active), px = pillXFor(car.active);
      if (animate && window.gsap) {
        window.gsap.to(track, { x: tx, duration: 0.3, ease: 'power2.out', onComplete: restyle });
        window.gsap.to(pill, { x: px, duration: 0.3, ease: 'power2.out' });
      } else { track.x = tx; pill.x = px; restyle(); }
    };
    const snap = () => {
      const i = nearest(); car.active = i; const tx = trackXFor(i), px = pillXFor(i);
      if (window.gsap) {
        window.gsap.to(track, { x: tx, duration: 0.36, ease: 'back.out(1.3)', onComplete: restyle });
        window.gsap.to(pill, { x: px, duration: 0.36, ease: 'back.out(1.3)' });
      } else { track.x = tx; pill.x = px; }
      restyle();
      if (i !== car.emitted) { car.emitted = i; this._emit('bet:set', i); }
    };
    sel.on('pointerdown', (e) => { car.drag = true; car.moved = 0; car.lastX = e.global.x; car.vx = 0; sel.cursor = 'grabbing'; if (window.gsap) window.gsap.killTweensOf(track); });
    sel.on('globalpointermove', (e) => { if (!car.drag) return; const s = this.scale.x || 1; const dx = (e.global.x - car.lastX) / s; car.lastX = e.global.x; track.x += dx; car.vx = dx; car.moved += Math.abs(dx); });
    const end = () => { if (!car.drag) return; car.drag = false; sel.cursor = 'grab'; track.x += car.vx * 7; snap(); };
    sel.on('pointerup', end); sel.on('pointerupoutside', end);
    E.selector = sel;

    
    const coins = this._circleBtn(1980, 186, 38, (c) => {
      const mk = (yc, fill) => c.addChild(new PIXI.Graphics().ellipse(0, yc - 186, 19, 6.5).fill(fill).ellipse(0, yc - 186, 19, 6.5).stroke({ width: 1, color: COL.activeEdge }));
      mk(197, 0x9a4bd0); mk(189, 0xc06fda);
      c.addChild(new PIXI.Graphics().ellipse(0, 181 - 186, 19, 6.5).fill(0xe0a0ff));
    });
    hit(coins, new PIXI.Circle(0, 0, 38), () => this._emit('betmenu')); this.addChild(coins); E.coins = coins;   
    const gamble = this._circleBtn(2090, 186, 38, null);
    const gx2 = T('×2', 25, COL.value, 700, 0.5, true); gx2.position.set(0, 0); gamble.addChild(gx2);
    hit(gamble, new PIXI.Circle(0, 0, 38), () => this._emit('bet:double'));
    this.addChild(gamble); E.gamble = gamble;
    const turbo = this._circleBtn(2200, 150, 30, (c) => {
      const gl = new PIXI.Graphics().poly([4, -12, -9, 3, -1, 3, -5, 14, 8, -2, 0, -2]).fill(fg(G.active, 'v')); c.addChild(gl); c._glyph = gl;
      const pip = new PIXI.Graphics(); pip.visible = false; c.addChild(pip); c._pip = pip;
    });
    hit(turbo, new PIXI.Circle(0, 0, 30), () => this._emit('turbo')); this.addChild(turbo); E.turbo = turbo;
    const auto = this._circleBtn(2200, 222, 30, (c) => {
      const ar = new PIXI.Graphics().arc(0, 0, 12, -1.231, -1.9106 + 2 * Math.PI).stroke({ width: 3, color: 0xe0a0ff, cap: 'round' });
      ar.moveTo(2, -13).lineTo(-3, -7).lineTo(-5, -15).fill(0xe0a0ff); c.addChild(ar); c._glyph = ar;
      const cnt = T('', 22, COL.value, 700, 0.5, true); cnt.visible = false; c.addChild(cnt); c._count = cnt;
    });
    hit(auto, new PIXI.Circle(0, 0, 30), () => this._emit('autoplay')); this.addChild(auto); E.autoplay = auto;
    const spin = this._spin(2330, 186, 70); hit(spin, new PIXI.Circle(0, 0, 70), () => { if (!spin._stop.visible) spin.spin(); this._emit('spin'); }); this.addChild(spin); E.spin = spin;


    const vp = new PIXI.Container(); vp.position.set(70, 10); vp.visible = false; this.addChild(vp); this._volPanel = vp; E.volPanel = vp;
    const VPW = 240, VPH = 98;
    vp.addChild(panel(VPW, VPH, 20, G.panel, 2, false));
    const vtl = T('VOLUME', 16, COL.label, 700, 0, false, 2); vtl.position.set(20, 14); vp.addChild(vtl);
    const xg = new PIXI.Graphics().moveTo(-7, -7).lineTo(7, 7).moveTo(7, -7).lineTo(-7, 7).stroke({ width: 3, color: COL.icon, cap: 'round' });
    const xb = new PIXI.Container(); xb.addChild(xg); xb.position.set(VPW - 22, 24); xb.eventMode = 'static'; xb.cursor = 'pointer'; xb.hitArea = new PIXI.Rectangle(-16, -16, 32, 32);
    xb.on('pointertap', () => { vp.visible = false; }); vp.addChild(xb);
    const TX = 60, TY = 66, TW = VPW - TX - 26;
    vp.addChild(new PIXI.Graphics().roundRect(TX, TY - 5, TW, 10, 5).fill({ color: COL.dark, alpha: 0.85 }).roundRect(TX, TY - 5, TW, 10, 5).stroke({ width: 1, color: COL.edge, alpha: 0.5 }));
    const vfill = new PIXI.Graphics(); vp.addChild(vfill);
    const knob = new PIXI.Graphics().circle(0, 0, 12).fill(fg(G.active, 'v')).circle(0, 0, 12).stroke({ width: 2, color: COL.pillStroke }); knob.position.set(TX, TY); vp.addChild(knob);
    const spk = new PIXI.Graphics().moveTo(22, TY - 5).lineTo(27, TY - 5).lineTo(33, TY - 11).lineTo(33, TY + 11).lineTo(27, TY + 5).lineTo(22, TY + 5).fill(COL.icon);
    const spkB = new PIXI.Container(); spkB.addChild(spk); spkB.eventMode = 'static'; spkB.cursor = 'pointer'; spkB.hitArea = new PIXI.Rectangle(16, TY - 16, 30, 32); vp.addChild(spkB);
    let vol = 0.6, lastNonZero = 0.6;
    const vredraw = () => { knob.x = TX + TW * vol; vfill.clear().roundRect(TX, TY - 5, Math.max(0.001, TW * vol), 10, 5).fill(fg(G.active, 'h')); };
    vredraw();
    const setVol = (v, emit) => { vol = Math.max(0, Math.min(1, v)); if (vol > 0) lastNonZero = vol; vredraw(); if (emit) this._emit('volume', vol); };
    vp._setVol = (v) => setVol(v, false);
    spkB.on('pointertap', () => setVol(vol > 0.001 ? 0 : lastNonZero, true));
    vp.eventMode = 'static'; vp.hitArea = new PIXI.Rectangle(0, 0, VPW, VPH);
    let vdrag = false;
    const vFromGlobal = (g) => { const p = vp.toLocal(g); setVol((p.x - TX) / TW, true); };
    vp.on('pointerdown', (e) => { const p = vp.toLocal(e.global); if (p.y > TY - 26 && p.y < TY + 26 && p.x > TX - 18 && p.x < TX + TW + 18) { vdrag = true; vFromGlobal(e.global); } });
    vp.on('globalpointermove', (e) => { if (vdrag) vFromGlobal(e.global); });
    const vend = () => { vdrag = false; }; vp.on('pointerup', vend); vp.on('pointerupoutside', vend);
  }

  fitBottom(W, H, maxScale) {

    let s = (W * 0.93) / this.DESIGN_W;
    if (maxScale) s = Math.min(s, maxScale);
    this.scale.set(s);
    this.position.set((W - this.DESIGN_W * s) / 2, H - this.DESIGN_H * s);
    return { scale: s, barTopY: this.y + 118 * s };
  }
  _fmt(n) { const v = Number(n); return (Number.isFinite(v) ? v : 0).toLocaleString('en-US'); }
  setBalance(n) {
    const a = this.elements.account; a._bval.text = this._fmt(n);
    a._bval.scale.set(1);
    if (a._bval.width > 180) a._bval.scale.set(180 / a._bval.width);
    a._bcur.position.set(a._BX + a._bval.width + 10, 41);
  }
  setCurrency(c) { const a = this.elements.account; a._bcur.text = c; a._bcur.position.set(a._BX + a._bval.width + 10, 41); }
  setLastWin(n) { const p = this.elements.lastWin; p.value.text = this._fmt(n); p.relayout(); }
  setBet(n) { const p = this.elements.totalBet; p.value.text = this._fmt(n); p.relayout(); }
  
  setBetLevels(values, activeIdx, fmt) {
    const car = this._car; if (!car) return;
    if (fmt) car.fmt = fmt;
    const same = car.levels.length === values.length && car.levels[0] === values[0] && car.levels[car.levels.length - 1] === values[values.length - 1];
    if (!same) {
      car.levels = values.slice();
      car.track.removeChildren(); car.cells = [];
      car.track.addChild(car.pill); 
      values.forEach((v, i) => { const t = T(car.fmt(v), 27, COL.value, 700, 0.5, true); t.position.set(i * car.CELLW + car.CELLW / 2, 38); car.track.addChild(t); car.cells.push(t); });
      car._snapTo(activeIdx || 0, false);
    } else if (!car.drag && (activeIdx || 0) !== car.active) {
      car._snapTo(activeIdx || 0, true);
    }
  }
  setSoundOn(on) {
    const a = this.elements.account;
    if (a && a._snd) { a._snd.alpha = on ? 1 : 0.5; if (a._sndSlash) a._sndSlash.visible = !on; }   
  }
  
  setVolume(v) { if (this._volPanel && this._volPanel._setVol) this._volPanel._setVol(v); this.setSoundOn(v > 0.001); }
  setSpinning(on) { if (on && this._volPanel) this._volPanel.visible = false; const s = this.elements.spin; s._arrow.visible = !on; s._stop.visible = !!on; }
  setAutoplay(count) {
    const au = this.elements.autoplay; const active = count != null && count !== false;
    au._count.text = (count === Infinity || count === 0) ? '∞' : String(count);
    au._count.visible = active; au._glyph.visible = !active;
  }
  setTurbo(mode) {
    const t = this.elements.turbo; t._glyph.alpha = mode > 0 ? 1 : 0.45; t._pip.clear();
    if (mode === 2) { t._pip.circle(13, -13, 5).fill(0xe9bf5a).circle(13, -13, 6.4).stroke({ width: 1, color: 0x000000, alpha: 0.4 }); t._pip.visible = true; } else t._pip.visible = false;
  }
  setAffordable(on) { this.elements.spin.alpha = on ? 1 : 0.5; }
}
