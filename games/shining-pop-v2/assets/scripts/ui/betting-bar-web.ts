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
  Mask,
  Node,
  tween,
  Tween,
  UIOpacity,
  UITransform,
  Vec3,
} from 'cc';
const { ccclass } = _decorator;

const W = 2400;
const H = 300;

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

@ccclass('BettingBarWeb')
export class BettingBarWeb extends Component {
  private events = new EventTarget();
  private balValue!: Label;
  private balCur!: Label;
  private lastWinValue!: Label;
  private totalBetValue!: Label;
  private sndGlyphOp!: UIOpacity;
  private sndSlash!: Node;
  private volPanel!: Node;
  private volFill!: Graphics;
  private volKnob!: Node;
  private volume = 0.5;
  private lastNonZero = 0.5;
  private spinArrow!: Node;
  private spinStop!: Node;
  private spinOp!: UIOpacity;
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
    bg.fillColor = col(C.stage, 0.92);
    bg.rect(0, -H, W, H);
    bg.fill();
    bg.fillColor = col(C.stageDeep, 0.6);
    bg.rect(0, -H, W, H - 118);
    bg.fill();

    this.buildAccount();
    this.buildBanner(500, 320, 'LAST WIN', (l) => (this.lastWinValue = l));
    this.buildBanner(840, 240, 'TOTAL BET', (l) => (this.totalBetValue = l));
    this.buildCarousel();
    this.buildRightCluster();
    this.buildVolumePanel();
  }

  private Y(y: number): number {
    return -y;
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
  ): Label {
    const n = new Node('t');
    n.layer = this.node.layer;
    parent.addChild(n);
    n.addComponent(UITransform).setContentSize(10, 10);
    n.setPosition(x, this.Y(y), 0);
    const l = n.addComponent(Label);
    l.string = text;
    l.fontSize = size;
    l.lineHeight = size + 4;
    l.isBold = bold;
    l.color = col(color);
    return l;
  }

  /** Candy panel: dark fill + lighter top stop + gloss sheen + cyan glass inner + edge. */
  private panel(g: Graphics, x: number, y: number, w: number, h: number, r: number): void {
    g.fillColor = col(C.panel);
    g.roundRect(x, this.Y(y + h), w, h, r);
    g.fill();
    g.fillColor = col(C.panelHi, 0.55);
    g.roundRect(x + 2, this.Y(y + h * 0.46), w - 4, h * 0.44, Math.max(2, r - 4));
    g.fill();
    g.fillColor = col('#ffffff', 0.1);
    g.roundRect(x + 2.5, this.Y(y + h * 0.42), w - 5, h * 0.4, Math.max(2, r - 2));
    g.fill();
    g.lineWidth = 1.1;
    g.strokeColor = col(C.cyan, 0.15);
    g.roundRect(x + 2, this.Y(y + h - 2), w - 4, h - 4, Math.max(2, r - 1));
    g.stroke();
    g.lineWidth = 2;
    g.strokeColor = col(C.edge);
    g.roundRect(x + 1, this.Y(y + h - 1), w - 2, h - 2, Math.max(2, r - 1));
    g.stroke();
  }

  private hitNode(x: number, y: number, w: number, h: number, cb: () => void): Node {
    const n = new Node('hit');
    n.layer = this.node.layer;
    this.node.addChild(n);
    const ui = n.addComponent(UITransform);
    ui.setAnchorPoint(0, 1);
    ui.setContentSize(w, h);
    n.setPosition(x, this.Y(y), 0);
    n.on(Node.EventType.TOUCH_END, cb);
    return n;
  }

  private buildAccount(): void {
    const g = this.gfx('account');
    this.panel(g, 40, 148, 440, 76, 38);
    [27, 38, 49].forEach((dy) => {
      g.moveTo(80, this.Y(148 + dy));
      g.lineTo(110, this.Y(148 + dy));
    });
    g.lineWidth = 3.2;
    g.strokeColor = col(C.icon);
    g.stroke();
    this.hitNode(60, 148, 70, 76, () => this.events.emit('menu'));

    const snd = this.gfx('snd');
    snd.fillColor = col(C.icon);
    snd.moveTo(152, this.Y(180));
    snd.lineTo(158, this.Y(180));
    snd.lineTo(166, this.Y(173));
    snd.lineTo(166, this.Y(199));
    snd.lineTo(158, this.Y(192));
    snd.lineTo(152, this.Y(192));
    snd.close();
    snd.fill();
    snd.lineWidth = 2.6;
    snd.strokeColor = col(C.icon);
    snd.moveTo(173, this.Y(180));
    snd.lineTo(176, this.Y(186));
    snd.lineTo(173, this.Y(192));
    snd.stroke();
    this.sndGlyphOp = snd.node.addComponent(UIOpacity);
    const slash = this.gfx('sndSlash');
    slash.lineWidth = 3;
    slash.strokeColor = col(C.icon);
    slash.moveTo(146, this.Y(172));
    slash.lineTo(174, this.Y(200));
    slash.stroke();
    this.sndSlash = slash.node;
    this.sndSlash.active = false;
    this.hitNode(140, 160, 44, 52, () => {
      this.volPanel.active = !this.volPanel.active;
    });

    g.lineWidth = 1.6;
    g.strokeColor = col(C.divider, 0.3);
    g.moveTo(210, this.Y(162));
    g.lineTo(210, this.Y(210));
    g.stroke();

    this.lbl('BALANCE', 232, 168, 17, C.label);
    this.balValue = this.lbl('0.00', 232, 192, 28, C.value);
    this.balCur = this.lbl('USD', 320, 198, 16, C.cur, false);
    [this.lbl('', 0, 0, 1, C.label)].forEach((l) => l.node.destroy());
    [this.balValue, this.balCur, this.lastWinValue].forEach(() => undefined);
    this.balValue.node.getComponent(UITransform)!.setAnchorPoint(0, 0.5);
    this.balValue.horizontalAlign = Label.HorizontalAlign.LEFT;
  }

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
    const cap = this.lbl(label, x + w / 2 - 70, 178, 18, C.label);
    cap.horizontalAlign = Label.HorizontalAlign.RIGHT;
    const val = this.lbl('0.00', x + w / 2 + 14, 178, 27, C.value);
    val.horizontalAlign = Label.HorizontalAlign.LEFT;
    sink(val);
  }

  private buildCarousel(): void {
    const SX = 1100;
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

    const sel = this.hitNode(SX, 148, SW, 76, () => undefined);
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
      this.track.setPosition(this.track.position.x + dx, this.track.position.y, 0);
    });
    const end = () => {
      if (!this.dragging) return;
      this.dragging = false;
      this.snapNearest(true);
    };
    sel.on(Node.EventType.TOUCH_END, end);
    sel.on(Node.EventType.TOUCH_CANCEL, end);
  }

  private CELLW = 132;
  private trackXFor(i: number): number {
    return 400 - (i * this.CELLW + this.CELLW / 2);
  }
  private nearestIdx(): number {
    const i = Math.round((400 - this.track.position.x - this.CELLW / 2) / this.CELLW);
    return Math.max(0, Math.min(this.levels.length - 1, i));
  }
  private restyleCells(): void {
    this.cells.forEach((c, i) => {
      const on = i === this.activeIdx;
      c.color = col(on ? C.dark : C.value);
      c.node.setScale(on ? 1 : 0.78, on ? 1 : 0.78, 1);
      const op = c.node.getComponent(UIOpacity) ?? c.node.addComponent(UIOpacity);
      op.opacity = on ? 255 : 150;
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

  private buildRightCluster(): void {
    const circle = (cx: number, cy: number, r: number): Graphics => {
      const g = this.gfx('c' + cx);
      g.fillColor = col(C.panel);
      g.circle(cx, this.Y(cy), r);
      g.fill();
      g.fillColor = col(C.panelHi, 0.5);
      g.circle(cx - r * 0.18, this.Y(cy - r * 0.3), r * 0.62);
      g.fill();
      g.lineWidth = 1.8;
      g.strokeColor = col(C.edge, 0.92);
      g.circle(cx, this.Y(cy), r - 1);
      g.stroke();
      return g;
    };

    const coins = circle(1980, 186, 38);
    coins.fillColor = col('#9a4bd0');
    coins.ellipse(1980, this.Y(197), 19, 6.5);
    coins.fill();
    coins.fillColor = col('#c06fda');
    coins.ellipse(1980, this.Y(189), 19, 6.5);
    coins.fill();
    coins.fillColor = col('#e0a0ff');
    coins.ellipse(1980, this.Y(181), 19, 6.5);
    coins.fill();
    this.hitNode(1942, 148, 76, 76, () => this.events.emit('betmenu'));

    circle(2090, 186, 38);
    const x2 = this.lbl('×2', 2090, 174, 25, C.value);
    x2.horizontalAlign = Label.HorizontalAlign.CENTER;
    x2.node.getComponent(UITransform)!.setAnchorPoint(0.5, 0.5);
    this.hitNode(2052, 148, 76, 76, () => this.events.emit('bet:double'));

    const turbo = circle(2200, 150, 30);
    turbo.fillColor = col(C.active);
    turbo.moveTo(2204, this.Y(138));
    turbo.lineTo(2191, this.Y(153));
    turbo.lineTo(2199, this.Y(153));
    turbo.lineTo(2195, this.Y(164));
    turbo.lineTo(2208, this.Y(148));
    turbo.lineTo(2200, this.Y(148));
    turbo.close();
    turbo.fill();
    this.turboGlyphOp = turbo.node.addComponent(UIOpacity);
    const pipG = this.gfx('turboPip');
    pipG.fillColor = col('#e9bf5a');
    pipG.circle(2213, this.Y(137), 5);
    pipG.fill();
    this.turboPip = pipG.node;
    this.turboPip.active = false;
    this.hitNode(2170, 120, 60, 60, () => this.events.emit('turbo'));

    const auto = circle(2200, 222, 30);
    auto.lineWidth = 3;
    auto.strokeColor = col('#e0a0ff');
    auto.arc(2200, this.Y(222), 12, -1.23, -1.91 + Math.PI * 2, true);
    auto.stroke();
    auto.fillColor = col('#e0a0ff');
    auto.moveTo(2202, this.Y(209));
    auto.lineTo(2197, this.Y(215));
    auto.lineTo(2195, this.Y(207));
    auto.close();
    auto.fill();
    this.autoGlyph = auto.node;
    const cnt = this.lbl('', 2200, 210, 22, C.value);
    cnt.horizontalAlign = Label.HorizontalAlign.CENTER;
    cnt.node.getComponent(UITransform)!.setAnchorPoint(0.5, 0.5);
    this.autoCount = cnt;
    this.autoCount.node.active = false;
    this.hitNode(2170, 192, 60, 60, () => this.events.emit('autoplay'));

    const R = 70;
    const spin = this.gfx('spinRing');
    spin.fillColor = col(C.ringMid);
    spin.circle(2330, this.Y(186), R);
    spin.fill();
    spin.fillColor = col(C.ringHi, 0.85);
    spin.circle(2330 - R * 0.16, this.Y(186 - R * 0.2), R * 0.92);
    spin.fill();
    spin.fillColor = col(C.ringLo);
    spin.circle(2330 + R * 0.1, this.Y(186 + R * 0.16), R * 0.9);
    spin.fill();
    spin.fillColor = col(C.spinFace);
    spin.circle(2330, this.Y(186), R * 0.7857);
    spin.fill();
    spin.lineWidth = R * 0.031;
    spin.strokeColor = col(C.centerRim, 0.4);
    spin.circle(2330, this.Y(186), R * 0.7857);
    spin.stroke();
    spin.fillColor = col('#ffffff', 0.07);
    spin.ellipse(2330 - R * 0.23, this.Y(186 - R * 0.26), R * 0.245, R * 0.105);
    spin.fill();

    const arrowNode = new Node('spinArrow');
    arrowNode.layer = this.node.layer;
    this.node.addChild(arrowNode);
    arrowNode.addComponent(UITransform).setContentSize(10, 10);
    arrowNode.setPosition(2330, this.Y(186), 0);
    const ag = arrowNode.addComponent(Graphics);
    const ar = R * 0.4;
    ag.lineWidth = R * 0.107;
    ag.strokeColor = col(C.value);
    ag.arc(0, 0, ar, -1.206, -1.936 + Math.PI * 2, true);
    ag.stroke();
    ag.fillColor = col(C.value);
    ag.moveTo(0, ar + R * 0.05);
    ag.lineTo(-R * 0.114, ar - R * 0.06);
    ag.lineTo(-R * 0.171, ar + R * 0.09);
    ag.close();
    ag.fill();
    this.spinArrow = arrowNode;

    const stopNode = new Node('spinStop');
    stopNode.layer = this.node.layer;
    this.node.addChild(stopNode);
    stopNode.addComponent(UITransform).setContentSize(10, 10);
    stopNode.setPosition(2330, this.Y(186), 0);
    const sg = stopNode.addComponent(Graphics);
    sg.fillColor = col(C.value, 0.98);
    sg.roundRect(-R * 0.26, -R * 0.26, R * 0.52, R * 0.52, R * 0.12);
    sg.fill();
    stopNode.active = false;
    this.spinStop = stopNode;

    this.spinOp = spin.node.addComponent(UIOpacity);
    const spinHit = this.hitNode(2330 - R, 186 - R, R * 2, R * 2, () => {
      if (!this.spinStop.active) {
        Tween.stopAllByTarget(this.spinArrow);
        this.spinArrow.angle = 0;
        tween(this.spinArrow)
          .to(0.7, { angle: -360 }, { easing: 'quadOut' })
          .call(() => (this.spinArrow.angle = 0))
          .start();
      }
      this.events.emit('spin');
    });
    spinHit.on(Node.EventType.TOUCH_START, () => this.spinArrow.setScale(0.94, 0.94, 1));
    spinHit.on(Node.EventType.TOUCH_END, () => this.spinArrow.setScale(1, 1, 1));
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
    const closeHit = new Node('vx');
    closeHit.layer = this.node.layer;
    vp.addChild(closeHit);
    closeHit.addComponent(UITransform).setContentSize(36, 36);
    closeHit.setPosition(216, -22, 0);
    closeHit.on(Node.EventType.TOUCH_END, () => (vp.active = false));

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
    mute.on(Node.EventType.TOUCH_END, () =>
      this.applyVolume(this.volume > 0.001 ? 0 : this.lastNonZero, true),
    );
    this.redrawVolume();
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

  fit(viewW: number, viewH: number): void {
    const s = Math.min(viewW / W, (viewH * 0.3) / H);
    this.node.setScale(s, s, 1);
    this.node.setPosition(new Vec3((-W * s) / 2, -viewH / 2 + H * s, 0));
  }

  private fmt(n: number): string {
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  setBalance(n: number): void {
    this.balValue.string = this.fmt(n);
    this.balCur.node.setPosition(244 + this.balValue.string.length * 15, this.Y(198), 0);
  }
  setCurrency(c: string): void {
    this.balCur.string = c;
  }
  setLastWin(n: number): void {
    this.lastWinValue.string = this.fmt(n);
  }
  setBet(n: number): void {
    this.totalBetValue.string = this.fmt(n);
  }
  setBetLevels(valuesCents: number[], activeIdx: number, fmt?: (v: number) => string): void {
    if (fmt) this.carFmt = fmt;
    const same =
      this.levels.length === valuesCents.length &&
      this.levels[0] === valuesCents[0] &&
      this.levels[this.levels.length - 1] === valuesCents[valuesCents.length - 1];
    if (!same) {
      this.levels = valuesCents.slice();
      this.track.removeAllChildren();
      this.cells = [];
      valuesCents.forEach((v, i) => {
        const t = this.lbl(this.carFmt(v), 0, 0, 27, C.value, true, this.track);
        t.horizontalAlign = Label.HorizontalAlign.CENTER;
        t.node.getComponent(UITransform)!.setAnchorPoint(0.5, 0.5);
        t.node.setPosition(i * this.CELLW + this.CELLW / 2, -30, 0);
        this.cells.push(t);
      });
      this.activeIdx = Math.max(0, Math.min(valuesCents.length - 1, activeIdx));
      this.track.setPosition(this.trackXFor(this.activeIdx), 0, 0);
      this.restyleCells();
    } else if (!this.dragging && activeIdx !== this.activeIdx) {
      this.activeIdx = activeIdx;
      tween(this.track)
        .to(0.3, { position: new Vec3(this.trackXFor(activeIdx), 0, 0) }, { easing: 'quadOut' })
        .call(() => this.restyleCells())
        .start();
      this.restyleCells();
    }
  }
  setDemo(): void {}
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
