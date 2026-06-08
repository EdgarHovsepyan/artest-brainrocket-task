/* ============================================================================
   ARTEST | BrainRocket — BettingBarWeb  (PixiJS v8)
   ----------------------------------------------------------------------------
   v8 port of the delivered web betting bar (betting_bar_web spec) — the
   landscape counterpart to BettingBarMobile. Design space 2400 x 300.
   Layout: ACCOUNT(menu+sound+BALANCE) | LAST WIN | TOTAL BET | 5-cell bet
           selector | coins(buy) | gamble(disabled) | turbo/autoplay | SPIN.
   CRYSTAL theme (same palette as the mobile bar) so both unify with the bg.

   API: setBalance/setBet/setLastWin/setCurrency/setSoundOn + game-state
        setSpinning/setAutoplay/setTurbo/setAffordable/setBetCells.
   Events (on2): spin · bet:set · autoplay · turbo · sound · menu · buy
   fitBottom(W,H) docks it to the screen bottom (width-fit).
   ============================================================================ */
import * as PIXI from 'pixi.js';

const DPR = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 3);

// CRYSTAL palette (matches betting-bar-mobile.js)
const G = {
  stage: [[0, '#1a1240'], [0.7, '#0d0826'], [1, '#060418']],
  panel: [[0, '#2a1e52'], [0.5, '#191140'], [1, '#0c0826']],
  banner: [[0, '#171138'], [0.5, '#281c58'], [1, '#171138']],
  active: [[0, '#f6c8ff'], [0.45, '#db5fd8'], [1, '#8e2ec4']],
  ring: [[0, '#ecd6ff'], [0.34, '#b86fda'], [0.66, '#7a3cb2'], [1, '#34206a']],
  spin: [[0, '#2a1f4e'], [0.6, '#15102e'], [1, '#09071e']],
};
const COL = {
  label: 0xd9a8f2, value: 0xf3ecff, cur: 0x9c88c2, icon: 0xefe6ff,
  edge: 0xb86fda, divider: 0xb070da, ringInner: 0xf0e0ff, centerRim: 0xe8d0ff,
  activeEdge: 0x4a1f7a, dark: 0x1a0830, pillStroke: 0xf0d0ff, gambleStroke: 0x6a5a8a, gambleFill: 0x160f28,
};
const FONT = "Inter, 'Helvetica Neue', 'Segoe UI', Arial, sans-serif";

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
function panel(w, h, rx, fill, ew, horiz) {
  const c = new PIXI.Container();
  const sp = gs(w, h, fill, horiz);
  const m = new PIXI.Graphics().roundRect(0, 0, w, h, rx).fill(0xffffff); sp.mask = m; c.addChild(sp, m);
  if (ew) c.addChild(new PIXI.Graphics().roundRect(ew / 2, ew / 2, w - ew, h - ew, rx - ew / 2).stroke({ width: ew, color: COL.edge }));
  return c;
}
function cbase(r, fill, sw) {
  const c = new PIXI.Container(); const d = r * 2; const sp = gs(d, d, fill); sp.position.set(-r, -r);
  const m = new PIXI.Graphics().circle(0, 0, r).fill(0xffffff); sp.mask = m; c.addChild(sp, m);
  if (sw) c.addChild(new PIXI.Graphics().circle(0, 0, r).stroke({ width: sw, color: COL.edge }));
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
  c.on('pointerup', () => { u(); fn && fn(); }); c.on('pointerupoutside', u); return c;
}

export class BettingBarWeb extends PIXI.Container {
  constructor(opts) {
    super();
    opts = opts || {};
    this.DESIGN_W = 2400; this.DESIGN_H = 300;
    this._bare = !!opts.bare;
    this._cbs = {};
    this._betCells = [];
    this._build();
  }
  on2(ev, cb) { (this._cbs[ev] = this._cbs[ev] || []).push(cb); return this; }
  _emit(ev, arg) { (this._cbs[ev] || []).forEach((cb) => { try { cb(arg); } catch (e) {} }); }

  _spin(cx, cy, R) {
    const g = new PIXI.Container(); g.position.set(cx, cy); const inner = R * 0.7857;
    const rs = gs(R * 2, R * 2, G.ring, true); rs.position.set(-R, -R);
    const rm = new PIXI.Graphics().circle(0, 0, R).fill(0xffffff); rs.mask = rm; g.addChild(rs, rm);
    g.addChild(new PIXI.Graphics().circle(0, 0, R - 1).stroke({ width: R * 0.057, color: COL.ringInner, alpha: 0.6 }));
    const ct = new PIXI.Sprite(radial(inner * 2, G.spin, 0.4, 0.34)); ct.anchor.set(0.5);
    const cm = new PIXI.Graphics().circle(0, 0, inner).fill(0xffffff); ct.mask = cm; g.addChild(ct, cm);
    g.addChild(new PIXI.Graphics().circle(0, 0, inner).stroke({ width: R * 0.031, color: COL.centerRim, alpha: 0.4 }));
    g.addChild(new PIXI.Graphics().ellipse(-R * 0.23, -R * 0.26, R * 0.49 / 2, R * 0.21 / 2).fill({ color: 0xffffff, alpha: 0.07 }));
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
      this.addChild(gs(2400, 300, G.stage));
      this.addChild(new PIXI.Graphics().rect(0, 118, 2400, 182).fill({ color: 0x000000, alpha: 0.22 }));
    }
    // ACCOUNT PANEL (menu + sound + BALANCE). Container is offset to (40,148),
    // so ALL children use LOCAL coords (design coord minus the 40/148 offset) —
    // otherwise the content renders below/right of the panel (the "empty" bug).
    const acc = new PIXI.Container(); acc.position.set(40, 148); this.addChild(acc);
    acc.addChild(panel(540, 76, 38, G.panel, 2, false));
    const menu = new PIXI.Graphics(); [27, 38, 49].forEach((y) => menu.moveTo(44, y).lineTo(76, y)); menu.stroke({ width: 3.2, color: COL.icon, cap: 'round' });
    const menuB = new PIXI.Container(); menuB.addChild(menu); menuB.eventMode = 'static'; menuB.cursor = 'pointer'; menuB.hitArea = new PIXI.Rectangle(22, 0, 76, 76); menuB.on('pointertap', () => this._emit('menu')); acc.addChild(menuB);
    const snd = new PIXI.Graphics().moveTo(124, 32).lineTo(130, 32).lineTo(138, 25).lineTo(138, 51).lineTo(130, 44).lineTo(124, 44).fill(COL.icon);
    snd.arc(132, 38, 11, -0.9, 0.9).stroke({ width: 2.6, color: COL.icon }); snd.arc(132, 38, 17, -0.9, 0.9).stroke({ width: 2.6, color: COL.icon });
    const sndB = new PIXI.Container(); sndB.addChild(snd); sndB.eventMode = 'static'; sndB.cursor = 'pointer'; sndB.hitArea = new PIXI.Rectangle(110, 12, 44, 52); sndB.on('pointertap', () => this._emit('sound')); acc.addChild(sndB);
    acc.addChild(new PIXI.Graphics().moveTo(192, 14).lineTo(192, 62).stroke({ width: 1.6, color: COL.divider, alpha: 0.3 }));
    const blbl = T('BALANCE', 19, COL.label, 700, 0, false, 2.4); blbl.position.set(218, 11); acc.addChild(blbl);
    const bval = T('0', 30, COL.value, 700, 0, false); bval.position.set(218, 32); acc.addChild(bval);
    const bcur = T('USD', 18, COL.cur, 600, 0, false); bcur.position.set(218, 40); acc.addChild(bcur);
    acc._bval = bval; acc._bcur = bcur; E.account = acc;

    // SIBLING BANNERS
    const sibling = (x, w, label, value) => {
      const c = new PIXI.Container(); c.position.set(x, 148); this.addChild(c);
      c.addChild(panel(w, 76, 38, G.banner, 2, true));
      const l = T(label, 19, COL.label, 700, 0, true, 2); const v = T(value, 28, COL.value, 700, 0, true);
      c.relayout = () => { const tot = l.width + 16 + v.width; l.position.set(w / 2 - tot / 2, 38); v.position.set(w / 2 - tot / 2 + l.width + 16, 38); };
      c.addChild(l, v); c.label = l; c.value = v; c.relayout(); return c;
    };
    E.lastWin = sibling(612, 420, 'LAST WIN', '0.00');
    E.totalBet = sibling(1052, 300, 'TOTAL BET', '0');

    // BET SELECTOR (5 cells)
    const sel = new PIXI.Container(); sel.position.set(1372, 148); this.addChild(sel);
    sel.addChild(panel(640, 76, 38, G.panel, 2, false));
    [128, 512].forEach((x) => sel.addChild(new PIXI.Graphics().moveTo(x, 14).lineTo(x, 62).stroke({ width: 1.4, color: COL.divider, alpha: 0.25 })));
    const pill = new PIXI.Container(); sel.addChild(pill); E.betPill = pill;
    const cells = [];
    const cx5 = [64, 192, 320, 448, 576]; // cell centers within the 640 panel
    for (let i = 0; i < 5; i++) {
      const t = T('—', 30, COL.value, 700, 0.5, true); t.position.set(cx5[i], 38); sel.addChild(t);
      const hitC = new PIXI.Container(); hitC.eventMode = 'static'; hitC.cursor = 'pointer'; hitC.hitArea = new PIXI.Rectangle(cx5[i] - 64, 0, 128, 76);
      const idx = i; hitC.on('pointertap', () => this._emit('bet:set', idx)); sel.addChild(hitC);
      cells.push({ t });
    }
    this._betCells = cells; E.selector = sel;

    // COINS (buy) + ×2 (double-bet) — compact right cluster, no spin overlap
    const coins = this._circleBtn(2056, 186, 38, (c) => {
      const mk = (yc, fill) => c.addChild(new PIXI.Graphics().ellipse(0, yc - 186, 19, 6.5).fill(fill).ellipse(0, yc - 186, 19, 6.5).stroke({ width: 1, color: COL.activeEdge }));
      mk(197, 0x9a4bd0); mk(189, 0xc06fda);
      c.addChild(new PIXI.Graphics().ellipse(0, 181 - 186, 19, 6.5).fill(0xe0a0ff));
    });
    hit(coins, new PIXI.Circle(0, 0, 38), () => this._emit('buy')); this.addChild(coins); E.coins = coins;
    // ×2 — ENABLED quick "double bet" (was a dead disabled gamble button).
    const gamble = this._circleBtn(2144, 186, 38, null);
    const gx2 = T('×2', 25, COL.value, 700, 0.5, true); gx2.position.set(0, 0); gamble.addChild(gx2);
    hit(gamble, new PIXI.Circle(0, 0, 38), () => this._emit('bet:double'));
    this.addChild(gamble); E.gamble = gamble;

    // TURBO (top) + AUTOPLAY (bottom), stacked at x2224 — clear left of the SPIN
    const turbo = this._circleBtn(2224, 150, 30, (c) => {
      const gl = gs(20, 30, G.active); gl.position.set(-10, -15);
      const m = new PIXI.Graphics().moveTo(4, -12).lineTo(-9, 3).lineTo(-1, 3).lineTo(-5, 14).lineTo(8, -2).lineTo(0, -2).fill(0xffffff); gl.mask = m; c.addChild(gl, m); c._glyph = gl;
      const pip = new PIXI.Graphics(); pip.visible = false; c.addChild(pip); c._pip = pip;
    });
    hit(turbo, new PIXI.Circle(0, 0, 30), () => this._emit('turbo')); this.addChild(turbo); E.turbo = turbo;
    const auto = this._circleBtn(2224, 222, 30, (c) => {
      const ar = new PIXI.Graphics().arc(0, 0, 12, -1.231, -1.9106 + 2 * Math.PI).stroke({ width: 3, color: 0xe0a0ff, cap: 'round' });
      ar.moveTo(2, -13).lineTo(-3, -7).lineTo(-5, -15).fill(0xe0a0ff); c.addChild(ar); c._glyph = ar;
      const cnt = T('', 22, COL.value, 700, 0.5, true); cnt.visible = false; c.addChild(cnt); c._count = cnt;
    });
    hit(auto, new PIXI.Circle(0, 0, 30), () => this._emit('autoplay')); this.addChild(auto); E.autoplay = auto;

    // SPIN (right pad)
    const spin = this._spin(2330, 186, 70); hit(spin, new PIXI.Circle(0, 0, 70), () => { if (!spin._stop.visible) spin.spin(); this._emit('spin'); }); this.addChild(spin); E.spin = spin;
  }

  fitBottom(W, H, maxScale) {
    let s = W / this.DESIGN_W;
    if (maxScale) s = Math.min(s, maxScale);
    this.scale.set(s);
    this.position.set((W - this.DESIGN_W * s) / 2, H - this.DESIGN_H * s);
    return { scale: s, barTopY: this.y + 118 * s }; // 118 = scrim top in design space
  }
  _fmt(n) { return Number(n).toLocaleString('en-US'); }
  setBalance(n) { const a = this.elements.account; a._bval.text = this._fmt(n); a._bcur.position.set(218 + a._bval.width + 12, 40); }
  setCurrency(c) { const a = this.elements.account; a._bcur.text = c; a._bcur.position.set(218 + a._bval.width + 12, 40); }
  setLastWin(n) { const p = this.elements.lastWin; p.value.text = this._fmt(n); p.relayout(); }
  setBet(n) { const p = this.elements.totalBet; p.value.text = this._fmt(n); p.relayout(); }
  // populate the 5 selector cells (values) + highlight the active index
  setBetCells(values, activeIdx) {
    const cx5 = [64, 192, 320, 448, 576];
    this._betCells.forEach((c, i) => {
      const v = values[i];
      c.t.text = v == null ? '—' : this._fmt(v);
      c.t.style.fill = i === activeIdx ? COL.dark : COL.value;
      c.t.visible = v != null;
    });
    const pill = this.elements.betPill; pill.removeChildren();
    if (activeIdx != null && activeIdx >= 0 && values[activeIdx] != null) {
      const px = cx5[activeIdx];
      pill.addChild(new PIXI.Graphics().roundRect(px - 60, 8, 120, 60, 30).fill(grad(120, 60, G.active, false)).roundRect(px - 60, 8, 120, 60, 30).stroke({ width: 2, color: COL.pillStroke }));
      // re-add the active label on top of the pill
      const t = this._betCells[activeIdx].t; pill.parent.removeChild(t); pill.parent.addChild(t);
    }
  }
  setSoundOn(on) { /* dim handled via icon alpha */ const a = this.elements.account; if (a) a.alpha = 1; }
  setSpinning(on) { const s = this.elements.spin; s._arrow.visible = !on; s._stop.visible = !!on; }
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
