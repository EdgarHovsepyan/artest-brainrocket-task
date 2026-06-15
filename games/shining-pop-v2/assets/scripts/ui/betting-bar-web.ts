/* BettingBarWeb — Cocos Creator 3.8 port of the owner's delivered web bar
   (betting-bar-web.js, design 2400x300, candy/cotton-candy master pass).
   Layout: ACCOUNT(menu+sound+BALANCE) | LAST WIN | TOTAL BET | swipe bet
   carousel (center = active pill) | coins(quick bets) | x2 | turbo/autoplay |
   SPIN ring. cc.Graphics has no gradients, so each gradient is approximated by
   a representative stop + glossy top sheen + cyan glass inner stroke — the
   same technique the delivered mobile bar uses.

   Events: spin · bet:set(idx) · bet:double · betmenu · autoplay · turbo ·
           volume(0..1) · menu
   API: on · fit · setBalance · setCurrency · setLastWin · setBet ·
        setBetLevels · setDemo · setSoundOn · setVolume · setSpinning ·
        setAutoplay · setTurbo · setAffordable · setSteppers */
import {
  _decorator,
  Color,
  Component,
  EventTarget,
  EventTouch,
  Graphics,
  Label,
  LabelOutline,
  LabelShadow,
  Mask,
  Node,
  resources,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
  UIOpacity,
  UITransform,
  Vec2,
  Vec3,
} from 'cc';
import { applyFont } from '../view/fonts';
import { formatMoney } from '../logic/money';
import { VIEW_CONFIG } from '../view/view-config';
const { ccclass } = _decorator;

const W = 2400;
// Compact slab: the controls only occupy design-y ~88..256 (spin-ring halo top
// down to its bottom). The old 300-tall surface left ~88px of dead gradient
// above them, so the bar read as a tall washed slab (owner: "betting part
// height / compact"). CROP shifts the design->node mapping up so the bar's top
// edge sits just above the halo; H is trimmed to the real content extent. Every
// control routes through Y(), so this single offset moves the whole band
// together — no per-control re-pointing.
const H = 214;
const CROP = 78; // design-y that maps to the bar's TOP edge (node y = 0)
const RING_TOP = 116; // spin ring top edge in design-y (cy 186 − R 70)
/** Master type-scale (FS=1.1 in betting-bar-web.js): the design font sizes are
 *  built for a 30%-viewport-tall bar; with our 42% cap the bar IS bigger but
 *  the text was still reading thin at small presets. Bumping every lbl() by
 *  this factor matches the flagship hierarchy. */
const FS = 1.12;
/** Banner panel + carousel + utility-circle inset Y (in design-down coords). */
const ROW_Y = 148;
const ROW_H = 76;

const C = {
  stage: '#120b2e',
  stageDeep: '#08051c',
  panel: '#2e1c58',
  panelHi: '#46297a',
  banner: '#251853',
  active: '#ff5ab0',
  activeHi: '#ffd9f4',
  activeLo: '#bf2496',
  ringHi: '#ffe8fb',
  ringMid: '#ff7ad0',
  ringLo: '#3e2076',
  spinFace: '#1a1138',
  label: '#e9d6f5',
  value: '#fdf2ff',
  cur: '#eaddf8',
  icon: '#fdf2ff',
  edge: '#ff7ad0',
  divider: '#cf78e0',
  pillStroke: '#ffc8ef',
  dark: '#24082c',
  cyan: '#bfe8ff',
  centerRim: '#ffd6f4',
};
function col(hex: string, a?: number): Color {
  const c = new Color();
  Color.fromHEX(c, hex);
  if (a != null) c.a = Math.round(a * 255);
  return c;
}

/** Task 2.5 — CSS-style cubic-bezier easing as a (t: number) => number fn.
 *  Solves x(s)=t via 8 Newton iterations, then returns y(s). Returns a stable
 *  function reference so tween can capture it without re-allocating per call. */
function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number): (t: number) => number {
  const ax = 3 * p1x;
  const bx = 3 * (p2x - p1x) - ax;
  const cx = 1 - ax - bx;
  const ay = 3 * p1y;
  const by = 3 * (p2y - p1y) - ay;
  const cy = 1 - ay - by;
  const sampleX = (s: number) => ((cx * s + bx) * s + ax) * s;
  const sampleY = (s: number) => ((cy * s + by) * s + ay) * s;
  const sampleDx = (s: number) => (3 * cx * s + 2 * bx) * s + ax;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let s = t;
    for (let i = 0; i < 8; i++) {
      const x = sampleX(s) - t;
      const dx = sampleDx(s);
      if (Math.abs(dx) < 1e-6) break;
      s -= x / dx;
    }
    return sampleY(s);
  };
}

/** Touch-device detection. First TOUCH_START anywhere flips this — once true,
 *  hover handlers no-op (touch devices don't have a true hover state, and
 *  fake-hovering on tap would feel laggy). Module-scoped so all bar buttons
 *  share the same flag for the session. */
let __touchDetected = false;

@ccclass('BettingBarWeb')
export class BettingBarWeb extends Component {
  private events = new EventTarget();
  // Display currency for every money readout (symbol-prefixed via formatMoney).
  // setCurrency() updates it; defaults to USD so the bar reads correctly pre-init.
  private currency = 'USD';
  private balValue!: Label;
  private balCur!: Label;
  private lastWinValue!: Label;
  private totalBetValue!: Label;
  private sndGlyphOp!: UIOpacity;
  private sndSlash!: Node;
  private volPanel!: Node;
  private volPanelOp!: UIOpacity;
  private volFill!: Graphics;
  private volKnob!: Node;
  private volume = 0.5;
  private lastNonZero = 0.5;
  private spinArrow!: Node;
  private spinStop!: Node;
  private spinOp!: UIOpacity;
  private spinRing!: Node;
  private spinBody!: Node; // inner disc — idle breathe lives here (press scales the ring)
  private autoGlyph!: Node;
  private autoCount!: Label;
  private turboGlyphOp!: UIOpacity;
  private turboPip!: Node;
  private track!: Node;
  private cells: Label[] = [];
  private levels: number[] = [];
  private activeIdx = 0;
  private carFmt: (v: number) => string = (v) => String(v);
  private dragX = 0;
  private dragging = false;
  private moved = 0;

  onLoad(): void {
    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ui.setContentSize(W, H);
    ui.setAnchorPoint(0, 1);

    const bg = this.gfx('bg');
    // Task 2.1 — bar background. 2026-06-11: when bgBaseAlpha is 0 the slab is
    // REMOVED entirely (user request) — controls float directly over the
    // painted game bg, no panel behind them, no top hairline, no inner glow.
    // The whole slab paint is gated on bgBaseAlpha so "remove the bar bg" is a
    // single config flip.
    const barCfg = VIEW_CONFIG.bar.web;
    if (barCfg.bgBaseAlpha > 0) {
      bg.fillColor = col('#241652', barCfg.bgBaseAlpha); // warm-violet base
      bg.rect(0, -H, W, H);
      bg.fill();
      bg.fillColor = col(C.stageDeep, barCfg.bgGroundAlpha); // deeper grounding band
      bg.rect(0, -H, W, Math.round(H * barCfg.bgGroundFrac));
      bg.fill();
      // Soft top contour — candy-pink hairline lifting the bar off the reels.
      bg.lineWidth = 2;
      bg.strokeColor = col(C.edge, 0.55);
      bg.moveTo(0, 0);
      bg.lineTo(W, 0);
      bg.stroke();
      // Top inner glow — faint additive band that sells the gloss.
      bg.fillColor = col('#ffffff', 0.06);
      bg.rect(0, -8, W, 8);
      bg.fill();
    }

    this.buildAccount();
    this.buildBanner(500, 320, 'LAST WIN', (l) => {
      this.lastWinValue = l;
      this.make3D(l);
    });
    this.buildBanner(840, 240, 'TOTAL BET', (l) => {
      this.totalBetValue = l;
      this.make3D(l);
    });
    this.relayoutBanners();
    this.buildCarousel();
    this.buildRightCluster();
    this.buildVolumePanel();
    this.buildDemoBadge();
  }

  /** DEMO MODE chip (mobile-bar parity): a 120x24 candy pill above the banner
   *  row, hidden by default, shown by setDemo(true). */
  private demoBadge!: Node;
  private buildDemoBadge(): void {
    const x = 1140;
    const y = 104; // nudged down into the slim slab so the chip clears the top edge
    const w = 120;
    const h = 24;
    const n = this.localNode(this.node, x, this.Y(y), w, h);
    const g = n.addComponent(Graphics);
    g.fillColor = col(C.panel);
    g.roundRect(-w / 2, -h / 2, w, h, 12);
    g.fill();
    g.lineWidth = 1.1;
    g.strokeColor = col(C.edge);
    g.roundRect(-w / 2, -h / 2, w, h, 12);
    g.stroke();
    this.lbl('DEMO MODE', 0, 0, 11, C.cur, true, n, 0.5);
    n.active = false;
    this.demoBadge = n;
  }

  private Y(y: number): number {
    return CROP - y; // crop the dead top band: design-y CROP -> node top edge (0)
  }

  private gfx(name: string, parent: Node = this.node): Graphics {
    const n = new Node(name);
    n.layer = this.node.layer;
    parent.addChild(n);
    const ui = n.addComponent(UITransform);
    ui.setAnchorPoint(0, 1);
    ui.setContentSize(W, H);
    return n.addComponent(Graphics);
  }

  private lbl(
    text: string,
    x: number,
    y: number,
    size: number,
    color: string,
    bold = true,
    parent: Node = this.node,
    ax = 0,
  ): Label {
    const n = new Node('t');
    n.layer = this.node.layer;
    parent.addChild(n);
    const ui = n.addComponent(UITransform);
    ui.setContentSize(10, 10);
    // Explicit anchor: ax=0 left / 0.5 centered / 1 right, vertically centred.
    // (The default 0.5 anchor stacked every readout centred on its x — the
    // owner's "elements rendering broken" report.)
    ui.setAnchorPoint(ax, 0.5);
    n.setPosition(x, this.Y(y), 0);
    const l = n.addComponent(Label);
    l.string = text;
    const fs = Math.round(size * FS);
    l.fontSize = fs;
    l.lineHeight = fs + 4;
    l.isBold = bold;
    l.color = col(color);
    applyFont(l, color === C.value ? 'display' : 'body');
    return l;
  }

  /** Master-grade candy panel: 3-stop body ramp + glossy top sheen + bright
   *  inner highlight band + cyan glass inner stroke + hot magenta outer rim. */
  private panel(g: Graphics, x: number, y: number, w: number, h: number, r: number): void {
    // Base dark fill.
    g.fillColor = col('#19103e');
    g.roundRect(x, this.Y(y + h), w, h, r);
    g.fill();
    // Mid stop (warmer violet) covering the upper half — sells the gradient.
    g.fillColor = col(C.panel, 0.92);
    g.roundRect(x + 1, this.Y(y + h - 1), w - 2, h * 0.62, Math.max(2, r - 1));
    g.fill();
    // Brighter top wash for the candy "lit-from-above" read.
    g.fillColor = col(C.panelHi, 0.65);
    g.roundRect(x + 2, this.Y(y + h * 0.48), w - 4, h * 0.46, Math.max(2, r - 4));
    g.fill();
    // Master gloss sheen — a thin bright band along the top inner curve.
    g.fillColor = col('#ffffff', 0.18);
    g.roundRect(x + 3, this.Y(y + h * 0.32), w - 6, h * 0.16, Math.max(2, r - 4));
    g.fill();
    g.fillColor = col('#ffffff', 0.08);
    g.roundRect(x + 3, this.Y(y + h * 0.48), w - 6, h * 0.18, Math.max(2, r - 4));
    g.fill();
    // Cyan glass inner stroke — the "dispersion rim" master signature.
    g.lineWidth = 1.4;
    g.strokeColor = col(C.cyan, 0.28);
    g.roundRect(x + 2, this.Y(y + h - 2), w - 4, h - 4, Math.max(2, r - 1));
    g.stroke();
    // Hot magenta outer rim, slightly thicker for crisper edges at small scales.
    g.lineWidth = 2.4;
    g.strokeColor = col(C.edge);
    g.roundRect(x + 1, this.Y(y + h - 1), w - 2, h - 2, Math.max(2, r - 1));
    g.stroke();
    // Soft drop shadow under the panel — Graphics has no blur, so layered
    // alpha rects approximate it: a 6px-tall fade beneath the panel.
    for (let k = 1; k <= 3; k++) {
      g.fillColor = col('#000000', 0.06 - k * 0.012);
      g.roundRect(x + k, this.Y(y + h + k * 2), w - 2 * k, 2, r);
      g.fill();
    }
  }

  /** Invisible hit region. `visuals` get the master press feedback: scale-in
   *  0.94 on touch, spring back on release (Emil's highest-ROI micro-interaction).
   *  Every tap also emits ui:click for the controller's click sample — except
   *  `silent` surfaces (the carousel: drag-end already feeds audio via bet:set). */
  /** Task 2.5 — cached cubic-bezier ease used by every bar button. Recomputed
   *  only if the bar.buttons.ease tuple changes. */
  private __easeCache: {
    tuple: readonly [number, number, number, number] | null;
    fn: (t: number) => number;
  } = { tuple: null, fn: (t) => t };
  private getButtonEase(): (t: number) => number {
    const tuple = VIEW_CONFIG.bar.buttons.ease;
    if (this.__easeCache.tuple !== tuple) {
      this.__easeCache.tuple = tuple;
      this.__easeCache.fn = cubicBezier(tuple[0], tuple[1], tuple[2], tuple[3]);
    }
    return this.__easeCache.fn;
  }

  private hitNode(
    x: number,
    y: number,
    w: number,
    h: number,
    cb: () => void,
    visuals: Node[] = [],
    silent = false,
  ): Node {
    const n = new Node('hit');
    n.layer = this.node.layer;
    this.node.addChild(n);
    const ui = n.addComponent(UITransform);
    ui.setAnchorPoint(0, 1);
    ui.setContentSize(w, h);
    n.setPosition(x, this.Y(y), 0);

    // Task 2.5 — formal 4-state machine. The bar button cycles between idle /
    // hover / pressed / disabled. Each transition tweens the visual scale via
    // a cached cubic-bezier ease so the feel matches across every control.
    // Hover handlers gate behind enableHover + the touch-detection flag so
    // touch devices keep their native press-only behavior.
    let state: 'idle' | 'hover' | 'pressed' | 'disabled' = 'idle';
    let disabled = false;
    const targetScaleFor = (s: 'idle' | 'hover' | 'pressed' | 'disabled'): number => {
      const cfg = VIEW_CONFIG.bar.buttons;
      switch (s) {
        case 'pressed':
          return cfg.pressScale;
        case 'hover':
          return cfg.hoverScale;
        case 'disabled':
          return 1.0;
        default:
          return 1.0;
      }
    };
    const durFor = (from: typeof state, to: typeof state): number => {
      const cfg = VIEW_CONFIG.bar.buttons;
      if (to === 'pressed') return cfg.pressMs / 1000;
      if (to === 'idle' && from === 'pressed') return cfg.releaseMs / 1000;
      return cfg.hoverMs / 1000;
    };
    const apply = (next: typeof state) => {
      if (state === next) return;
      const prev = state;
      state = next;
      const target = targetScaleFor(next);
      const dur = durFor(prev, next);
      const ease = this.getButtonEase();
      // Premium glow: hover = soft bloom, pressed = hot, idle/disabled = off.
      const glowTarget = next === 'pressed' ? 235 : next === 'hover' ? 150 : 0;
      visuals.forEach((v) => {
        Tween.stopAllByTarget(v);
        tween(v)
          .to(dur, { scale: new Vec3(target, target, 1) }, { easing: ease })
          .start();
        const gop = (v as unknown as { __glowOp?: UIOpacity }).__glowOp;
        if (gop) {
          Tween.stopAllByTarget(gop);
          tween(gop).to(dur, { opacity: glowTarget }).start();
        }
      });
    };

    n.on(Node.EventType.MOUSE_ENTER, () => {
      if (!VIEW_CONFIG.bar.buttons.enableHover || __touchDetected || disabled) return;
      if (state === 'idle') apply('hover');
    });
    n.on(Node.EventType.MOUSE_LEAVE, () => {
      if (disabled || state === 'pressed') return;
      apply('idle');
    });
    n.on(Node.EventType.TOUCH_START, () => {
      __touchDetected = true; // session-wide latch: future MOUSE events drop
      if (disabled) return;
      apply('pressed');
    });
    n.on(Node.EventType.TOUCH_CANCEL, () => {
      if (disabled) return;
      apply('idle');
    });
    n.on(Node.EventType.TOUCH_END, () => {
      if (disabled) return;
      // If still hovered (cursor stayed over the button), return to hover —
      // else back to idle. Cocos doesn't track "is currently inside" cheaply,
      // so default to idle; the next MOUSE_ENTER on re-hover re-enables it.
      apply(VIEW_CONFIG.bar.buttons.enableHover && !__touchDetected ? 'hover' : 'idle');
      if (!silent) this.events.emit('ui:click');
      cb();
    });

    // Disabled flag — gate set externally via the `(n as any).setDisabled(on)`
    // attached below. Future setters on the bar (setSpinning, setAutoplay)
    // can flip it for spin/bonus gating.
    (n as unknown as { setDisabled: (on: boolean) => void }).setDisabled = (on: boolean) => {
      if (disabled === on) return;
      disabled = on;
      apply(on ? 'disabled' : 'idle');
    };
    return n;
  }

  private buildAccount(): void {
    const g = this.gfx('account');
    this.panel(g, 40, 148, 440, 76, 38);
    // Menu hamburger — authored icon with the drawn lines as fallback (own node
    // so the icon can retire it; the account panel Graphics stays untouched).
    const menuGlyph = this.gfx('menuGlyph');
    [27, 38, 49].forEach((dy) => {
      menuGlyph.moveTo(80, this.Y(148 + dy));
      menuGlyph.lineTo(110, this.Y(148 + dy));
    });
    menuGlyph.lineWidth = 3.2;
    menuGlyph.strokeColor = col(C.icon);
    menuGlyph.stroke();
    this.icon(this.node, 95, this.Y(186), 40, 'ic_menu', C.icon, () => {
      menuGlyph.node.active = false;
    });
    this.hitNode(60, 148, 70, 76, () => this.events.emit('menu'));

    const snd = this.gfx('snd');
    // Cleaner speaker cone (back box + triangle) + TWO concentric right-facing
    // wave arcs (was a single rough chevron). Centred ~design (158,186).
    snd.fillColor = col(C.icon);
    snd.moveTo(150, this.Y(182));
    snd.lineTo(156, this.Y(182));
    snd.lineTo(165, this.Y(173));
    snd.lineTo(165, this.Y(199));
    snd.lineTo(156, this.Y(190));
    snd.lineTo(150, this.Y(190));
    snd.close();
    snd.fill();
    snd.lineWidth = 2.3;
    snd.strokeColor = col(C.icon);
    snd.arc(168, this.Y(186), 6, -0.82, 0.82, false);
    snd.stroke();
    snd.arc(168, this.Y(186), 11, -0.72, 0.72, false);
    snd.stroke();
    this.sndGlyphOp = snd.node.addComponent(UIOpacity);
    // Authored speaker icon — child of the snd node so setSoundOn's opacity dim
    // cascades; the drawn cone clears once the frame lands.
    this.icon(snd.node, 163, this.Y(186), 38, 'ic_sound', C.icon, () => snd.clear());
    const slash = this.gfx('sndSlash');
    slash.lineWidth = 3;
    slash.strokeColor = col(C.icon);
    slash.moveTo(146, this.Y(172));
    slash.lineTo(174, this.Y(200));
    slash.stroke();
    this.sndSlash = slash.node;
    this.sndSlash.active = false;
    this.hitNode(140, 160, 44, 52, () => this.toggleVolPanel());

    // Stronger account divider — alpha 0.3 was washing out at scale 0.53.
    g.lineWidth = 2;
    g.strokeColor = col(C.divider, 0.6);
    g.moveTo(210, this.Y(160));
    g.lineTo(210, this.Y(212));
    g.stroke();
    // Hairline highlight on the right side of the divider for depth.
    g.lineWidth = 1;
    g.strokeColor = col('#ffffff', 0.15);
    g.moveTo(211, this.Y(160));
    g.lineTo(211, this.Y(212));
    g.stroke();

    this.lbl('BALANCE', 232, 167, 17, C.label);
    this.balValue = this.lbl('0.00', 232, 195, 28, C.value);
    this.make3D(this.balValue);
    this.balCur = this.lbl('USD', 330, 200, 16, C.cur, false);
  }

  private banners: { x: number; w: number; cap: Label; val: Label }[] = [];

  private buildBanner(x: number, w: number, label: string, sink: (l: Label) => void): void {
    const g = this.gfx('banner_' + label);
    g.fillColor = col(C.banner);
    g.roundRect(x, this.Y(224), w, 76, 38);
    g.fill();
    g.fillColor = col('#ffffff', 0.08);
    g.roundRect(x + 2.5, this.Y(180), w - 5, 30, 34);
    g.fill();
    g.lineWidth = 2;
    g.strokeColor = col(C.edge);
    g.roundRect(x + 1, this.Y(223), w - 2, 74, 37);
    g.stroke();
    const cap = this.lbl(label, x + w / 2 - 7, 186, 18, C.label);
    const val = this.lbl('0.00', x + w / 2 + 7, 186, 27, C.value);
    this.banners.push({ x, w, cap, val });
    sink(val);
  }

  /** Master relayout(): measure caption+value, centre them as a PAIR on the
   *  panel, shrink the value to fit — long amounts never escape the banner. */
  private relayoutBanners(): void {
    for (const b of this.banners) {
      b.val.node.setScale(1, 1, 1);
      b.cap.updateRenderData(true);
      b.val.updateRenderData(true);
      const capW = b.cap.node.getComponent(UITransform)!.width;
      let valW = b.val.node.getComponent(UITransform)!.width;
      const maxV = b.w - 24 - capW - 14;
      if (valW > maxV && maxV > 12) {
        const k = maxV / valW;
        b.val.node.setScale(k, k, 1);
        valW = maxV;
      }
      const left = b.x + b.w / 2 - (capW + 14 + valW) / 2;
      b.cap.node.setPosition(left, this.Y(186), 0);
      b.val.node.setPosition(left + capW + 14, this.Y(186), 0);
    }
  }

  private buildCarousel(): void {
    // 2026-06-15 v2 (owner: "carousel STILL empty / not centred") — the narrow
    // window (SW=460) was the WRONG fix: a narrow centred window mathematically
    // ALWAYS shows a void when the active bet is near a ladder end, and the default
    // bet IS index 0, so half the window was always empty. Reverted to the WIDE
    // reference window: SW=800 (mask 776 ≈ all 6 levels visible at once) + edge
    // cells that fade-but-never-vanish (view-config fadeOpacity floor 120). Now the
    // window always reads FULL with the active pill centred — no void at any index.
    const SX = 1080;
    const SW = 800;
    const g = this.gfx('selector');
    this.panel(g, SX, 148, SW, 76, 38);
    g.fillColor = col(C.activeLo);
    g.roundRect(SX + SW / 2 - 62, this.Y(216), 124, 60, 30);
    g.fill();
    g.fillColor = col(C.active);
    g.roundRect(SX + SW / 2 - 62, this.Y(190), 124, 32, 26);
    g.fill();
    g.fillColor = col(C.activeHi, 0.5);
    g.roundRect(SX + SW / 2 - 58, this.Y(176), 116, 14, 10);
    g.fill();
    g.lineWidth = 2;
    g.strokeColor = col(C.pillStroke);
    g.roundRect(SX + SW / 2 - 62, this.Y(216), 124, 60, 30);
    g.stroke();

    const maskNode = new Node('carMask');
    maskNode.layer = this.node.layer;
    this.node.addChild(maskNode);
    const mui = maskNode.addComponent(UITransform);
    mui.setAnchorPoint(0, 1);
    mui.setContentSize(SW - 24, 60);
    maskNode.setPosition(SX + 12, this.Y(156), 0);
    const mask = maskNode.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;

    const track = new Node('carTrack');
    track.layer = this.node.layer;
    maskNode.addChild(track);
    track.addComponent(UITransform).setContentSize(10, 10);
    this.track = track;

    const sel = this.hitNode(SX, 148, SW, 76, () => undefined, [], true);
    sel.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
      this.dragging = true;
      this.moved = 0;
      this.dragX = e.getUILocation().x;
      Tween.stopAllByTarget(this.track);
    });
    sel.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
      if (!this.dragging) return;
      const x = e.getUILocation().x;
      const dx = (x - this.dragX) / (this.node.scale.x || 1);
      this.dragX = x;
      this.moved += Math.abs(dx);
      const n = this.levels.length;
      const nx = this.track.position.x + dx;
      // Rubber-band clamp: at most one cell of overscroll past either end so a
      // fling can NEVER drag the whole strip out of the mask and leave a blank
      // window (the owner's "empty space bug in the quick bets carousel"). The
      // ends now feel like a soft wall instead of an empty void.
      if (n > 0) {
        const lo = this.trackXFor(n - 1) - this.CELLW;
        const hi = this.trackXFor(0) + this.CELLW;
        this.track.setPosition(Math.max(lo, Math.min(hi, nx)), this.track.position.y, 0);
      } else {
        this.track.setPosition(nx, this.track.position.y, 0);
      }
    });
    const end = () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.snapNearest(true);
    };
    sel.on(Node.EventType.TOUCH_END, end);
    sel.on(Node.EventType.TOUCH_CANCEL, end);
  }

  // Task 2.3 — carousel cellW/pillCenterX promoted to bar.web.carousel tunables.
  // Read-once at access time so designers can hot-tune in view-config.ts.
  private get CELLW(): number {
    return VIEW_CONFIG.bar.web.carousel.cellW;
  }
  /** Pill centre in TRACK space: selector centre minus the 12px mask inset. */
  private get PCX(): number {
    return VIEW_CONFIG.bar.web.carousel.pillCenterX;
  }
  private trackXFor(i: number): number {
    return this.PCX - (i * this.CELLW + this.CELLW / 2);
  }
  private nearestIdx(): number {
    if (this.levels.length === 0) return 0; // never emit a negative phantom index
    const i = Math.round((this.PCX - this.track.position.x - this.CELLW / 2) / this.CELLW);
    return Math.max(0, Math.min(this.levels.length - 1, i));
  }
  private restyleCells(): void {
    // Task 2.3 — fadeScale/fadeOpacity drive the L→R falloff. Index by clamped
    // distance from the active cell so distance>=3 always uses the last (=0
    // alpha) bucket — kills the carousel half-clip past the mask edge.
    const fcfg = VIEW_CONFIG.bar.web.carousel;
    const scales = fcfg.fadeScale;
    const ops = fcfg.fadeOpacity;
    const last = Math.min(scales.length, ops.length) - 1;
    this.cells.forEach((c, i) => {
      const d = Math.abs(i - this.activeIdx);
      const k = Math.min(d, last);
      const on = d === 0;
      // Active bet amount = WHITESMOKE (owner: dark text on the pink pill read as a
      // colour bug / hard to read). Inactive cells keep the standard value colour.
      c.color = on ? col('#f5f5f5') : col(C.value);
      c.node.setScale(scales[k]!, scales[k]!, 1);
      const op = c.node.getComponent(UIOpacity) ?? c.node.addComponent(UIOpacity);
      op.opacity = ops[k]!;
    });
  }
  private snapNearest(emit: boolean): void {
    const i = this.nearestIdx();
    const changed = i !== this.activeIdx;
    this.activeIdx = i;
    tween(this.track)
      .to(
        0.32,
        { position: new Vec3(this.trackXFor(i), this.track.position.y, 0) },
        { easing: 'backOut' },
      )
      .call(() => this.restyleCells())
      .start();
    this.restyleCells();
    if (emit && changed) this.events.emit('bet:set', i);
  }

  /** Child node with its own Graphics in LOCAL space (y-up, origin = centre). */
  private localNode(parent: Node, x: number, y: number, w: number, h: number): Node {
    const n = new Node('n');
    n.layer = this.node.layer;
    parent.addChild(n);
    const ui = n.addComponent(UITransform);
    ui.setAnchorPoint(0.5, 0.5);
    ui.setContentSize(w, h);
    n.setPosition(x, y, 0);
    return n;
  }

  /** ICON SET — replaces the hand-drawn vector glyphs with the authored
   *  `resources/icons/ic_*.png` sprites (white art, tinted per control). Loads
   *  async; the node stays hidden until the frame lands and `onReady` then
   *  retires the Graphics fallback — a missing/failed icon keeps the vector
   *  glyph, so the bar can never render glyph-less. */
  private icon(
    parent: Node,
    x: number,
    y: number,
    size: number,
    name: string,
    tint: string,
    onReady?: () => void,
  ): Node {
    const n = this.localNode(parent, x, y, size, size);
    n.name = name;
    const sp = n.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.type = Sprite.Type.SIMPLE;
    sp.color = col(tint);
    n.active = false;
    resources.load(`icons/${name}/spriteFrame`, SpriteFrame, (err, sf) => {
      if (!err && sf && n.isValid) {
        sp.spriteFrame = sf;
        n.active = true;
        onReady?.();
      }
    });
    return n;
  }

  private buildRightCluster(): void {
    // Every control is its OWN centred node (master container-per-button): press
    // feedback scales the button, not the shared canvas; state dimming hits the
    // glyph child, not the circle base.
    const circleBtn = (cx: number, cy: number, r: number): { node: Node; g: Graphics } => {
      const n = this.localNode(this.node, cx, this.Y(cy), r * 2, r * 2);
      // Premium hover/press GLOW ring — candy-pink bloom drawn UNDER the face,
      // hidden at rest. hitNode's state machine fades it via the __glowOp handle
      // (hover dim / pressed hot / idle off), composing with the scale feedback.
      const glowN = this.localNode(n, 0, 0, (r + 12) * 2, (r + 12) * 2);
      const gg = glowN.addComponent(Graphics);
      for (let k = 6; k >= 1; k--) {
        gg.fillColor = col(C.active, 0.05);
        gg.circle(0, 0, r + 1 + k * 1.8);
        gg.fill();
      }
      gg.fillColor = col(C.activeHi, 0.18);
      gg.circle(0, 0, r + 2);
      gg.fill();
      const glowOp = glowN.addComponent(UIOpacity);
      glowOp.opacity = 0;
      (n as unknown as { __glowOp: UIOpacity }).__glowOp = glowOp;
      const g = n.addComponent(Graphics);
      g.fillColor = col(C.panel);
      g.circle(0, 0, r);
      g.fill();
      g.fillColor = col(C.panelHi, 0.5);
      g.circle(-r * 0.18, r * 0.3, r * 0.62);
      g.fill();
      g.lineWidth = 1.8;
      g.strokeColor = col(C.edge, 0.92);
      g.circle(0, 0, r - 1);
      g.stroke();
      return { node: n, g };
    };

    // Task 2.2 — coins cluster + ×2 gamble button spacing driven by tunables.
    // gambleGapPx is the horizontal gap between coins.cx and gamble.cx; default
    // 110 matches the legacy layout exactly so no visual change at default.
    const barCfg2 = VIEW_CONFIG.bar.web;
    const coinsX = 1980 + barCfg2.clusterCoinsX;
    const gambleX = coinsX + barCfg2.gambleGapPx;
    const coins = circleBtn(coinsX, 186, 38);
    // Quick-bet menu → authored gold coin-stack icon; the drawn stack lives on
    // its own child glyph as the fallback (retired when the icon frame lands).
    const coinGlyph = this.localNode(coins.node, 0, 0, 60, 60);
    const cg = coinGlyph.addComponent(Graphics);
    const drawCoin = (cy: number): void => {
      const rx = 20,
        ry = 7.5;
      cg.fillColor = col('#7a4a06'); // edge / thickness band
      cg.ellipse(0, cy - 3.4, rx, ry);
      cg.fill();
      cg.fillColor = col('#ffce47'); // gold face
      cg.ellipse(0, cy, rx, ry);
      cg.fill();
      cg.lineWidth = 1.3; // amber rim
      cg.strokeColor = col('#b9760c');
      cg.ellipse(0, cy, rx, ry);
      cg.stroke();
      cg.fillColor = col('#fff4c4', 0.85); // top sheen
      cg.ellipse(-rx * 0.28, cy + ry * 0.34, rx * 0.4, ry * 0.32);
      cg.fill();
    };
    drawCoin(-11);
    drawCoin(-1);
    drawCoin(9);
    cg.fillColor = col('#fffbe8');
    cg.circle(11, 13, 1.7);
    cg.fill();
    this.icon(coins.node, 0, 0, 46, 'ic_coins', '#ffce47', () => {
      coinGlyph.active = false;
    });
    this.hitNode(coinsX - 38, 148, 76, 76, () => this.events.emit('betmenu'), [coins.node]);

    const gamble = circleBtn(gambleX, 186, 38);
    // lbl() applies the Y() design-space crop; inside a LOCAL centred node that
    // shoves the glyph CROP(=78)px up (the "×2 floats above its circle" bug). Pin
    // it back to local origin so it sits centred in the button.
    const x2lbl = this.lbl('×2', 0, 0, 25, C.value, true, gamble.node, 0.5);
    x2lbl.node.setPosition(0, 0, 0);
    this.hitNode(gambleX - 38, 148, 76, 76, () => this.events.emit('bet:double'), [gamble.node]);

    const turbo = circleBtn(2200, 150, 30);
    const tGlyph = this.localNode(turbo.node, 0, 0, 30, 30);
    const tg = tGlyph.addComponent(Graphics);
    // Gold lightning bolt (was flat pink) → reads as "speed / electric". Filled
    // gold face + amber edge for a crisp premium glyph.
    const boltPath = (): void => {
      tg.moveTo(4, 13);
      tg.lineTo(-9, -2);
      tg.lineTo(-1, -2);
      tg.lineTo(-5, -14);
      tg.lineTo(9, 3);
      tg.lineTo(1, 3);
      tg.close();
    };
    tg.fillColor = col('#ffd23f');
    boltPath();
    tg.fill();
    tg.lineWidth = 1.4;
    tg.strokeColor = col('#8a5200');
    boltPath();
    tg.stroke();
    this.turboGlyphOp = tGlyph.addComponent(UIOpacity);
    // Authored bolt icon — child of tGlyph so setTurbo's opacity dim cascades.
    this.icon(tGlyph, 0, 0, 36, 'ic_bolt', '#ffd23f', () => tg.clear());
    const pip = this.localNode(turbo.node, 13, 13, 12, 12);
    const pg = pip.addComponent(Graphics);
    pg.fillColor = col('#e9bf5a');
    pg.circle(0, 0, 5);
    pg.fill();
    pip.active = false;
    this.turboPip = pip;
    this.hitNode(2170, 120, 60, 60, () => this.events.emit('turbo'), [turbo.node]);

    const auto = circleBtn(2200, 222, 30);
    const aGlyph = this.localNode(auto.node, 0, 0, 30, 30);
    const ag2 = aGlyph.addComponent(Graphics);
    // Brighter, crisper loop arrow (was a dim #e0a0ff). White-lilac reads clean
    // on the dark circle and matches the premium gold turbo beside it.
    ag2.lineWidth = 3.4;
    ag2.strokeColor = col('#f4e6ff');
    ag2.arc(0, 0, 12, -1.23, -1.91 + Math.PI * 2, true);
    ag2.stroke();
    ag2.fillColor = col('#f4e6ff');
    ag2.moveTo(3, 14);
    ag2.lineTo(-3, 7);
    ag2.lineTo(-6, 16);
    ag2.close();
    ag2.fill();
    // Authored loop-arrow icon — child of aGlyph so setAutoplay's toggle cascades.
    this.icon(aGlyph, 0, 0, 40, 'ic_autoplay', '#f4e6ff', () => ag2.clear());
    this.autoGlyph = aGlyph;
    this.autoCount = this.lbl('', 0, 0, 22, C.value, true, auto.node, 0.5);
    this.autoCount.node.setPosition(0, 0, 0); // same local-origin pin as ×2
    this.autoCount.node.active = false;
    this.hitNode(2170, 192, 60, 60, () => this.events.emit('autoplay'), [auto.node]);

    const R = 70;
    // The spin ring lives in a wider container so its OUTER halo doesn't clip.
    const ring = this.localNode(this.node, 2330, this.Y(186), R * 2.8, R * 2.8);
    this.spinRing = ring;

    // ── Ambient halo (HU6 clean): many thin low-alpha rings instead of 6 chunky
    //    discs — the cumulative alpha reads as ONE smooth candy-pink bloom, not
    //    concentric bands. A breathing UIOpacity gives it life. Sells the spin
    //    ring as the hero control without the "dirty ring" the discs produced.
    const haloN = this.localNode(ring, 0, 0, R * 2.8, R * 2.8);
    const haloG = haloN.addComponent(Graphics);
    for (let k = 16; k >= 1; k--) {
      haloG.fillColor = col(C.active, 0.018);
      haloG.circle(0, 0, R + 2 + k * 2.2);
      haloG.fill();
    }
    haloG.fillColor = col(C.activeHi, 0.16);
    haloG.circle(0, 0, R + 3);
    haloG.fill();
    const haloOp = haloN.addComponent(UIOpacity);
    haloOp.opacity = 180;
    tween(haloOp)
      .to(1.4, { opacity: 235 }, { easing: 'sineInOut' })
      .to(1.4, { opacity: 150 }, { easing: 'sineInOut' })
      .union()
      .repeatForever()
      .start();

    // ── Ring body: CONCENTRIC annuli (all centred at 0,0 → perfectly circular,
    //    no offset-disc banding/muddy crescents). A stepped colour lerp from a
    //    bright outer tint to a darker inner tint fakes a smooth 3D bevel.
    const bodyN = this.localNode(ring, 0, 0, R * 2, R * 2);
    this.spinBody = bodyN;
    const rg = bodyN.addComponent(Graphics);
    const INNER = R * 0.74;
    const cHi = col(C.ringHi);
    const cLo = col(C.ringLo);
    const STEPS = 10;
    for (let k = 0; k < STEPS; k++) {
      const t = k / (STEPS - 1);
      const lc = new Color();
      Color.lerp(lc, cHi, cLo, t);
      rg.fillColor = lc;
      rg.circle(0, 0, R - t * (R * 0.1));
      rg.fill();
    }
    // Candy-pink ring track — the band read as "the ring".
    rg.fillColor = col(C.ringMid);
    rg.circle(0, 0, R * 0.94);
    rg.fill();
    // Dark glass face for glyph contrast.
    rg.fillColor = col(C.spinFace);
    rg.circle(0, 0, INNER);
    rg.fill();
    // Crisp edges — FULL circles (no top/bottom arc seam): bright outer rim +
    // dark inner face shadow.
    rg.lineWidth = 2;
    rg.strokeColor = col(C.centerRim, 0.9);
    rg.circle(0, 0, R * 0.94);
    rg.stroke();
    rg.lineWidth = 2;
    rg.strokeColor = col('#000000', 0.35);
    rg.circle(0, 0, INNER);
    rg.stroke();
    // One crisp top sheen on the face (Y-up: +y is the visual top).
    rg.fillColor = col('#ffffff', 0.22);
    rg.ellipse(0, R * 0.4, R * 0.5, R * 0.14);
    rg.fill();

    const arrowNode = this.localNode(ring, 0, 0, R, R);
    const ag = arrowNode.addComponent(Graphics);
    const ar = R * 0.4;
    // dark under-stroke halo first → crisp contrast on the dark face
    ag.lineWidth = R * 0.16;
    ag.strokeColor = col('#000000', 0.4);
    ag.arc(0, 0, ar, -1.206, -1.936 + Math.PI * 2, true);
    ag.stroke();
    ag.lineWidth = R * 0.13;
    ag.strokeColor = col(C.value);
    ag.arc(0, 0, ar, -1.206, -1.936 + Math.PI * 2, true);
    ag.stroke();
    ag.fillColor = col(C.value);
    ag.moveTo(0, ar + R * 0.06);
    ag.lineTo(-R * 0.135, ar - R * 0.07);
    ag.lineTo(-R * 0.2, ar + R * 0.1);
    ag.close();
    ag.fill();
    // Authored double-arrow spin icon — child of arrowNode so the press-spin
    // rotation tween carries it; the drawn arc clears when the frame lands.
    this.icon(arrowNode, 0, 0, R * 1.05, 'ic_spin', C.value, () => ag.clear());
    this.spinArrow = arrowNode;

    const stopNode = this.localNode(ring, 0, 0, R, R);
    const sg = stopNode.addComponent(Graphics);
    sg.fillColor = col('#000000', 0.4); // under-fill for a crisp edge
    sg.roundRect(-R * 0.28, -R * 0.28, R * 0.56, R * 0.56, R * 0.14);
    sg.fill();
    sg.fillColor = col(C.value, 0.98);
    sg.roundRect(-R * 0.26, -R * 0.26, R * 0.52, R * 0.52, R * 0.12);
    sg.fill();
    stopNode.active = false;
    this.spinStop = stopNode;

    this.spinOp = ring.addComponent(UIOpacity);
    this.hitNode(
      2330 - R,
      186 - R,
      R * 2,
      R * 2,
      () => {
        if (!this.spinStop.active) {
          Tween.stopAllByTarget(this.spinArrow);
          this.spinArrow.angle = 0;
          tween(this.spinArrow)
            .to(0.7, { angle: -360 }, { easing: 'quadOut' })
            .call(() => (this.spinArrow.angle = 0))
            .start();
        }
        this.events.emit('spin');
      },
      [ring],
    );
    this.startSpinBreathe(); // CTA never looks dead at rest (roadmap P0 #4)
  }

  /** Idle "rest breathing" on the spin CTA — a slow 4s sine scale (1.0↔1.015) on
   *  the inner disc so the primary control feels alive between spins. Runs on
   *  spinBody (a child) so it composes with, never fights, the ring press-squash.
   *  Paused while spinning. (Schell "Lens of the Toy": the base game should feel
   *  alive to fidget with before any win.) */
  private reducedMotion = false;
  /** WCAG 2.3.3 — honor reduced-motion: stop the perpetual idle CTA breathe and
   *  make the win count-up instant (see setLastWin). Press/state feedback stays. */
  setReducedFx(on: boolean): void {
    this.reducedMotion = on;
    if (on) this.stopSpinBreathe();
    else this.startSpinBreathe();
  }
  private startSpinBreathe(): void {
    if (this.reducedMotion) return; // WCAG 2.3.3 — no perpetual idle motion
    if (!this.spinBody) return;
    Tween.stopAllByTarget(this.spinBody);
    this.spinBody.setScale(1, 1, 1);
    tween(this.spinBody)
      .to(2, { scale: new Vec3(1.015, 1.015, 1) }, { easing: 'sineInOut' })
      .to(2, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
      .union()
      .repeatForever()
      .start();
  }
  private stopSpinBreathe(): void {
    if (!this.spinBody) return;
    Tween.stopAllByTarget(this.spinBody);
    this.spinBody.setScale(1, 1, 1);
  }

  private buildVolumePanel(): void {
    const vp = new Node('volPanel');
    vp.layer = this.node.layer;
    this.node.addChild(vp);
    const ui = vp.addComponent(UITransform);
    ui.setAnchorPoint(0, 1);
    ui.setContentSize(240, 98);
    vp.setPosition(70, this.Y(10), 0);
    vp.active = false;
    this.volPanel = vp;
    this.volPanelOp = vp.addComponent(UIOpacity);
    const g = vp.addComponent(Graphics);
    g.fillColor = col(C.panel, 0.97);
    g.roundRect(0, -98, 240, 98, 20);
    g.fill();
    g.lineWidth = 2;
    g.strokeColor = col(C.edge);
    g.roundRect(1, -97, 238, 96, 19);
    g.stroke();
    g.fillColor = col(C.dark, 0.85);
    g.roundRect(60, -71, 154, 10, 5);
    g.fill();
    const cap = this.lbl('VOLUME', 20, 14, 16, C.label, true, vp);
    cap.node.setPosition(20, -14, 0);
    const close = this.lbl('✕', 218, 24, 18, C.icon, true, vp);
    close.node.setPosition(214, -22, 0);
    this.icon(vp, 214, -22, 18, 'ic_close', C.icon, () => {
      close.node.active = false;
    });
    const closeHit = new Node('vx');
    closeHit.layer = this.node.layer;
    vp.addChild(closeHit);
    closeHit.addComponent(UITransform).setContentSize(36, 36);
    closeHit.setPosition(216, -22, 0);
    closeHit.on(Node.EventType.TOUCH_END, () => this.toggleVolPanel());

    const fillNode = new Node('vfill');
    fillNode.layer = this.node.layer;
    vp.addChild(fillNode);
    fillNode.addComponent(UITransform).setContentSize(10, 10);
    this.volFill = fillNode.addComponent(Graphics);

    const knob = new Node('vknob');
    knob.layer = this.node.layer;
    vp.addChild(knob);
    knob.addComponent(UITransform).setContentSize(28, 28);
    const kg = knob.addComponent(Graphics);
    kg.fillColor = col(C.active);
    kg.circle(0, 0, 12);
    kg.fill();
    kg.lineWidth = 2;
    kg.strokeColor = col(C.pillStroke);
    kg.circle(0, 0, 12);
    kg.stroke();
    this.volKnob = knob;
    knob.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
      const s = this.node.scale.x || 1;
      this.applyVolume(this.volume + e.getDeltaX() / s / 154, true);
    });
    const mute = new Node('vmute');
    mute.layer = this.node.layer;
    vp.addChild(mute);
    mute.addComponent(UITransform).setContentSize(36, 36);
    mute.setPosition(34, -66, 0);
    const mg = mute.addComponent(Graphics);
    mg.fillColor = col(C.icon);
    mg.moveTo(-10, 5);
    mg.lineTo(-5, 5);
    mg.lineTo(1, 11);
    mg.lineTo(1, -11);
    mg.lineTo(-5, -5);
    mg.lineTo(-10, -5);
    mg.close();
    mg.fill();
    this.icon(mute, 0, 0, 26, 'ic_sound', C.icon, () => mg.clear());
    mute.on(Node.EventType.TOUCH_END, () =>
      this.applyVolume(this.volume > 0.001 ? 0 : this.lastNonZero, true),
    );
    this.redrawVolume();
  }

  /** Smooth open/close for the sound popup — pop-scale + fade in (backOut), fade
   *  + settle out, then deactivate. Replaces the old hard active toggle so the
   *  panel feels like a real menu transition. */
  private toggleVolPanel(): void {
    const vp = this.volPanel;
    const op = this.volPanelOp;
    const opening = !vp.active;
    Tween.stopAllByTarget(vp);
    Tween.stopAllByTarget(op);
    if (opening) {
      vp.active = true;
      vp.setScale(0.84, 0.84, 1);
      op.opacity = 0;
      tween(vp)
        .to(0.22, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
        .start();
      tween(op).to(0.16, { opacity: 255 }).start();
    } else {
      tween(vp)
        .to(0.14, { scale: new Vec3(0.9, 0.9, 1) }, { easing: 'quadIn' })
        .start();
      tween(op)
        .to(0.14, { opacity: 0 })
        .call(() => {
          vp.active = false;
          vp.setScale(1, 1, 1);
          op.opacity = 255;
        })
        .start();
    }
  }

  private redrawVolume(): void {
    this.volKnob.setPosition(60 + 154 * this.volume, -66, 0);
    this.volFill.clear();
    this.volFill.fillColor = col(C.active);
    this.volFill.roundRect(60, -71, Math.max(0.001, 154 * this.volume), 10, 5);
    this.volFill.fill();
  }

  private applyVolume(v: number, emit: boolean): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.volume > 0) this.lastNonZero = this.volume;
    this.redrawVolume();
    this.setSoundOn(this.volume > 0.001);
    if (emit) this.events.emit('volume', this.volume);
  }

  // ---- shared bar API ---------------------------------------------------------
  on(ev: string, cb: (...args: unknown[]) => void): this {
    this.events.on(ev, cb);
    return this;
  }

  /** Master fitBottom rule: WIDTH-fit (capped), docked to the screen bottom.
   *  Returns the board inset in screen px — the solid control band's height
   *  (the upper 118 design px is a soft gradient the reels may overlap). */
  /** Master fitBottom (width-fit, bottom-docked) — caps height so the bar never
   *  eats more than ~22% of viewport on tall screens; small ratio means the
   *  CONTROL band, not the whole 2400x300 surface, decides what the board may
   *  use. Returns the control-band height in screen px for the view inset. */
  fit(viewW: number, viewH: number): number {
    // Slimmer surface → relax the height cap (was 0.34/300) and raise the abs cap
    // a touch since the bar is shorter; keeps it dense, not chunky.
    // Width-fit to 90% of the viewport (owner: "web platform, add a gap from the
    // left/right sides") — the centred bar then sits inset from the screen edges
    // with a symmetric ~5% margin each side, reading more compact + premium than a
    // full-bleed bar. Still capped at 0.6 abs + ~32% of height.
    const s = Math.min((viewW * 0.9) / W, 0.6, (viewH * 0.32) / H);
    this.node.setScale(s, s, 1);
    this.node.setPosition(new Vec3((-W * s) / 2, -viewH / 2 + H * s, 0));
    // Reels reserve just enough to clear the spin-ring TOP (design RING_TOP),
    // with a 2px gap. The faint halo above the ring may bleed harmlessly behind
    // the reel band. Derived from the same CROP mapping so it tracks the slab.
    return (H - (RING_TOP - CROP) - 2) * s;
  }

  private fmt(n: number): string {
    // Currency-aware: symbol-prefixed amount (e.g. "$1.00"), per-currency decimals,
    // non-finite guarded to a clean "$0.00" (never "NaN"/"∞"). maxChars compacts
    // huge balances to K/M/B so the value never escapes the bar slot.
    return formatMoney(Number.isFinite(n) ? n : 0, this.currency, 9);
  }
  /** HU2 odometer driven by the COMPONENT SCHEDULER (Cocos tween on a plain
   *  object does not tick in this runtime — only Node tweens do — so the value
   *  count-up is a per-frame schedule() lerp instead). Ease-out, duration scales
   *  with the delta (log) + clamps; first-set / tiny deltas snap. */
  private counters: Record<string, { shown: number; cb: ((dt: number) => void) | null }> = {
    bal: { shown: 0, cb: null },
    win: { shown: 0, cb: null },
  };
  private countTo(id: string, to: number, render: (v: number) => void, instant = false): void {
    const c = this.counters[id];
    if (c.cb) {
      this.unschedule(c.cb);
      c.cb = null;
    }
    const from = c.shown;
    if (instant || Math.abs(to - from) < 0.005) {
      c.shown = to;
      render(to);
      return;
    }
    const dur = Math.min(1.5, 0.32 + Math.log10(Math.abs(to - from) + 1) * 0.5);
    let t = 0;
    const cb = (dt: number): void => {
      t += dt;
      const p = Math.min(1, t / dur);
      const e = 1 - (1 - p) * (1 - p); // quadOut
      render(from + (to - from) * e);
      if (p >= 1) {
        c.shown = to;
        render(to);
        if (c.cb) this.unschedule(c.cb);
        c.cb = null;
      }
    };
    c.cb = cb;
    this.schedule(cb, 0);
  }
  private balReady = false;
  private renderBalance(v: number): void {
    this.balValue.string = this.fmt(v);
    this.balValue.updateRenderData(true);
    const ut = this.balValue.node.getComponent(UITransform)!;
    const k = ut.width > 180 ? 180 / ut.width : 1;
    this.balValue.node.setScale(k, k, 1);
    this.balCur.node.setPosition(232 + ut.width * k + 10, this.Y(200), 0);
  }
  setBalance(n: number): void {
    this.countTo('bal', n, (v) => this.renderBalance(v), !this.balReady);
    this.balReady = true;
  }
  setCurrency(c: string): void {
    this.currency = c;
    // The symbol now rides on every amount (formatMoney), so the separate ISO
    // code beside the balance is redundant — clear it for the clean expert look
    // ("$100.00", not "$100.00 USD"). Re-render the balance through the new symbol.
    this.balCur.string = '';
    this.renderBalance(this.counters.bal.shown);
  }

  /** Faux-3D money text: a hard drop-shadow (extrude depth) + a dark glyph outline
   *  (crisp candy edge). Lifts the flat value labels off the bar so wins read as
   *  chunky/tactile, not printed — the owner's "win text more 3D" ask. */
  private make3D(l: Label): void {
    const ls = l.node.addComponent(LabelShadow);
    ls.color = col('#180527', 0.9);
    ls.offset = new Vec2(0, Math.round(-3 * FS));
    ls.blur = 2;
    const lo = l.node.addComponent(LabelOutline);
    lo.color = col('#2d0b40');
    lo.width = Math.max(1, Math.round(2 * FS));
  }
  setLastWin(n: number): void {
    // WCAG 2.3.3 — reduced-motion: skip the count-up + pop, set the value instantly.
    if (this.reducedMotion) {
      this.counters.win.shown = n;
      this.lastWinValue.string = this.fmt(n);
      this.relayoutBanners();
      return;
    }
    // Classic 0 -> win tick: reset the shown value so it always counts up.
    this.counters.win.shown = 0;
    this.countTo('win', n, (v) => {
      this.lastWinValue.string = this.fmt(v);
      this.relayoutBanners();
    });
    // HU8: a credited win pops + flashes the LAST WIN value so the win reads on
    // the bar, not just in the reel area (Node tween — these DO tick).
    if (n > 0) {
      const node = this.lastWinValue.node;
      Tween.stopAllByTarget(node);
      node.setScale(1, 1, 1);
      tween(node)
        .delay(0.05)
        .to(0.16, { scale: new Vec3(1.22, 1.22, 1) }, { easing: 'backOut' })
        .to(0.55, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' })
        .start();
      this.lastWinValue.color = col(C.activeHi);
      this.unschedule(this._winColorReset);
      this.scheduleOnce(this._winColorReset, 0.7);
    }
  }
  private _winColorReset = (): void => {
    this.lastWinValue.color = col(C.value);
  };
  setBet(n: number): void {
    this.totalBetValue.string = this.fmt(n);
    this.relayoutBanners();
  }
  setBetLevels(valuesCents: number[], activeIdx: number, fmt?: (v: number) => string): void {
    if (fmt) this.carFmt = fmt;
    const vals = valuesCents ?? [];
    const ai = Number.isFinite(activeIdx) ? activeIdx : 0;
    // Empty ladder → render nothing rather than a corrupt strip with a negative
    // active index (the old code let [] satisfy `same` and fall through, leaving
    // a phantom pill + negative bet:set). Defensive: the real ladder is never
    // empty, but a model/ladder mismatch must degrade cleanly.
    if (vals.length === 0) {
      this.track.removeAllChildren();
      this.cells = [];
      this.levels = [];
      this.activeIdx = 0;
      this.track.setPosition(this.trackXFor(0), 0, 0);
      return;
    }
    const same =
      this.levels.length > 0 &&
      this.levels.length === vals.length &&
      this.levels[0] === vals[0] &&
      this.levels[this.levels.length - 1] === vals[vals.length - 1];
    if (!same) {
      this.levels = vals.slice();
      this.track.removeAllChildren();
      this.cells = [];
      vals.forEach((v, i) => {
        const t = this.lbl(this.carFmt(v), 0, 0, 27, C.value, true, this.track);
        this.make3D(t);
        t.horizontalAlign = Label.HorizontalAlign.CENTER;
        t.node.getComponent(UITransform)!.setAnchorPoint(0.5, 0.5);
        t.node.setPosition(i * this.CELLW + this.CELLW / 2, -30, 0);
        this.cells.push(t);
      });
      this.activeIdx = Math.max(0, Math.min(vals.length - 1, ai));
      this.track.setPosition(this.trackXFor(this.activeIdx), 0, 0);
      this.restyleCells();
    } else if (!this.dragging) {
      // Clamp the update-branch index too (the rebuild branch already clamped):
      // a stray -1 from indexOf() on a ladder mismatch would tween to a phantom
      // off-window position and blank the carousel.
      const clamped = Math.max(0, Math.min(vals.length - 1, ai));
      if (clamped !== this.activeIdx) {
        this.activeIdx = clamped;
        tween(this.track)
          .to(0.3, { position: new Vec3(this.trackXFor(clamped), 0, 0) }, { easing: 'quadOut' })
          .call(() => this.restyleCells())
          .start();
        this.restyleCells();
      }
    }
  }
  setDemo(on: boolean): void {
    if (this.demoBadge) this.demoBadge.active = !!on;
  }
  /** Dress the spin control in the owner's real button art (over the vector ring). */
  setSpinArt(frame: SpriteFrame | null): void {
    if (!frame || !this.spinRing) return;
    const art = this.localNode(this.spinRing, 0, 0, 122, 122);
    const sp = art.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.spriteFrame = frame;
    art.setSiblingIndex(0);
  }
  setSoundOn(on: boolean): void {
    this.sndGlyphOp.opacity = on ? 255 : 128;
    this.sndSlash.active = !on;
  }
  setVolume(v: number): void {
    this.applyVolume(v, false);
  }
  setSpinning(on: boolean): void {
    if (on) this.volPanel.active = false;
    this.spinArrow.active = !on;
    this.spinStop.active = on;
    // Rest-breathe only while idle — a spinning CTA is already alive.
    if (on) this.stopSpinBreathe();
    else this.startSpinBreathe();
  }
  setAutoplay(count: number | null): void {
    const active = count != null && count !== 0;
    this.autoCount.string = count === Infinity ? '∞' : String(count ?? '');
    this.autoCount.node.active = active;
    this.autoGlyph.active = !active;
  }
  setTurbo(mode: number): void {
    this.turboGlyphOp.opacity = mode > 0 ? 255 : 115;
    this.turboPip.active = mode === 2;
  }
  setAffordable(on: boolean): void {
    this.spinOp.opacity = on ? 255 : 128;
  }
  setSteppers(): void {}
}
