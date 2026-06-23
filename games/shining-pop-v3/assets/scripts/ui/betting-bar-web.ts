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

const H = 214;
const CROP = 78;
const RING_TOP = 116;

const FS = 1.12;

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
  // Surface E (R12): caramel turbo signal (web keeps its dark outline below).
  caramel: '#ff9a3c',
  caramelLine: '#8a5200',
};
function col(hex: string, a?: number): Color {
  const c = new Color();
  Color.fromHEX(c, hex);
  if (a != null) c.a = Math.round(a * 255);
  return c;
}

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

let __touchDetected = false;

@ccclass('BettingBarWeb')
export class BettingBarWeb extends Component {
  private events = new EventTarget();

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
  private volScrim: Node | null = null;
  private volume = 0.5;
  private lastNonZero = 0.5;
  private spinArrow!: Node;
  private spinStop!: Node;
  private spinOp!: UIOpacity;
  private spinRing!: Node;
  private spinBody!: Node;
  private autoGlyph!: Node;
  private autoCount!: Label;
  private turboGlyphOp!: UIOpacity;
  private turboPip!: Node;
  private track!: Node;
  private pill!: Node;
  private cells: Label[] = [];
  private levels: number[] = [];
  private activeIdx = 0;
  private carFmt: (v: number) => string = (v) => String(v);
  private dragX = 0;
  private dragging = false;
  private moved = 0;
  private hitNodes: { n: Node; x: number; y: number; w: number; h: number }[] = [];

  onLoad(): void {
    const ui = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    ui.setContentSize(W, H);
    ui.setAnchorPoint(0, 1);

    const bg = this.gfx('bg');

    const barCfg = VIEW_CONFIG.bar.web;
    if (barCfg.bgBaseAlpha > 0) {
      bg.fillColor = col('#241652', barCfg.bgBaseAlpha);
      bg.rect(0, -H, W, H);
      bg.fill();
      bg.fillColor = col(C.stageDeep, barCfg.bgGroundAlpha);
      bg.rect(0, -H, W, Math.round(H * barCfg.bgGroundFrac));
      bg.fill();

      bg.lineWidth = 2;
      bg.strokeColor = col(C.edge, 0.55);
      bg.moveTo(0, 0);
      bg.lineTo(W, 0);
      bg.stroke();

      bg.fillColor = col('#ffffff', 0.06);
      bg.rect(0, -8, W, 8);
      bg.fill();
    }

    this.buildAccount();

    this.buildBanner(500, 300, 'LAST WIN', (l) => {
      this.lastWinValue = l;
      this.make3D(l);
    });
    this.buildBanner(830, 220, 'TOTAL BET', (l) => {
      this.totalBetValue = l;
      this.make3D(l);
    });
    this.relayoutBanners();
    this.buildCarousel();
    this.buildRightCluster();
    this.buildVolumePanel();
    this.buildDemoBadge();
  }

  private demoBadge!: Node;
  private buildDemoBadge(): void {
    const x = 1140;
    const y = 104;
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
    return CROP - y;
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

  private panel(g: Graphics, x: number, y: number, w: number, h: number, r: number): void {
    g.fillColor = col('#19103e');
    g.roundRect(x, this.Y(y + h), w, h, r);
    g.fill();

    g.fillColor = col(C.panel, 0.92);
    g.roundRect(x + 1, this.Y(y + h - 1), w - 2, h * 0.62, Math.max(2, r - 1));
    g.fill();

    g.fillColor = col(C.panelHi, 0.65);
    g.roundRect(x + 2, this.Y(y + h * 0.48), w - 4, h * 0.46, Math.max(2, r - 4));
    g.fill();

    g.fillColor = col('#ffffff', 0.18);
    g.roundRect(x + 3, this.Y(y + h * 0.32), w - 6, h * 0.16, Math.max(2, r - 4));
    g.fill();
    g.fillColor = col('#ffffff', 0.08);
    g.roundRect(x + 3, this.Y(y + h * 0.48), w - 6, h * 0.18, Math.max(2, r - 4));
    g.fill();

    g.lineWidth = 1.4;
    g.strokeColor = col(C.cyan, 0.28);
    g.roundRect(x + 2, this.Y(y + h - 2), w - 4, h - 4, Math.max(2, r - 1));
    g.stroke();

    g.lineWidth = 2.4;
    g.strokeColor = col(C.edge);
    g.roundRect(x + 1, this.Y(y + h - 1), w - 2, h - 2, Math.max(2, r - 1));
    g.stroke();

    for (let k = 1; k <= 3; k++) {
      g.fillColor = col('#000000', 0.06 - k * 0.012);
      g.roundRect(x + k, this.Y(y + h + k * 2), w - 2 * k, 2, r);
      g.fill();
    }
  }

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
    this.hitNodes.push({ n, x, y, w, h });

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
      __touchDetected = true;
      if (disabled) return;
      apply('pressed');
    });
    n.on(Node.EventType.TOUCH_CANCEL, () => {
      if (disabled) return;
      apply('idle');
    });
    n.on(Node.EventType.TOUCH_END, () => {
      if (disabled) return;

      apply(VIEW_CONFIG.bar.buttons.enableHover && !__touchDetected ? 'hover' : 'idle');
      if (!silent) this.events.emit('ui:click');
      cb();
    });

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

    g.lineWidth = 2;
    g.strokeColor = col(C.divider, 0.6);
    g.moveTo(210, this.Y(160));
    g.lineTo(210, this.Y(212));
    g.stroke();

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
    const SX = 1080;
    const SW = 800;
    const g = this.gfx('selector');
    this.panel(g, SX, 148, SW, 76, 38);

    const pillNode = new Node('carPill');
    pillNode.layer = this.node.layer;
    this.node.addChild(pillNode);
    pillNode.addComponent(UITransform);
    const pg = pillNode.addComponent(Graphics);
    pg.fillColor = col(C.activeLo);
    pg.roundRect(SX + SW / 2 - 62, this.Y(216), 124, 60, 30);
    pg.fill();
    pg.fillColor = col(C.active);
    pg.roundRect(SX + SW / 2 - 62, this.Y(190), 124, 32, 26);
    pg.fill();
    pg.fillColor = col(C.activeHi, 0.5);
    pg.roundRect(SX + SW / 2 - 58, this.Y(176), 116, 14, 10);
    pg.fill();
    pg.lineWidth = 2;
    pg.strokeColor = col(C.pillStroke);
    pg.roundRect(SX + SW / 2 - 62, this.Y(216), 124, 60, 30);
    pg.stroke();
    this.pill = pillNode;

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
      Tween.stopAllByTarget(this.pill);
    });
    sel.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
      if (!this.dragging) return;
      const n = this.levels.length;
      if (n === 0) return;
      const x = e.getUILocation().x;
      const dx = (x - this.dragX) / (this.node.scale.x || 1);
      this.dragX = x;
      this.moved += Math.abs(dx);
      const lo = this.pillXFor(0);
      const hi = this.pillXFor(n - 1);
      const px = Math.max(lo, Math.min(hi, this.pill.position.x + dx));
      this.pill.setPosition(px, this.pill.position.y, 0);
      const i = this.idxAtPillX(px);
      if (i !== this.activeIdx) {
        this.activeIdx = i;
        this.restyleCells();
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

  private get CELLW(): number {
    return VIEW_CONFIG.bar.web.carousel.cellW;
  }

  private get PCX(): number {
    return VIEW_CONFIG.bar.web.carousel.pillCenterX;
  }
  private trackXFor(i: number): number {
    return this.PCX - (i * this.CELLW + this.CELLW / 2);
  }
  private trackHome(): number {
    const n = this.levels.length;
    if (n === 0) return 0;
    const content = n * this.CELLW;
    return (2 * this.PCX - content) / 2;
  }
  private pillXFor(i: number): number {
    return this.trackHome() - this.trackXFor(i);
  }
  private idxAtPillX(px: number): number {
    if (this.levels.length === 0) return 0;
    const base = this.trackHome() - this.PCX + this.CELLW / 2;
    const i = Math.round((px - base) / this.CELLW);
    return Math.max(0, Math.min(this.levels.length - 1, i));
  }
  private nearestIdx(): number {
    if (this.levels.length === 0) return 0;
    return this.idxAtPillX(this.pill.position.x);
  }
  private restyleCells(): void {
    const fcfg = VIEW_CONFIG.bar.web.carousel;
    const scales = fcfg.fadeScale;
    const ops = fcfg.fadeOpacity;
    const last = Math.min(scales.length, ops.length) - 1;
    this.cells.forEach((c, i) => {
      const d = Math.abs(i - this.activeIdx);
      const k = Math.min(d, last);
      const on = d === 0;

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
    tween(this.pill)
      .to(
        0.32,
        { position: new Vec3(this.pillXFor(i), this.pill.position.y, 0) },
        { easing: 'backOut' },
      )
      .call(() => this.restyleCells())
      .start();
    this.restyleCells();
    if (emit && changed) this.events.emit('bet:set', i);
  }

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
    const circleBtn = (cx: number, cy: number, r: number): { node: Node; g: Graphics } => {
      const n = this.localNode(this.node, cx, this.Y(cy), r * 2, r * 2);

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

    const barCfg2 = VIEW_CONFIG.bar.web;
    const coinsX = 1980 + barCfg2.clusterCoinsX;
    const gambleX = coinsX + barCfg2.gambleGapPx;
    const coins = circleBtn(coinsX, 186, 38);

    const coinGlyph = this.localNode(coins.node, 0, 0, 60, 60);
    const cg = coinGlyph.addComponent(Graphics);
    const drawCoin = (cy: number): void => {
      const rx = 20,
        ry = 7.5;
      cg.fillColor = col('#7a4a06');
      cg.ellipse(0, cy - 3.4, rx, ry);
      cg.fill();
      cg.fillColor = col('#ffce47');
      cg.ellipse(0, cy, rx, ry);
      cg.fill();
      cg.lineWidth = 1.3;
      cg.strokeColor = col('#b9760c');
      cg.ellipse(0, cy, rx, ry);
      cg.stroke();
      cg.fillColor = col('#fff4c4', 0.85);
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

    const x2lbl = this.lbl('×2', 0, 0, 25, C.value, true, gamble.node, 0.5);
    x2lbl.node.setPosition(0, 0, 0);
    this.hitNode(gambleX - 38, 148, 76, 76, () => this.events.emit('bet:double'), [gamble.node]);

    const turbo = circleBtn(2200, 150, 30);
    const tGlyph = this.localNode(turbo.node, 0, 0, 30, 30);
    const tg = tGlyph.addComponent(Graphics);

    const boltPath = (): void => {
      tg.moveTo(4, 13);
      tg.lineTo(-9, -2);
      tg.lineTo(-1, -2);
      tg.lineTo(-5, -14);
      tg.lineTo(9, 3);
      tg.lineTo(1, 3);
      tg.close();
    };
    tg.fillColor = col(C.caramel);
    boltPath();
    tg.fill();
    tg.lineWidth = 1.4;
    tg.strokeColor = col(C.caramelLine);
    boltPath();
    tg.stroke();
    this.turboGlyphOp = tGlyph.addComponent(UIOpacity);

    this.icon(tGlyph, 0, 0, 36, 'ic_bolt', C.caramel, () => tg.clear());
    const pip = this.localNode(turbo.node, 13, 13, 12, 12);
    const pg = pip.addComponent(Graphics);
    pg.fillColor = col(C.caramel);
    pg.circle(0, 0, 5);
    pg.fill();
    pip.active = false;
    this.turboPip = pip;
    this.hitNode(2170, 120, 60, 60, () => this.events.emit('turbo'), [turbo.node]);

    const auto = circleBtn(2200, 222, 30);
    const aGlyph = this.localNode(auto.node, 0, 0, 30, 30);
    const ag2 = aGlyph.addComponent(Graphics);

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

    this.icon(aGlyph, 0, 0, 40, 'ic_autoplay', '#f4e6ff', () => ag2.clear());
    this.autoGlyph = aGlyph;
    this.autoCount = this.lbl('', 0, 0, 22, C.value, true, auto.node, 0.5);
    this.autoCount.node.setPosition(0, 0, 0);
    this.autoCount.node.active = false;
    this.hitNode(2170, 192, 60, 60, () => this.events.emit('autoplay'), [auto.node]);

    const R = 70;

    const ring = this.localNode(this.node, 2330, this.Y(186), R * 2.8, R * 2.8);
    this.spinRing = ring;

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

    rg.fillColor = col(C.ringMid);
    rg.circle(0, 0, R * 0.94);
    rg.fill();

    rg.fillColor = col(C.spinFace);
    rg.circle(0, 0, INNER);
    rg.fill();

    rg.lineWidth = 2;
    rg.strokeColor = col(C.centerRim, 0.9);
    rg.circle(0, 0, R * 0.94);
    rg.stroke();
    rg.lineWidth = 2;
    rg.strokeColor = col('#000000', 0.35);
    rg.circle(0, 0, INNER);
    rg.stroke();

    rg.fillColor = col('#ffffff', 0.22);
    rg.ellipse(0, R * 0.4, R * 0.5, R * 0.14);
    rg.fill();

    const arrowNode = this.localNode(ring, 0, 0, R, R);
    const ag = arrowNode.addComponent(Graphics);
    const ar = R * 0.4;

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

    this.icon(arrowNode, 0, 0, R * 1.05, 'ic_spin', C.value, () => ag.clear());
    this.spinArrow = arrowNode;

    const stopNode = this.localNode(ring, 0, 0, R, R);
    const sg = stopNode.addComponent(Graphics);
    sg.fillColor = col('#000000', 0.4);
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
    this.startSpinBreathe();
  }

  private reducedMotion = false;

  setReducedFx(on: boolean): void {
    this.reducedMotion = on;
    if (on) this.stopSpinBreathe();
    else this.startSpinBreathe();
  }
  private startSpinBreathe(): void {
    if (this.reducedMotion) return;
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

    // SLIDER FIX (owner: "sound slider not working"): a wide track hit-area over the
    // bar so tapping/dragging anywhere on the track sets the volume by finger
    // position, not just the tiny knob.
    const vtrack = new Node('vtrack');
    vp.addChild(vtrack);
    const vtui = vtrack.addComponent(UITransform);
    vtui.setAnchorPoint(0, 0.5);
    vtui.setContentSize(154 + 28, 40);
    vtrack.setPosition(60 - 14, -66, 0);
    const setVolFromTouch = (e: EventTouch): void => {
      const p = e.getUILocation();
      const local = vtui.convertToNodeSpaceAR(new Vec3(p.x, p.y, 0));
      this.applyVolume((local.x - 14) / 154, true);
    };
    vtrack.on(Node.EventType.TOUCH_START, setVolFromTouch);
    vtrack.on(Node.EventType.TOUCH_MOVE, setVolFromTouch);

    // OUTSIDE-CLICK (owner: "outside click not working"): a full-screen scrim behind
    // the panel that closes it when the player taps anywhere outside.
    this.volScrim = new Node('volScrim');
    this.node.addChild(this.volScrim);
    this.volScrim.setSiblingIndex(0);
    this.volScrim.addComponent(UITransform).setContentSize(8000, 6000);
    this.volScrim.setPosition(W / 2, this.Y(H / 2), 0);
    this.volScrim.on(Node.EventType.TOUCH_END, () => {
      if (this.volPanel.active) this.toggleVolPanel();
    });
    this.volScrim.active = false;

    this.redrawVolume();
  }

  private toggleVolPanel(): void {
    const vp = this.volPanel;
    const op = this.volPanelOp;
    const opening = !vp.active;
    Tween.stopAllByTarget(vp);
    Tween.stopAllByTarget(op);
    if (opening) {
      vp.active = true;
      if (this.volScrim) this.volScrim.active = true;
      vp.setScale(0.84, 0.84, 1);
      op.opacity = 0;
      tween(vp)
        .to(0.22, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
        .start();
      tween(op).to(0.16, { opacity: 255 }).start();
    } else {
      if (this.volScrim) this.volScrim.active = false;
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

  on(ev: string, cb: (...args: unknown[]) => void): this {
    this.events.on(ev, cb);
    return this;
  }

  fit(viewW: number, viewH: number): number {
    const s = Math.min((viewW * 0.9) / W, 0.6, (viewH * 0.32) / H);
    this.node.setScale(s, s, 1);
    this.node.setPosition(new Vec3((-W * s) / 2, -viewH / 2 + H * s, 0));
    this.floorHitTargets(s);

    return (H - (RING_TOP - CROP) - 2) * s;
  }

  // Surface E (2, R12): floor every interactive hit node to >=44px effective at the
  // smallest viewport — grow to max(designW, 44/s) keeping the center fixed.
  // Glyph visuals are untouched (hit nodes carry no art). Large nodes are no-ops.
  private floorHitTargets(s: number): void {
    const minDesign = s > 0 ? 44 / s : 44;
    for (const h of this.hitNodes) {
      const ui = h.n.getComponent(UITransform);
      if (!ui) continue;
      const w = Math.max(h.w, minDesign);
      const ht = Math.max(h.h, minDesign);
      const cx = h.x + h.w / 2;
      const cy = h.y + h.h / 2;
      ui.setContentSize(w, ht);
      h.n.setPosition(cx - w / 2, this.Y(cy - ht / 2), 0);
    }
  }

  private fmt(n: number): string {
    return formatMoney(Number.isFinite(n) ? n : 0, this.currency, 9);
  }

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
      const e = 1 - (1 - p) * (1 - p);
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

    this.balCur.string = '';
    this.renderBalance(this.counters.bal.shown);
  }

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
    if (this.reducedMotion) {
      this.counters.win.shown = n;
      this.lastWinValue.string = this.fmt(n);
      this.relayoutBanners();
      return;
    }

    this.counters.win.shown = 0;
    this.countTo('win', n, (v) => {
      this.lastWinValue.string = this.fmt(v);
      this.relayoutBanners();
    });

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

    if (vals.length === 0) {
      this.track.removeAllChildren();
      this.cells = [];
      this.levels = [];
      this.activeIdx = 0;
      this.track.setPosition(0, 0, 0);
      if (this.pill) this.pill.setPosition(0, this.pill.position.y, 0);
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
      this.track.setPosition(this.trackHome(), 0, 0);
      if (this.pill) this.pill.setPosition(this.pillXFor(this.activeIdx), this.pill.position.y, 0);
      this.restyleCells();
    } else if (!this.dragging) {
      const clamped = Math.max(0, Math.min(vals.length - 1, ai));
      if (clamped !== this.activeIdx) {
        this.activeIdx = clamped;
        this.track.setPosition(this.trackHome(), 0, 0);
        tween(this.pill)
          .to(
            0.3,
            { position: new Vec3(this.pillXFor(clamped), this.pill.position.y, 0) },
            { easing: 'quadOut' },
          )
          .call(() => this.restyleCells())
          .start();
        this.restyleCells();
      }
    }
  }
  setDemo(on: boolean): void {
    if (this.demoBadge) this.demoBadge.active = !!on;
  }

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
