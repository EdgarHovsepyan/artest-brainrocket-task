import {
  _decorator,
  Component,
  Node,
  Graphics,
  Label,
  LabelOutline,
  LabelShadow,
  Color,
  resources,
  Sprite,
  SpriteFrame,
  UITransform,
  UIOpacity,
  Vec2,
  Vec3,
  EventTarget,
  EventTouch,
  tween,
  Tween,
} from 'cc';
import { applyFont } from '../view/fonts';
import { formatMoney } from '../logic/money';
import { VIEW_CONFIG } from '../view/view-config';
const { ccclass } = _decorator;

const W = 540;
const H = 684;
const VOL = { x0: 408, w: 100, y: 452 };

const BAND_TOP = 196;

const COMPACT_MAX_FRAC = 0.4;

function safeAreaBottomCocos(viewH: number): number {
  if (typeof document === 'undefined' || typeof window === 'undefined') return 0;
  try {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none;';
    document.body.appendChild(probe);
    const cssPx = probe.getBoundingClientRect().height;
    document.body.removeChild(probe);
    const innerH = window.innerHeight || viewH;
    return innerH > 0 ? cssPx * (viewH / innerH) : 0;
  } catch {
    return 0;
  }
}

// Sugar Rush re-skin: the mobile bar was the only violet-accented surface; retinted
// to the pink spine to match betting-bar-web.ts (R12) and C7 (pink spin, not violet).
const C = {
  stage: '#0d0826',
  panel: '#191140',
  banner: '#281c58',
  active: '#ff5ab0',
  ring: '#ff7ad0',
  ringInner: '#ffe8fb',
  spin: '#1a1138',
  centerRim: '#ffd6f4',
  edge: '#ff7ad0',
  value: '#f5f7fa',
  label: '#c9ced8',
  cur: '#e9edf3',
  icon: '#f5f7fa',
  divider: '#cf78e0',
  gloss: '#ffffff',
  glow: '#ff4ad0',
  // Surface 2 (R12, lockstep with betting-bar-web): SPIN DOME radial-gradient stops
  // (circle at 36% 26%): white -> #ffd9ec -> #ff5ab0 -> #ff007f -> #b8005e edge.
  domeHot: '#ffffff',
  domeHi: '#ffd9ec',
  domeMid: '#ff5ab0',
  domeCore: '#ff007f',
  domeEdge: '#b8005e',
  // Glass-pill readout edges (cyan/mint = win/scatter signal) + Space-Mono micro tint.
  readCyan: '#7fe7ff',
  readMint: '#52d189',
  microCyan: '#9fe9ff',
  // Autoplay candy gem = violet (R12); turbo gem = caramel.
  violet: '#9a3bd6',
  violetHi: '#d3a3f0',
  violetLo: '#7a2bb0',
  // Surface E (R12): caramel turbo signal — pink=brand, cyan=win, gold=coins preserved.
  caramel: '#ff9a3c',
  caramelHi: '#ffd07a',
  caramelLo: '#e8731f',
  caramelLine: '#8a5200',
};
function col(hex: string, a?: number): Color {
  const c = new Color();
  Color.fromHEX(c, hex);
  if (a != null) c.a = Math.round(a * 255);
  return c;
}

@ccclass('BettingBarMobile')
export class BettingBarMobile extends Component {
  private events = new EventTarget();
  private g!: Graphics;
  private labels: Record<string, Label> = {};

  private uiBoost = 1;

  private currency = 'USD';

  private spinGroup!: Node;
  private spinArrow!: Node;
  private spinHalo: Node | null = null;
  private spinHaloOp: UIOpacity | null = null;
  private spinStop!: Node;
  private autoGlyph!: Node;
  private autoCount!: Label;
  private turboGlyphOp!: UIOpacity;
  private turboPip!: Node;
  private minusOp!: UIOpacity;
  private plusOp!: UIOpacity;
  private soundOp!: UIOpacity;
  private soundMuted!: Node;
  private demoGroup!: Node;
  private soundPanel!: Node;
  private soundScrim: Node | null = null;
  private soundFill!: Graphics;
  private soundHandle!: Node;
  private volume = 0.5;
  private panelOpen = false;

  onLoad(): void {
    const ui = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
    ui.setContentSize(W, H);
    ui.setAnchorPoint(0, 1);

    this.g = this.gfx('decor');
    this.drawDecor();
    this.buildSpin();
    this.buildAutoplay();
    this.buildStepperGlyphs();
    this.buildTurbo();
    this.buildSoundMenu();
    this.buildDemo();
    this.buildSoundPanel();

    this.makeLabels();
    this.makeHitAreas();
  }

  private Y(y: number): number {
    return -y;
  }

  private gfx(name: string, parent: Node = this.node): Graphics {
    const n = new Node(name);
    parent.addChild(n);
    const ui = n.addComponent(UITransform);
    ui.setAnchorPoint(0, 1);
    ui.setContentSize(W, H);
    return n.addComponent(Graphics);
  }

  private rr(g: Graphics, x: number, y: number, w: number, h: number, r: number): void {
    g.roundRect(x, this.Y(y + h), w, h, r);
  }
  private panelInto(
    g: Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string,
    edgeW: number,
    edgeColor: string = C.edge,
    edgeAlpha = 1,
  ): void {
    this.rr(g, x, y, w, h, r);
    g.fillColor = col(fill);
    g.fill();
    if (edgeW) {
      this.rr(g, x, y, w, h, r);
      g.lineWidth = edgeW;
      g.strokeColor = col(edgeColor, edgeAlpha);
      g.stroke();
    }

    this.rr(g, x + 2, y + 2, w - 4, h - 4, Math.max(0, r - 2));
    g.lineWidth = 1.2;
    g.strokeColor = col(C.gloss, 0.06);
    g.stroke();
  }
  private circleInto(
    g: Graphics,
    cx: number,
    cy: number,
    r: number,
    fill: string,
    edgeW: number,
  ): void {
    const Y = this.Y.bind(this);
    g.circle(cx, Y(cy), r);
    g.fillColor = col(fill);
    g.fill();
    if (edgeW) {
      g.circle(cx, Y(cy), r);
      g.lineWidth = edgeW;
      g.strokeColor = col(C.edge);
      g.stroke();
    }
  }

  // Candy gem (conic+dome approximation, lockstep with betting-bar-web circleBtn gem):
  // dark edge -> mid -> pale hot-spot offset up-left + white quadrant rim ticks.
  private gemInto(
    g: Graphics,
    cx: number,
    cy: number,
    r: number,
    edge: string,
    mid: string,
    hi: string,
  ): void {
    const sy = this.Y(cy);
    g.fillColor = col(edge);
    g.circle(cx, sy, r);
    g.fill();
    g.fillColor = col(mid);
    g.circle(cx - r * 0.16, sy + r * 0.26, r * 0.78);
    g.fill();
    g.fillColor = col(hi, 0.95);
    g.circle(cx - r * 0.26, sy + r * 0.34, r * 0.34);
    g.fill();
    g.lineWidth = r * 0.07;
    g.strokeColor = col('#ffffff', 0.7);
    for (let q = 0; q < 4; q++) {
      const a0 = q * (Math.PI / 2) + 0.2;
      g.arc(cx, sy, r * 0.92, a0, a0 + Math.PI / 2 - 0.4, false);
      g.stroke();
    }
  }

  private drawDecor(): void {
    const g = this.g;
    const Y = this.Y.bind(this);

    const bandAlpha = VIEW_CONFIG.bar.mobile.bandAlpha;
    if (bandAlpha > 0) {
      this.rr(g, 0, BAND_TOP, W, H - BAND_TOP, 0);
      g.fillColor = col(C.stage, bandAlpha);
      g.fill();
      this.rr(g, 0, 300, W, 384, 0);
      g.fillColor = col('#000000', 0.12);
      g.fill();
    }

    g.rect(0, Y(BAND_TOP), W, 2);
    g.fillColor = col(C.edge, 0.55);
    g.fill();
    g.rect(0, Y(BAND_TOP + 2), W, 6);
    g.fillColor = col('#ffffff', 0.05);
    g.fill();

    g.rect(0, Y(301), W, 1.4);
    g.fillColor = col(C.divider, 0.5);
    g.fill();

    // WIN + BALANCE readouts = cyan-edged glass pills (cyan = win signal, per design).
    this.panelInto(g, 60, 210, 200, 46, 23, '#0a0614', 1.8, C.readCyan, 0.55);
    this.panelInto(g, 280, 210, 200, 46, 23, '#0a0614', 1.8, C.readCyan, 0.5);

    this.panelInto(g, 170, 479, 200, 54, 27, C.panel, 1.8);
    [237, 303].forEach((x) => {
      g.moveTo(x, Y(486));
      g.lineTo(x, Y(526));
    });
    g.lineWidth = 1.3;
    g.strokeColor = col(C.divider, 0.28);
    g.stroke();

    // Autoplay candy gem (violet) + turbo candy gem (caramel), grouped with the bet
    // stepper per design. Glyphs are drawn on top in buildAutoplay/buildTurbo.
    this.gemInto(g, 104, 506, 30, C.violetLo, C.violet, C.violetHi);
    this.gemInto(g, 436, 506, 30, C.caramelLo, C.caramel, C.caramelHi);

    this.panelInto(g, 14, 560, 512, 44, 22, C.panel, 1.8);
    g.moveTo(330, Y(568));
    g.lineTo(330, Y(596));
    g.lineWidth = 1.2;
    g.strokeColor = col(C.divider, 0.3);
    g.stroke();

    // Surface E (3): subtle down-caret cue under the centre BET value to signal it
    // opens the quick-bet menu (tap-on-value). Centered at x=270, clear of dividers.
    g.moveTo(263, Y(524));
    g.lineTo(270, Y(530));
    g.lineTo(277, Y(524));
    g.lineWidth = 2;
    g.strokeColor = col(C.ring, 0.7);
    g.stroke();
  }

  private icon(
    parent: Node,
    x: number,
    yDesign: number,
    size: number,
    name: string,
    tint: string,
    onReady?: () => void,
  ): Node {
    const n = new Node(name);
    n.layer = this.node.layer;
    parent.addChild(n);
    const ui = n.addComponent(UITransform);
    ui.setAnchorPoint(0.5, 0.5);
    ui.setContentSize(size, size);
    n.setPosition(x, this.Y(yDesign), 0);
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

  private buildSpin(): void {
    const Y = this.Y.bind(this);
    this.spinGroup = new Node('spin');
    this.node.addChild(this.spinGroup);
    const ui = this.spinGroup.addComponent(UITransform);
    ui.setAnchorPoint(0, 1);
    ui.setContentSize(W, H);
    this.spinGroup.addComponent(UIOpacity).opacity = 255;

    // Surface 2 — SPIN DOME (lockstep with betting-bar-web). Graphics can't do a
    // radial-gradient, so approximate `radial-gradient(circle at 36% 26%, #fff 0%,
    // #ffd9ec 14%, #ff5ab0 44%, #ff007f 72%, #b8005e 100%)` with stacked circles:
    // deep edge -> brand core -> lighter mid -> white hot-spot offset up-left.
    const face = this.gfx('face', this.spinGroup);
    const SCX = 270;
    const SCY = Y(392); // screen-space centre (mobile Y = -y)
    const SR = 70;

    // (a) peppermint-approx outer ring (deep edge + brand band + white quadrant ticks)
    face.fillColor = col(C.domeEdge);
    face.circle(SCX, SCY, SR);
    face.fill();
    face.fillColor = col(C.domeCore);
    face.circle(SCX, SCY, SR * 0.96);
    face.fill();
    face.lineWidth = SR * 0.05;
    face.strokeColor = col('#ffffff', 0.8);
    for (let q = 0; q < 4; q++) {
      const a0 = q * (Math.PI / 2) + 0.18;
      face.arc(SCX, SCY, SR * 0.985, a0, a0 + Math.PI / 2 - 0.36, false);
      face.stroke();
    }

    // (b) glossy inner dome — hot-spot offset up-left (36%/26%). Up = +screen-y.
    const hcx = SCX - SR * 0.14;
    const hcy = SCY + SR * 0.24;
    const domeStops: { r: number; c: string }[] = [
      { r: SR * 0.9, c: C.domeEdge },
      { r: SR * 0.74, c: C.domeCore },
      { r: SR * 0.52, c: C.domeMid },
      { r: SR * 0.3, c: C.domeHi },
      { r: SR * 0.14, c: C.domeHot },
    ];
    for (const s of domeStops) {
      face.fillColor = col(s.c);
      face.circle(hcx, hcy, s.r);
      face.fill();
    }

    // (c) inset rim: bright top-left specular arc + dark candy shade at the bottom.
    face.lineWidth = SR * 0.05;
    face.strokeColor = col('#ffffff', 0.85);
    face.arc(SCX, SCY, SR * 0.9, Math.PI * 0.35, Math.PI * 1.0, false);
    face.stroke();
    face.lineWidth = SR * 0.07;
    face.strokeColor = col('#7a0044', 0.55);
    face.arc(SCX, SCY, SR * 0.9, Math.PI * 1.05, Math.PI * 1.9, false);
    face.stroke();

    // (d) top specular ellipse highlight (white top-cap blob).
    face.fillColor = col('#ffffff', 0.92);
    face.ellipse(SCX, SCY + SR * 0.46, SR * 0.3, SR * 0.1);
    face.fill();
    face.fillColor = col('#ffffff', 0.32);
    face.ellipse(SCX, SCY + SR * 0.42, SR * 0.5, SR * 0.16);
    face.fill();

    const arrow = this.gfx('arrow', this.spinGroup);
    arrow.arc(270, Y(392), 28, Math.PI * 0.27, Math.PI * 1.73, false);
    arrow.lineWidth = 7.5;
    arrow.strokeColor = col(C.icon);
    arrow.stroke();
    arrow.moveTo(270, Y(362));
    arrow.lineTo(262, Y(371));
    arrow.lineTo(258, Y(361));
    arrow.close();
    arrow.fillColor = col(C.icon);
    arrow.fill();
    this.icon(arrow.node, 270, 392, 62, 'ic_spin', C.icon, () => arrow.clear());
    this.spinArrow = arrow.node;

    const stop = this.gfx('stop', this.spinGroup);
    this.rr(stop, 252, 374, 36, 36, 8);
    stop.fillColor = col(C.value, 0.98);
    stop.fill();
    this.spinStop = stop.node;
    this.spinStop.active = false;

    const halo = new Node('spinHalo');
    halo.layer = this.node.layer;
    this.spinGroup.addChild(halo);
    const hui = halo.addComponent(UITransform);
    hui.setAnchorPoint(0.5, 0.5);
    hui.setContentSize(180, 180);
    halo.setPosition(270, this.Y(392), 0);
    halo.setSiblingIndex(0);
    const hg = halo.addComponent(Graphics);
    hg.fillColor = col(C.edge, 0.5);
    hg.circle(0, 0, 80);
    hg.fill();
    this.spinHaloOp = halo.addComponent(UIOpacity);
    this.spinHaloOp.opacity = 0;
    this.spinHalo = halo;
    this.startSpinBreathe();
  }

  private startSpinBreathe(): void {
    if (this.reducedMotion) return;
    if (!this.spinHalo || !this.spinHaloOp) return;
    Tween.stopAllByTarget(this.spinHalo);
    Tween.stopAllByTarget(this.spinHaloOp);
    this.spinHalo.active = true;
    this.spinHalo.setScale(1, 1, 1);
    tween(this.spinHalo)
      .to(1.5, { scale: new Vec3(1.1, 1.1, 1) }, { easing: 'sineInOut' })
      .to(1.5, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
      .union()
      .repeatForever()
      .start();
    tween(this.spinHaloOp)
      .to(1.5, { opacity: 95 }, { easing: 'sineInOut' })
      .to(1.5, { opacity: 40 }, { easing: 'sineInOut' })
      .union()
      .repeatForever()
      .start();
  }
  private stopSpinBreathe(): void {
    if (!this.spinHalo || !this.spinHaloOp) return;
    Tween.stopAllByTarget(this.spinHalo);
    Tween.stopAllByTarget(this.spinHaloOp);
    this.spinHaloOp.opacity = 0;
  }

  private buildAutoplay(): void {
    const Y = this.Y.bind(this);
    const glyph = this.gfx('autoGlyph');
    glyph.moveTo(116, Y(506));
    glyph.lineTo(98, Y(496));
    glyph.lineTo(98, Y(516));
    glyph.close();
    // White glyph on the violet autoplay gem so it reads (design uses a white face).
    glyph.fillColor = col('#f4e6ff');
    glyph.fill();

    this.icon(glyph.node, 104, 506, 36, 'ic_autoplay', '#f4e6ff', () => glyph.clear());
    this.autoGlyph = glyph.node;
    this.autoCount = this.mkLabel('autoCount', 104, 506, 17, C.value, 0.5);
    this.autoCount.string = '';
    this.autoCount.node.active = false;
  }

  private buildStepperGlyphs(): void {
    const Y = this.Y.bind(this);
    const minus = this.gfx('minus');
    minus.moveTo(189, Y(506));
    minus.lineTo(217, Y(506));
    minus.lineWidth = 3;
    minus.strokeColor = col(C.icon);
    minus.stroke();
    this.icon(minus.node, 203, 506, 26, 'ic_minus', C.icon, () => minus.clear());
    this.minusOp = minus.node.addComponent(UIOpacity);

    const plus = this.gfx('plus');
    plus.moveTo(337, Y(492));
    plus.lineTo(337, Y(520));
    plus.moveTo(323, Y(506));
    plus.lineTo(351, Y(506));
    plus.lineWidth = 3;
    plus.strokeColor = col(C.icon);
    plus.stroke();
    this.icon(plus.node, 337, 506, 26, 'ic_plus', C.icon, () => plus.clear());
    this.plusOp = plus.node.addComponent(UIOpacity);
  }

  private buildTurbo(): void {
    const Y = this.Y.bind(this);
    const glyph = this.gfx('turboGlyph');
    glyph.moveTo(440, Y(494));
    glyph.lineTo(427, Y(509));
    glyph.lineTo(435, Y(509));
    glyph.lineTo(431, Y(520));
    glyph.lineTo(444, Y(504));
    glyph.lineTo(436, Y(504));
    glyph.close();
    // White bolt on the caramel turbo gem so it reads (design uses a white face).
    glyph.fillColor = col('#fff7ea');
    glyph.fill();
    glyph.lineWidth = 1;
    glyph.strokeColor = col(C.caramelLine);
    glyph.stroke();
    this.icon(glyph.node, 436, 507, 30, 'ic_bolt', '#fff7ea', () => glyph.clear());
    this.turboGlyphOp = glyph.node.addComponent(UIOpacity);
    this.turboGlyphOp.opacity = 115;

    const pip = this.gfx('turboPip');
    const pr = 4;
    pip.moveTo(449, Y(519) + pr);
    pip.lineTo(449 + pr, Y(519));
    pip.lineTo(449, Y(519) - pr);
    pip.lineTo(449 - pr, Y(519));
    pip.close();
    pip.fillColor = col('#fff7ea');
    pip.fill();
    this.turboPip = pip.node;
    this.turboPip.active = false;
  }

  private buildSoundMenu(): void {
    const Y = this.Y.bind(this);
    const menu = this.gfx('menuGlyph');
    [16, 22, 28].forEach((dy) => {
      menu.moveTo(478, Y(560 + dy));
      menu.lineTo(500, Y(560 + dy));
    });
    menu.lineWidth = 2.6;
    menu.strokeColor = col(C.icon);
    menu.stroke();
    this.icon(menu.node, 489, 582, 28, 'ic_menu', C.icon, () => menu.clear());

    const snd = this.gfx('sound');
    snd.moveTo(416, Y(577));
    snd.lineTo(421, Y(577));
    snd.lineTo(427, Y(572));
    snd.lineTo(427, Y(592));
    snd.lineTo(421, Y(587));
    snd.lineTo(416, Y(587));
    snd.close();
    snd.fillColor = col(C.icon);
    snd.fill();
    snd.arc(426.39, Y(582), 7, -1.0297, 1.0297, false);
    snd.lineWidth = 2;
    snd.strokeColor = col(C.icon);
    snd.stroke();
    this.icon(snd.node, 425, 582, 28, 'ic_sound', C.icon, () => snd.clear());
    this.soundOp = snd.node.addComponent(UIOpacity);

    const mute = this.gfx('soundMuted');
    mute.moveTo(414, Y(570));
    mute.lineTo(440, Y(596));
    mute.lineWidth = 3;
    mute.strokeColor = col(C.value);
    mute.stroke();
    this.soundMuted = mute.node;
    this.soundMuted.active = false;
  }

  private buildDemo(): void {
    this.demoGroup = new Node('demo');
    this.node.addChild(this.demoGroup);
    const ui = this.demoGroup.addComponent(UITransform);
    ui.setAnchorPoint(0, 1);
    ui.setContentSize(W, H);
    const g = this.demoGroup.addComponent(Graphics);
    this.panelInto(g, 210, 272, 120, 24, 12, C.panel, 1.1);
    this.mkLabel('demoLabel', 270, 284, 11, C.cur, 0.5, this.demoGroup).string = 'DEMO MODE';
    this.demoGroup.active = false;
  }

  private buildSoundPanel(): void {
    const Y = this.Y.bind(this);
    this.soundPanel = new Node('soundPanel');
    this.node.addChild(this.soundPanel);
    const pui = this.soundPanel.addComponent(UITransform);
    pui.setAnchorPoint(0, 1);
    pui.setContentSize(W, H);

    const plate = this.soundPanel.addComponent(Graphics);
    this.panelInto(plate, 360, 430, 166, 46, 12, C.panel, 1.8);

    plate.moveTo(376, Y(447));
    plate.lineTo(381, Y(447));
    plate.lineTo(387, Y(442));
    plate.lineTo(387, Y(462));
    plate.lineTo(381, Y(457));
    plate.lineTo(376, Y(457));
    plate.close();
    plate.fillColor = col(C.icon);
    plate.fill();

    plate.moveTo(VOL.x0, Y(VOL.y));
    plate.lineTo(VOL.x0 + VOL.w, Y(VOL.y));
    plate.lineWidth = 3;
    plate.strokeColor = col(C.divider, 0.5);
    plate.stroke();

    this.soundFill = this.gfx('volFill', this.soundPanel);

    const handle = new Node('volHandle');
    this.soundPanel.addChild(handle);
    const hui = handle.addComponent(UITransform);
    hui.setAnchorPoint(0.5, 0.5);
    hui.setContentSize(30, 30);
    const hg = handle.addComponent(Graphics);
    const hr = 7;
    const hdiamond = () => {
      hg.moveTo(0, hr);
      hg.lineTo(hr, 0);
      hg.lineTo(0, -hr);
      hg.lineTo(-hr, 0);
      hg.close();
    };
    hg.fillColor = col(C.value);
    hdiamond();
    hg.fill();
    hg.lineWidth = 2;
    hg.strokeColor = col(C.edge);
    hdiamond();
    hg.stroke();
    this.soundHandle = handle;

    handle.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
      const s = this.node.scale.x || 1;
      this.setVolume(this.volume + e.getDeltaX() / s / VOL.w);
    });

    const muteHit = new Node('volMute');
    this.soundPanel.addChild(muteHit);
    const mui = muteHit.addComponent(UITransform);
    mui.setAnchorPoint(0, 1);
    mui.setContentSize(34, 30);
    muteHit.setPosition(new Vec3(372, Y(437), 0));
    muteHit.on(Node.EventType.TOUCH_END, () => this.events.emit('sound'));

    // SLIDER FIX (owner: "sound slider not working"): a wide track hit-area so
    // tapping/dragging anywhere on the track sets the volume by finger position —
    // the bare handle was a tiny, hard-to-grab target.
    const track = new Node('volTrack');
    this.soundPanel.addChild(track);
    const tui = track.addComponent(UITransform);
    tui.setAnchorPoint(0, 0.5);
    tui.setContentSize(VOL.w + 28, 44);
    track.setPosition(new Vec3(VOL.x0 - 14, this.Y(VOL.y), 0));
    const setFromTouch = (e: EventTouch): void => {
      const p = e.getUILocation();
      const local = tui.convertToNodeSpaceAR(new Vec3(p.x, p.y, 0));
      this.setVolume((local.x - 14) / VOL.w);
    };
    track.on(Node.EventType.TOUCH_START, setFromTouch);
    track.on(Node.EventType.TOUCH_MOVE, setFromTouch);

    this.setVolume(this.volume, false);
    this.soundPanel.active = false;

    // OUTSIDE-CLICK (owner: "outside click not working"): a full-screen scrim behind
    // the panel that closes it on tap. It sits below the bar controls, so tapping a
    // control still works; tapping the game area outside closes the panel.
    this.soundScrim = new Node('soundScrim');
    this.node.addChild(this.soundScrim);
    this.soundScrim.setSiblingIndex(0);
    this.soundScrim.addComponent(UITransform).setContentSize(6000, 4000);
    this.soundScrim.setPosition(new Vec3(W / 2, -H / 2, 0));
    this.soundScrim.on(Node.EventType.TOUCH_END, () => {
      if (this.panelOpen) this.toggleSoundPanel();
    });
    this.soundScrim.active = false;
  }

  private ping(cx: number, cy: number): void {
    const n = new Node('tapGlow');
    this.node.addChild(n);
    n.layer = this.node.layer;
    const ui = n.addComponent(UITransform);
    ui.setAnchorPoint(0.5, 0.5);
    ui.setContentSize(60, 60);
    n.setPosition(new Vec3(cx, this.Y(cy), 0));
    const g = n.addComponent(Graphics);
    const e = col(C.edge);

    const ring = (rad: number, a: number) => {
      g.fillColor = new Color(e.r, e.g, e.b, a);
      g.moveTo(0, rad);
      g.lineTo(rad, 0);
      g.lineTo(0, -rad);
      g.lineTo(-rad, 0);
      g.close();
      g.fill();
    };
    ring(22, 24);
    ring(13, 48);
    ring(6, 120);
    const op = n.addComponent(UIOpacity);
    op.opacity = 180;

    n.setScale(0.7, 0.7, 1);
    tween(n)
      .to(0.22, { scale: new Vec3(1.25, 1.25, 1) }, { easing: 'quadOut' })
      .start();
    tween(op)
      .to(0.22, { opacity: 0 }, { easing: 'quadOut' })
      .call(() => {
        if (n.isValid) n.destroy();
      })
      .start();
  }

  private toggleSoundPanel(): void {
    this.panelOpen = !this.panelOpen;
    this.soundPanel.active = this.panelOpen;
    if (this.soundScrim) this.soundScrim.active = this.panelOpen;
  }

  private mkLabel(
    name: string,
    x: number,
    y: number,
    size: number,
    color: string,
    anchorX: number,
    parent: Node = this.node,
    font?: 'body' | 'display' | 'mono',
  ): Label {
    const n = new Node(name);
    parent.addChild(n);
    const ui = n.addComponent(UITransform);
    ui.setAnchorPoint(anchorX, 0.5);
    const lab = n.addComponent(Label);
    lab.fontSize = size;
    lab.lineHeight = size + 2;
    (n as unknown as { __baseFs: number }).__baseFs = size;
    lab.color = col(color);
    lab.isBold = true;
    // Sugar Rush type system: micro-labels = Space-Mono, values = Luckiest Guy
    // (display), rest = Fredoka (body). Caller may override the family.
    applyFont(lab, font ?? (color === C.value ? 'display' : 'body'));

    if (color === C.value) this.make3D(lab);
    n.setPosition(new Vec3(x, this.Y(y), 0));
    this.labels[name] = lab;
    return lab;
  }

  private make3D(l: Label): void {
    const ls = l.node.addComponent(LabelShadow);
    ls.color = col('#180527', 0.9);
    ls.offset = new Vec2(0, -2);
    ls.blur = 2;
    const lo = l.node.addComponent(LabelOutline);
    lo.color = col('#2d0b40');
    lo.width = 2;
  }
  private makeLabels(): void {
    // Micro-labels (Space-Mono, cyan win-signal tint); values keep display font.
    this.mkLabel('lastWinLabel', 100, 233, 11, C.microCyan, 0.5, this.node, 'mono').string =
      'WIN';
    this.mkLabel('lastWinValue', 180, 233, 17, C.value, 0).string = '0.00';
    this.mkLabel('totalBetLabel', 320, 233, 11, C.label, 0.5, this.node, 'mono').string =
      'TOTAL BET';
    this.mkLabel('totalBetValue', 400, 233, 17, C.value, 0).string = '0';
    this.mkLabel('stepValue', 270, 507, 24, C.value, 0.5).string = '0';
    this.mkLabel('balLabel', 36, 582, 11, C.microCyan, 0, this.node, 'mono').string = 'BALANCE';
    this.mkLabel('balValue', 104, 582, 15, C.value, 0).string = '0';
    this.mkLabel('balCur', 196, 582, 11, C.cur, 0).string = 'USD';
    this.mkLabel('betLabel', 242, 582, 11, C.microCyan, 0, this.node, 'mono').string = 'BET';
    this.mkLabel('betValue', 272, 582, 15, C.value, 0).string = '0';
  }

  private hitNodes: { n: Node; x: number; y: number; w: number; h: number }[] = [];

  private makeHitAreas(): void {
    const add = (name: string, x: number, y: number, w: number, h: number, fn: () => void) => {
      const n = new Node(name);
      this.node.addChild(n);
      const ui = n.addComponent(UITransform);
      ui.setAnchorPoint(0, 1);
      ui.setContentSize(w, h);
      n.setPosition(new Vec3(x, this.Y(y), 0));
      n.on(Node.EventType.TOUCH_START, () => this.ping(x + w / 2, y + h / 2));
      n.on(Node.EventType.TOUCH_END, fn);
      this.hitNodes.push({ n, x, y, w, h });
    };
    const emit = (ev: string) => () => this.events.emit(ev);

    add('hitSpin', 200, 322, 140, 140, emit('spin'));
    add('hitAutoplay', 72, 474, 64, 64, emit('autoplay'));
    add('hitMinus', 170, 474, 67, 64, emit('bet:dec'));
    add('hitPlus', 303, 474, 67, 64, emit('bet:inc'));
    // Surface E (3): tap the centre BET value to open the 6-level quick-bet menu.
    // Sits in the clear gap between the −/+ steppers (x 237..303), no double-trigger.
    add('hitBetMenu', 240, 480, 60, 52, emit('betmenu'));
    add('hitTurbo', 404, 474, 64, 64, emit('turbo'));
    add('hitSound', 393, 550, 64, 64, () => this.toggleSoundPanel());
    add('hitMenu', 457, 550, 64, 64, emit('menu'));
  }

  on(ev: string, cb: (...args: any[]) => void): this {
    this.events.on(ev, cb);
    return this;
  }

  fit(viewW: number, viewH: number): number {
    let s = Math.min(viewW / W, viewH / H);

    const maxBand = COMPACT_MAX_FRAC * viewH;
    const bandPx = (H - BAND_TOP) * s;
    if (bandPx > maxBand) s *= maxBand / bandPx;
    const safe = safeAreaBottomCocos(viewH);
    this.node.setScale(s, s, 1);

    this.node.setPosition(new Vec3((-W * s) / 2, -viewH / 2 + safe + H * s, 0));
    this.applyTextScale(s);
    this.floorHitTargets(s);
    return safe + (H - BAND_TOP) * s;
  }

  // Surface E (2, R12): every interactive hit node must be >=44px effective at the
  // smallest viewport. Grow content size to max(designW, 44/s) keeping the center
  // fixed (anchor 0,1 => shift top-left by half the delta). Glyph visuals untouched.
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
      h.n.setPosition(new Vec3(cx - w / 2, this.Y(cy - ht / 2), 0));
    }
  }

  private applyTextScale(s: number): void {
    const boost = Math.min(3, Math.max(1, Math.ceil(s)));
    if (boost === this.uiBoost) return;
    this.uiBoost = boost;
    for (const l of Object.values(this.labels)) {
      const node = l.node as unknown as { __baseFs?: number };
      const base = node.__baseFs ?? l.fontSize;
      node.__baseFs = base;
      l.fontSize = Math.round(base * boost);
      l.lineHeight = Math.round((base + 2) * boost);
      l.node.setScale(1 / boost, 1 / boost, 1);
    }
  }
  private fmt(n: number): string {
    return formatMoney(Number.isFinite(n) ? n : 0, this.currency, 9);
  }

  private fitValue(name: string, maxW: number): void {
    const lab = this.labels[name];
    if (!lab) return;

    const b = this.uiBoost;
    lab.node.setScale(1 / b, 1 / b, 1);
    lab.updateRenderData(true);
    const w = lab.node.getComponent(UITransform)!.width;
    const designW = w / b;
    if (designW > maxW && maxW > 4) {
      const k = maxW / designW;
      lab.node.setScale(k / b, k / b, 1);
    }
  }
  setBalance(n: number): void {
    this.labels['balValue'].string = this.fmt(n);
    this.fitValue('balValue', 84);
  }
  setCurrency(c: string): void {
    this.currency = c;

    this.labels['balCur'].string = '';
  }
  setLastWin(n: number): void {
    this.labels['lastWinValue'].string = this.fmt(n);
    this.fitValue('lastWinValue', 76);
  }
  setBet(n: number): void {
    const v = this.fmt(n);
    this.labels['stepValue'].string = v;
    this.labels['totalBetValue'].string = v;
    this.labels['betValue'].string = v;
    this.fitValue('stepValue', 90);
    this.fitValue('totalBetValue', 76);
    this.fitValue('betValue', 54);
  }
  setDemo(on: boolean): void {
    this.demoGroup.active = !!on;
  }
  setSoundOn(on: boolean): void {
    this.soundOp.opacity = on ? 255 : 140;
    if (this.soundMuted) this.soundMuted.active = !on;
  }

  setVolume(v: number, emit = true): void {
    this.volume = Math.max(0, Math.min(1, v));
    const sy = this.Y(VOL.y);
    const hx = VOL.x0 + this.volume * VOL.w;
    if (this.soundHandle) this.soundHandle.setPosition(new Vec3(hx, sy, 0));
    if (this.soundFill) {
      this.soundFill.clear();
      this.soundFill.moveTo(VOL.x0, sy);
      this.soundFill.lineTo(hx, sy);
      this.soundFill.lineWidth = 4;
      this.soundFill.strokeColor = col(C.active);
      this.soundFill.stroke();
    }
    if (emit) this.events.emit('volume', this.volume);
  }

  private reducedMotion = false;

  setReducedFx(on: boolean): void {
    this.reducedMotion = on;
    if (on) this.stopSpinBreathe();
    else this.startSpinBreathe();
  }
  setSpinning(on: boolean): void {
    this.spinArrow.active = !on;
    this.spinStop.active = !!on;
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
    this.spinGroup.getComponent(UIOpacity)!.opacity = on ? 255 : 128;
  }
  setSteppers(minusOn: boolean, plusOn: boolean): void {
    this.minusOp.opacity = minusOn ? 255 : 102;
    this.plusOp.opacity = plusOn ? 255 : 102;
  }
}
