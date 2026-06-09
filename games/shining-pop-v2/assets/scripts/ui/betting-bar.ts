/* BettingBarMobile — Cocos Creator 3.8 component (betting part only, 540×684).
   Shared control surface for every Cocos game; buy-bonus stays game state.

   CRYSTAL-VIOLET re-theme: 1:1 with the current shining-pop Pixi bar
   (betting-bar-mobile.js / -skin.js) — indigo darks → orchid/magenta, lavender
   highlights, WHITE-SMOKE text + icons (the "kill purple text" decision), orchid
   edges/dividers. cc.Graphics has no gradients, so each gradient is approximated
   by a representative stop; depth comes from inner-gloss + rim strokes (swap to
   baked gradient-texture Sprites for the final polish pass). Inter font: assign
   in the editor for an exact match; falls back to the system font otherwise.

   Stateful glyphs (spin arrow/stop, autoplay glyph/count, turbo glyph/pip,
   stepper +/- , sound, demo) live in their OWN nodes so the live-state API can
   toggle/dim them — matching the Pixi bar exactly.

   Events: spin · bet:inc · bet:dec · autoplay · turbo · sound · menu
   API: on · fit · setBalance · setCurrency · setLastWin · setBet · setDemo ·
        setSoundOn · setSpinning · setAutoplay · setTurbo · setAffordable · setSteppers */
import {
  _decorator,
  Component,
  Node,
  Graphics,
  Label,
  Color,
  UITransform,
  UIOpacity,
  Vec3,
  EventTarget,
  EventTouch,
  tween,
} from 'cc';
const { ccclass } = _decorator;

const W = 540;
const H = 684;
const VOL = { x0: 408, w: 100, y: 452 }; // volume-slider track geometry (design coords)

// Crystal-violet palette — representative stops from the shining-pop skin.
const C = {
  stage: '#0d0826',
  panel: '#191140',
  banner: '#281c58',
  active: '#db5fd8',
  ring: '#b86fda',
  ringInner: '#f0e0ff',
  spin: '#15102e',
  centerRim: '#e8d0ff',
  edge: '#b86fda',
  value: '#f5f7fa', // white-smoke (no purple text)
  label: '#c9ced8', // muted white-smoke caption
  cur: '#e9edf3',
  icon: '#f5f7fa',
  divider: '#b070da',
  gloss: '#ffffff',
  glow: '#d84ad8',
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
  private g!: Graphics; // static decoration layer
  private labels: Record<string, Label> = {};

  // stateful element handles
  private spinGroup!: Node; // dim target for setAffordable
  private spinArrow!: Node;
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
  private soundFill!: Graphics;
  private soundHandle!: Node;
  private volume = 0.5; // matches AudioManager's default master gain
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

  // top-down design y → Cocos y-up
  private Y(y: number): number {
    return -y;
  }

  // create a full-size overlay Graphics node (anchor 0,1, same coord space)
  private gfx(name: string, parent: Node = this.node): Graphics {
    const n = new Node(name);
    parent.addChild(n);
    const ui = n.addComponent(UITransform);
    ui.setAnchorPoint(0, 1);
    ui.setContentSize(W, H);
    return n.addComponent(Graphics);
  }

  private rr(g: Graphics, x: number, y: number, w: number, h: number, r: number): void {
    const Y = this.Y.bind(this);
    g.moveTo(x + r, Y(y));
    g.lineTo(x + w - r, Y(y));
    g.arc(x + w - r, Y(y + r), r, Math.PI / 2, 0, true);
    g.lineTo(x + w, Y(y + h - r));
    g.arc(x + w - r, Y(y + h - r), r, 0, -Math.PI / 2, true);
    g.lineTo(x + r, Y(y + h));
    g.arc(x + r, Y(y + h - r), r, -Math.PI / 2, Math.PI, true);
    g.lineTo(x, Y(y + r));
    g.arc(x + r, Y(y + r), r, Math.PI, Math.PI / 2, true);
    g.close();
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
  ): void {
    this.rr(g, x, y, w, h, r);
    g.fillColor = col(fill);
    g.fill();
    if (edgeW) {
      this.rr(g, x, y, w, h, r);
      g.lineWidth = edgeW;
      g.strokeColor = col(C.edge);
      g.stroke();
    }
    // inner gloss highlight (depth without gradients)
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

  // ── static decoration (stage, scrim, banners, pill, circle bases, balance bar) ──
  private drawDecor(): void {
    const g = this.g;
    const Y = this.Y.bind(this);

    this.rr(g, 0, 0, W, H, 0);
    g.fillColor = col(C.stage);
    g.fill();
    this.rr(g, 0, 300, W, 384, 0);
    g.fillColor = col('#000000', 0.12);
    g.fill();
    // signature divider hairline at the band top
    g.rect(0, Y(301), W, 1.4);
    g.fillColor = col(C.divider, 0.5);
    g.fill();
    // soft hero glow behind SPIN
    g.circle(270, Y(392), 116);
    g.fillColor = col(C.glow, 0.1);
    g.fill();

    // LAST WIN / TOTAL BET banners
    this.panelInto(g, 60, 210, 200, 46, 23, C.banner, 1.8);
    this.panelInto(g, 280, 210, 200, 46, 23, C.banner, 1.8);

    // bet stepper pill body + dividers
    this.panelInto(g, 170, 479, 200, 54, 27, C.panel, 1.8);
    [237, 303].forEach((x) => {
      g.moveTo(x, Y(486));
      g.lineTo(x, Y(526));
    });
    g.lineWidth = 1.3;
    g.strokeColor = col(C.divider, 0.28);
    g.stroke();

    // autoplay + turbo circle bases
    this.circleInto(g, 104, 506, 30, C.panel, 1.8);
    this.circleInto(g, 436, 506, 30, C.panel, 1.8);

    // bottom balance bar + internal divider
    this.panelInto(g, 14, 560, 512, 44, 22, C.panel, 1.8);
    g.moveTo(430, Y(568));
    g.lineTo(430, Y(596));
    g.lineWidth = 1.2;
    g.strokeColor = col(C.divider, 0.3);
    g.stroke();
    // menu glyph (static; sound glyph is its own node for setSoundOn)
    [16, 22, 28].forEach((dy) => {
      g.moveTo(478, Y(560 + dy));
      g.lineTo(500, Y(560 + dy));
    });
    g.lineWidth = 2.6;
    g.strokeColor = col(C.icon);
    g.stroke();
  }

  // ── hero SPIN: ring + center in face; arrow + stop as toggleable nodes; group
  //    carries a UIOpacity for setAffordable. ──
  private buildSpin(): void {
    const Y = this.Y.bind(this);
    this.spinGroup = new Node('spin');
    this.node.addChild(this.spinGroup);
    const ui = this.spinGroup.addComponent(UITransform);
    ui.setAnchorPoint(0, 1);
    ui.setContentSize(W, H);
    this.spinGroup.addComponent(UIOpacity).opacity = 255;

    const face = this.gfx('face', this.spinGroup);
    this.circleInto(face, 270, 392, 70, C.ring, 0);
    face.circle(270, Y(392), 69);
    face.lineWidth = 4;
    face.strokeColor = col(C.ringInner, 0.6);
    face.stroke();
    this.circleInto(face, 270, 392, 55, C.spin, 0);
    face.circle(270, Y(392), 55);
    face.lineWidth = 2.2;
    face.strokeColor = col(C.centerRim, 0.4);
    face.stroke();

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
    this.spinArrow = arrow.node;

    const stop = this.gfx('stop', this.spinGroup);
    this.rr(stop, 252, 374, 36, 36, 8);
    stop.fillColor = col(C.value, 0.98);
    stop.fill();
    this.spinStop = stop.node;
    this.spinStop.active = false;
  }

  // ── autoplay: triangle glyph + a count label (count shown while running). ──
  private buildAutoplay(): void {
    const Y = this.Y.bind(this);
    const glyph = this.gfx('autoGlyph');
    glyph.moveTo(116, Y(506));
    glyph.lineTo(98, Y(496));
    glyph.lineTo(98, Y(516));
    glyph.close();
    glyph.fillColor = col(C.active);
    glyph.fill();
    this.autoGlyph = glyph.node;
    this.autoCount = this.mkLabel('autoCount', 104, 506, 17, C.value, 0.5);
    this.autoCount.string = '';
    this.autoCount.node.active = false;
  }

  // ── stepper +/- glyphs as their own dimmable nodes (setSteppers). ──
  private buildStepperGlyphs(): void {
    const Y = this.Y.bind(this);
    const minus = this.gfx('minus');
    minus.moveTo(189, Y(506));
    minus.lineTo(217, Y(506));
    minus.lineWidth = 3;
    minus.strokeColor = col(C.icon);
    minus.stroke();
    this.minusOp = minus.node.addComponent(UIOpacity);

    const plus = this.gfx('plus');
    plus.moveTo(337, Y(492));
    plus.lineTo(337, Y(520));
    plus.moveTo(323, Y(506));
    plus.lineTo(351, Y(506));
    plus.lineWidth = 3;
    plus.strokeColor = col(C.icon);
    plus.stroke();
    this.plusOp = plus.node.addComponent(UIOpacity);
  }

  // ── turbo: bolt glyph (dimmable) + a pip shown in "active" mode. ──
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
    glyph.fillColor = col(C.active);
    glyph.fill();
    this.turboGlyphOp = glyph.node.addComponent(UIOpacity);
    this.turboGlyphOp.opacity = 115; // off by default

    const pip = this.gfx('turboPip');
    const pr = 4; // diamond pip (NOT a circle — VFX-ban compliant)
    pip.moveTo(449, Y(519) + pr);
    pip.lineTo(449 + pr, Y(519));
    pip.lineTo(449, Y(519) - pr);
    pip.lineTo(449 - pr, Y(519));
    pip.close();
    pip.fillColor = col(C.active);
    pip.fill();
    this.turboPip = pip.node;
    this.turboPip.active = false;
  }

  // ── sound glyph (own node so setSoundOn can dim it); menu glyph is static. ──
  private buildSoundMenu(): void {
    const Y = this.Y.bind(this);
    const snd = this.gfx('sound');
    snd.moveTo(448, Y(577));
    snd.lineTo(453, Y(577));
    snd.lineTo(459, Y(572));
    snd.lineTo(459, Y(592));
    snd.lineTo(453, Y(587));
    snd.lineTo(448, Y(587));
    snd.close();
    snd.fillColor = col(C.icon);
    snd.fill();
    snd.arc(458.39, Y(582), 7, -1.0297, 1.0297, false);
    snd.lineWidth = 2;
    snd.strokeColor = col(C.icon);
    snd.stroke();
    this.soundOp = snd.node.addComponent(UIOpacity);

    // muted slash (shown when sound is OFF) — its own node so setSoundOn toggles it.
    const mute = this.gfx('soundMuted');
    mute.moveTo(446, Y(570));
    mute.lineTo(472, Y(596));
    mute.lineWidth = 3;
    mute.strokeColor = col(C.value);
    mute.stroke();
    this.soundMuted = mute.node;
    this.soundMuted.active = false;
  }

  // ── DEMO MODE badge (hidden by default, toggled by setDemo). ──
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

  // ── volume slider popup: tap the sound icon to open; drag the handle to set
  //    volume; the mini speaker mutes. Lives in an empty band above the stepper. ──
  private buildSoundPanel(): void {
    const Y = this.Y.bind(this);
    this.soundPanel = new Node('soundPanel');
    this.node.addChild(this.soundPanel);
    const pui = this.soundPanel.addComponent(UITransform);
    pui.setAnchorPoint(0, 1);
    pui.setContentSize(W, H);

    const plate = this.soundPanel.addComponent(Graphics);
    this.panelInto(plate, 360, 430, 166, 46, 12, C.panel, 1.8);
    // mini speaker (mute) on the popup's left
    plate.moveTo(376, Y(447));
    plate.lineTo(381, Y(447));
    plate.lineTo(387, Y(442));
    plate.lineTo(387, Y(462));
    plate.lineTo(381, Y(457));
    plate.lineTo(376, Y(457));
    plate.close();
    plate.fillColor = col(C.icon);
    plate.fill();
    // track line
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
    // delta-based drag — robust against the bar's fit() scale; no keyboard (gate U2).
    handle.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
      const s = this.node.scale.x || 1;
      this.setVolume(this.volume + e.getDeltaX() / s / VOL.w);
    });

    // mute hit (the mini speaker) → reuses the existing 'sound' (mute toggle) event
    const muteHit = new Node('volMute');
    this.soundPanel.addChild(muteHit);
    const mui = muteHit.addComponent(UITransform);
    mui.setAnchorPoint(0, 1);
    mui.setContentSize(34, 30);
    muteHit.setPosition(new Vec3(372, Y(437), 0));
    muteHit.on(Node.EventType.TOUCH_END, () => this.events.emit('sound'));

    this.setVolume(this.volume, false); // position handle + fill without emitting
    this.soundPanel.active = false;
  }

  /** Creative diamond "ping" that expands + fades at a tap (transform/opacity, no ring). */
  private ping(cx: number, cy: number): void {
    const n = new Node('ping');
    this.node.addChild(n);
    n.layer = this.node.layer; // UI_2D so the tap FX renders
    const ui = n.addComponent(UITransform);
    ui.setAnchorPoint(0.5, 0.5);
    ui.setContentSize(40, 40);
    n.setPosition(new Vec3(cx, this.Y(cy), 0));
    const g = n.addComponent(Graphics);
    const r = 13;
    g.lineWidth = 2.5;
    g.strokeColor = col(C.edge);
    g.moveTo(0, r);
    g.lineTo(r, 0);
    g.lineTo(0, -r);
    g.lineTo(-r, 0);
    g.close();
    g.stroke();
    const op = n.addComponent(UIOpacity);
    op.opacity = 200;
    tween(n)
      .to(0.3, { scale: new Vec3(2.1, 2.1, 1) }, { easing: 'quadOut' })
      .start();
    tween(op)
      .to(0.3, { opacity: 0 })
      .call(() => {
        if (n.isValid) n.destroy();
      })
      .start();
  }

  private toggleSoundPanel(): void {
    this.panelOpen = !this.panelOpen;
    this.soundPanel.active = this.panelOpen;
  }

  private mkLabel(
    name: string,
    x: number,
    y: number,
    size: number,
    color: string,
    anchorX: number,
    parent: Node = this.node,
  ): Label {
    const n = new Node(name);
    parent.addChild(n);
    const ui = n.addComponent(UITransform);
    ui.setAnchorPoint(anchorX, 0.5);
    const lab = n.addComponent(Label);
    lab.fontSize = size;
    lab.lineHeight = size + 2;
    lab.color = col(color);
    lab.isBold = true;
    n.setPosition(new Vec3(x, this.Y(y), 0));
    this.labels[name] = lab;
    return lab;
  }
  private makeLabels(): void {
    this.mkLabel('lastWinLabel', 100, 233, 13, C.label, 0.5).string = 'LAST WIN';
    this.mkLabel('lastWinValue', 180, 233, 17, C.value, 0).string = '0.00';
    this.mkLabel('totalBetLabel', 320, 233, 13, C.label, 0.5).string = 'TOTAL BET';
    this.mkLabel('totalBetValue', 400, 233, 17, C.value, 0).string = '0';
    this.mkLabel('stepValue', 270, 507, 24, C.value, 0.5).string = '0';
    this.mkLabel('balLabel', 36, 582, 13, C.label, 0).string = 'BALANCE';
    this.mkLabel('balValue', 104, 582, 15, C.value, 0).string = '0';
    this.mkLabel('balCur', 196, 582, 11, C.cur, 0).string = 'USD';
    this.mkLabel('betLabel', 242, 582, 12, C.label, 0).string = 'BET';
    this.mkLabel('betValue', 272, 582, 15, C.value, 0).string = '0';
  }

  private makeHitAreas(): void {
    const add = (name: string, x: number, y: number, w: number, h: number, fn: () => void) => {
      const n = new Node(name);
      this.node.addChild(n);
      const ui = n.addComponent(UITransform);
      ui.setAnchorPoint(0, 1);
      ui.setContentSize(w, h);
      n.setPosition(new Vec3(x, this.Y(y), 0));
      n.on(Node.EventType.TOUCH_START, () => this.ping(x + w / 2, y + h / 2)); // creative tap FX
      n.on(Node.EventType.TOUCH_END, fn);
    };
    const emit = (ev: string) => () => this.events.emit(ev);
    add('hitSpin', 200, 322, 140, 140, emit('spin'));
    add('hitAutoplay', 74, 476, 60, 60, emit('autoplay'));
    add('hitMinus', 170, 479, 67, 54, emit('bet:dec'));
    add('hitPlus', 303, 479, 67, 54, emit('bet:inc'));
    add('hitTurbo', 406, 476, 60, 60, emit('turbo'));
    add('hitSound', 444, 566, 34, 32, () => this.toggleSoundPanel()); // opens the volume slider
    add('hitMenu', 472, 566, 36, 32, emit('menu'));
  }

  // ───────────────────────── public API ─────────────────────────
  on(ev: string, cb: (...args: any[]) => void): this {
    this.events.on(ev, cb);
    return this;
  }
  fit(viewW: number, viewH: number): void {
    // Parent is the Canvas root — origin at SCREEN CENTRE, not bottom-left.
    // The bar is a 540x684 anchor-(0,1) surface: centre it by offsetting half
    // its scaled size from the canvas origin (the old bottom-left math parked
    // the whole bar half a viewport to the right).
    const s = Math.min(viewW / W, viewH / H);
    this.node.setScale(s, s, 1);
    this.node.setPosition(new Vec3((-W * s) / 2, (H * s) / 2, 0));
  }
  private fmt(n: number): string {
    // Money renders with EXACTLY two decimals everywhere (approval gate N3/N4:
    // "1,000" and "1000.5" style drift is a reviewer flag).
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  setBalance(n: number): void {
    this.labels['balValue'].string = this.fmt(n);
  }
  setCurrency(c: string): void {
    this.labels['balCur'].string = c;
  }
  setLastWin(n: number): void {
    this.labels['lastWinValue'].string = this.fmt(n);
  }
  setBet(n: number): void {
    const v = this.fmt(n);
    this.labels['stepValue'].string = v;
    this.labels['totalBetValue'].string = v;
    this.labels['betValue'].string = v;
  }
  setDemo(on: boolean): void {
    this.demoGroup.active = !!on;
  }
  setSoundOn(on: boolean): void {
    this.soundOp.opacity = on ? 255 : 140;
    if (this.soundMuted) this.soundMuted.active = !on;
  }
  /** Set volume 0..1 — moves the slider handle + fill; emits 'volume' unless emit=false. */
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
  // ── live game-state (matches the Pixi bar) ──
  setSpinning(on: boolean): void {
    this.spinArrow.active = !on;
    this.spinStop.active = !!on;
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
