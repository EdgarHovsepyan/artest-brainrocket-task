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
const VOL = { x0: 408, w: 100, y: 452 }; // volume-slider track geometry (design coords)
// Opaque control-band top (design-y). Everything ABOVE this stays transparent so
// the reels show through / sit above the bar; the board reserves the band below
// it (mobile parity with the web bar's CROP/RING_TOP fitBottom contract).
const BAND_TOP = 196;
// Max fraction of the viewport HEIGHT the opaque control band may occupy — the bar
// scales down past this so it never dominates the screen (owner: "compact, 40% max").
const COMPACT_MAX_FRAC = 0.4;

/** Device bottom safe-area (iOS home indicator / Android nav bar) in COCOS view
 *  px. Reads the CSS env() via a hidden probe and converts CSS-px → view-px with
 *  the visible/inner-height ratio. No-op (0) off-browser or where unsupported —
 *  e.g. the desktop preview — so it only ever lifts the bar on a real device. */
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
  // Display currency for every money readout (symbol-prefixed via formatMoney).
  private currency = 'USD';

  // stateful element handles
  private spinGroup!: Node; // dim target for setAffordable
  private spinArrow!: Node;
  private spinHalo: Node | null = null; // centered breathing glow behind the spin CTA
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
    // 2026-06-11 — the in-bar buildBuyControl was REMOVED: it drew a second
    // circle in the deck ("two circles" bug) and duplicated the board FAB which
    // is now THE buy-bonus component in both orientations (it docks bottom-left
    // in portrait, matching the PixiJS reference). Buy is handled by the FAB's
    // own tap → view.openBuyMenu(); the bar no longer emits 'buy'.
    this.makeLabels();
    this.makeHitAreas();
  }

  /** Task 7.2 — portrait-bar Buy control. Candy pill ~ right of the spin ring,
   *  emits 'buy' so slot-view can open the buy modal. Visual + hit are sized by
   *  bar.buyControl tunables; ≥62 design-px hit clears the 44 CSS-px touch
   *  minimum after the portrait fit scale (~0.72). */
  private buyControlNode: Node | null = null;
  private buyControlEnabled = true;
  private buildBuyControl(): void {
    const cfg = VIEW_CONFIG.bar.buyControl;
    const n = new Node('buyControl');
    this.node.addChild(n);
    const ui = n.addComponent(UITransform);
    ui.setAnchorPoint(0.5, 0.5);
    ui.setContentSize(cfg.size, cfg.size);
    n.setPosition(new Vec3(cfg.x, this.Y(cfg.y), 0));

    const g = n.addComponent(Graphics);
    const r = cfg.size / 2;
    // Candy pill: filled core + soft inner highlight + bright rim.
    g.fillColor = new Color(255, 90, 156, 255);
    g.circle(0, 0, r);
    g.fill();
    g.fillColor = new Color(255, 217, 244, 110);
    g.circle(-r * 0.22, r * 0.28, r * 0.6);
    g.fill();
    g.lineWidth = 2;
    g.strokeColor = new Color(255, 200, 240, 240);
    g.circle(0, 0, r - 1);
    g.stroke();

    // "BUY" label centred on the pill (display font for hierarchy parity with
    // the menu/buy-modal headings).
    const labelNode = new Node('buyLabel');
    n.addChild(labelNode);
    const lt = labelNode.addComponent(UITransform);
    lt.setContentSize(cfg.size, cfg.size);
    lt.setAnchorPoint(0.5, 0.5);
    const lbl = labelNode.addComponent(Label);
    lbl.string = 'BUY';
    lbl.fontSize = Math.round(cfg.size * 0.32);
    lbl.lineHeight = Math.round(cfg.size * 0.34);
    lbl.color = new Color(20, 12, 40, 255);
    lbl.isBold = true;
    applyFont(lbl, 'display');

    // Press squash + emit 'buy'. Hit rect is the node itself; Wave A buyControl
    // size (62) already ≥ touch minimum so no extra hit padding.
    n.on(Node.EventType.TOUCH_START, () => {
      Tween.stopAllByTarget(n);
      tween(n)
        .to(0.08, { scale: new Vec3(0.94, 0.94, 1) }, { easing: 'quadOut' })
        .start();
    });
    const release = (tap: boolean): void => {
      Tween.stopAllByTarget(n);
      tween(n)
        .to(0.24, { scale: new Vec3(1, 1, 1) }, { easing: 'elasticOut' })
        .start();
      if (tap && this.buyControlEnabled) this.events.emit('buy');
    };
    n.on(Node.EventType.TOUCH_END, () => release(true));
    n.on(Node.EventType.TOUCH_CANCEL, () => release(false));
    this.buyControlNode = n;
  }

  /** Task 7.2 — controller-gating for spin/bonus runs. Dimmed (50% alpha) and
   *  non-interactive when disabled. */
  setBuyEnabled(on: boolean): void {
    this.buyControlEnabled = on;
    if (!this.buyControlNode) return;
    const op =
      this.buyControlNode.getComponent(UIOpacity) ?? this.buyControlNode.addComponent(UIOpacity);
    op.opacity = on ? 255 : 128;
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
    // Built-in roundRect (the web bar's clean path). The previous hand-rolled
    // arc path swept the LONG way around each corner, which rendered a full
    // protruding circle at every capsule end + a stray chord line — the "dark
    // circles" on the banners / stepper / footer and the crushed stop corners.
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

    // TRANSPARENT mobile bar (owner: "remove the background, transparent bg on the
    // bet panel"). The full-width deck slab + black scrim are gated on the config
    // bandAlpha (now 0) — when 0 nothing full-surface is painted and the reels/bg
    // show fully through. The per-control panels (banners/stepper/balance) below
    // keep their own fills for local contrast, so the controls still read.
    const bandAlpha = VIEW_CONFIG.bar.mobile.bandAlpha;
    if (bandAlpha > 0) {
      this.rr(g, 0, BAND_TOP, W, H - BAND_TOP, 0);
      g.fillColor = col(C.stage, bandAlpha);
      g.fill();
      this.rr(g, 0, 300, W, 384, 0);
      g.fillColor = col('#000000', 0.12);
      g.fill();
    }
    // Candy-pink top rim that lifts the band off the reels above (web-bar parity).
    g.rect(0, Y(BAND_TOP), W, 2);
    g.fillColor = col(C.edge, 0.55);
    g.fill();
    g.rect(0, Y(BAND_TOP + 2), W, 6);
    g.fillColor = col('#ffffff', 0.05);
    g.fill();
    // signature divider hairline at the inner band top
    g.rect(0, Y(301), W, 1.4);
    g.fillColor = col(C.divider, 0.5);
    g.fill();
    // (spin hero glow removed — the soft disc read as a "circle shadow" under
    // the spin button on small screens; the ring art carries the hero weight.)

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

    // bottom balance bar + internal divider (moved left to x330 so the sound +
    // menu utilities get ≥44px touch room to the right of the account readouts)
    this.panelInto(g, 14, 560, 512, 44, 22, C.panel, 1.8);
    g.moveTo(330, Y(568));
    g.lineTo(330, Y(596));
    g.lineWidth = 1.2;
    g.strokeColor = col(C.divider, 0.3);
    g.stroke();
    // menu glyph moved to its own node in buildSoundMenu so the authored icon
    // can replace it (lines in this shared decor layer could not be retired).
  }

  /** ICON SET — authored `resources/icons/ic_*.png` sprites (white art, tinted)
   *  replacing the hand-drawn glyphs. Async: the node stays hidden until the
   *  frame lands and `onReady` retires the Graphics fallback, so a missing icon
   *  can never leave a control glyph-less. Coordinates are design-space (Y()). */
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
    this.icon(arrow.node, 270, 392, 62, 'ic_spin', C.icon, () => arrow.clear());
    this.spinArrow = arrow.node;

    const stop = this.gfx('stop', this.spinGroup);
    this.rr(stop, 252, 374, 36, 36, 8);
    stop.fillColor = col(C.value, 0.98);
    stop.fill();
    this.spinStop = stop.node;
    this.spinStop.active = false;

    // CTA "rest breathing" (roadmap P0 #4): a centered candy-pink glow that gently
    // pulses behind the button so the primary control never looks dead at rest.
    // A dedicated CENTRED node (anchor 0.5) is scaled in place — the bar's art is
    // drawn at absolute coords with a top-left pivot, so scaling those would DRIFT
    // the button, not breathe it. Sits behind the face; paused while spinning.
    const halo = new Node('spinHalo');
    halo.layer = this.node.layer;
    this.spinGroup.addChild(halo);
    const hui = halo.addComponent(UITransform);
    hui.setAnchorPoint(0.5, 0.5);
    hui.setContentSize(180, 180);
    halo.setPosition(270, this.Y(392), 0);
    halo.setSiblingIndex(0); // behind face / arrow / stop
    const hg = halo.addComponent(Graphics);
    hg.fillColor = col(C.edge, 0.5);
    hg.circle(0, 0, 80);
    hg.fill();
    this.spinHaloOp = halo.addComponent(UIOpacity);
    this.spinHaloOp.opacity = 0;
    this.spinHalo = halo;
    this.startSpinBreathe();
  }

  /** Idle rest-breathe: a centred glow that scales 1.0↔1.10 + fades 40↔95 over a
   *  slow ~3s sine so the spin CTA feels alive between spins. (Schell "Lens of the
   *  Toy": the base game should feel alive to fidget with before any win.) */
  private startSpinBreathe(): void {
    if (this.reducedMotion) return; // WCAG 2.3.3 — no perpetual idle motion
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
    // Loop-arrow icon reads "autoplay" clearer than the bare play triangle.
    this.icon(glyph.node, 104, 506, 36, 'ic_autoplay', C.active, () => glyph.clear());
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
    this.icon(glyph.node, 436, 507, 30, 'ic_bolt', C.active, () => glyph.clear());
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

  // ── sound glyph (own node so setSoundOn can dim it) + menu glyph (own node
  //    so the authored icon can retire the drawn fallback). ──
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
    // Sound icon at design-x ~425 — paired NEXT TO the menu glyph (user request)
    // with adjacent, non-overlapping ≥44px hit areas.
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

    // muted slash (shown when sound is OFF) — its own node so setSoundOn toggles it.
    const mute = this.gfx('soundMuted');
    mute.moveTo(414, Y(570));
    mute.lineTo(440, Y(596));
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

  /** Soft touch-ripple of LIGHT at a tap (2026-06-11 redesign). The old version
   *  was a STROKED diamond outline expanding to 2.1× — it read as a "rotated box"
   *  flickering on every button press (user-rejected). This replacement is a
   *  FILLED, feathered, stacked-alpha glow that blooms briefly then fades: it
   *  reads as a soft pulse of light, never a shape outline. Per pascal-vfx /
   *  web-animations canon: tap feedback is light + transform, not geometry. */
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
    // 3 stacked FILLED soft diamonds — bright pinpoint core fading to a wide
    // feathered halo. No stroke, no hard edge → reads as a glow, not a box.
    const ring = (rad: number, a: number) => {
      g.fillColor = new Color(e.r, e.g, e.b, a);
      g.moveTo(0, rad);
      g.lineTo(rad, 0);
      g.lineTo(0, -rad);
      g.lineTo(-rad, 0);
      g.close();
      g.fill();
    };
    ring(22, 24); // wide soft halo
    ring(13, 48); // mid
    ring(6, 120); // bright pinpoint core
    const op = n.addComponent(UIOpacity);
    op.opacity = 180;
    // Gentle bloom: scale 0.7 → 1.25 (NOT 2.1× — no big expansion that reads
    // as a growing box), fade out fast. A quick, soft, premium touch-light.
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
    applyFont(lab, color === C.value ? 'display' : 'body');
    // Faux-3D on every MONEY value (balance/win/bet): a hard drop-shadow extrude
    // + dark glyph outline so wins read chunky/tactile, not flat-printed.
    if (color === C.value) this.make3D(lab);
    n.setPosition(new Vec3(x, this.Y(y), 0));
    this.labels[name] = lab;
    return lab;
  }

  /** Drop-shadow (depth) + dark outline (crisp candy edge) — mobile-bar parity
   *  with the web bar's make3D. */
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
    // Hit areas sized ≥62 design-px so they clear the 44 CSS-px touch minimum
    // after the portrait fit scale (~0.72). Centres unchanged; sound moved to
    // match its relocated glyph so it no longer overlaps the menu hit.
    add('hitSpin', 200, 322, 140, 140, emit('spin'));
    add('hitAutoplay', 72, 474, 64, 64, emit('autoplay'));
    add('hitMinus', 170, 474, 67, 64, emit('bet:dec'));
    add('hitPlus', 303, 474, 67, 64, emit('bet:inc'));
    add('hitTurbo', 404, 474, 64, 64, emit('turbo'));
    add('hitSound', 393, 550, 64, 64, () => this.toggleSoundPanel()); // opens the volume slider
    add('hitMenu', 457, 550, 64, 64, emit('menu'));
  }

  // ───────────────────────── public API ─────────────────────────
  on(ev: string, cb: (...args: any[]) => void): this {
    this.events.on(ev, cb);
    return this;
  }
  /** Portrait bottom-docked fit (master fitBottom parity with the web bar). The
   *  540x684 surface width-fits and docks to the screen bottom — lifted by the
   *  device safe-area — and only the OPAQUE control band (BAND_TOP→bottom) covers
   *  the screen; the transparent top lets the reels show through/above. Returns
   *  that control-band height in screen px so the controller can reserve it as
   *  the board's bottom inset (the reels then lift ABOVE the spin cluster). */
  fit(viewW: number, viewH: number): number {
    // Parent is the Canvas root — origin at SCREEN CENTRE. Anchor (0,1): the node
    // origin is its top-left corner.
    let s = Math.min(viewW / W, viewH / H);
    // COMPACT CAP (2026-06-15, owner: "betting panel too tall, 40% max, more
    // compact"). The opaque control band must never exceed COMPACT_MAX_FRAC of the
    // viewport height. On wide/near-square aspects the width-fit blew the band up to
    // ~70% of the screen; capping `s` shrinks the WHOLE bar so it (a) stays ≤40%
    // tall and (b) becomes narrower than the screen → natural left/right side gaps.
    // Tall phones already sit near the cap, so they barely change (stay ~full-width).
    const maxBand = COMPACT_MAX_FRAC * viewH;
    const bandPx = (H - BAND_TOP) * s;
    if (bandPx > maxBand) s *= maxBand / bandPx;
    const safe = safeAreaBottomCocos(viewH);
    this.node.setScale(s, s, 1);
    // Bottom edge sits `safe` px above the screen bottom; centred horizontally
    // (centred → the gap from the screen edges is symmetric when s shrinks the bar).
    this.node.setPosition(new Vec3((-W * s) / 2, -viewH / 2 + safe + H * s, 0));
    return safe + (H - BAND_TOP) * s;
  }
  private fmt(n: number): string {
    // Currency-aware money render: symbol-prefixed ("$1.00"), per-currency decimals,
    // non-finite guarded to "$0.00". maxChars compacts huge values to K/M/B so the
    // amount never escapes its (already shrink-to-fit) slot. (Approval gate N3/N4:
    // consistent decimals, no scientific-notation drift — formatMoney enforces both.)
    return formatMoney(Number.isFinite(n) ? n : 0, this.currency, 9);
  }
  /** Shrink a value label so a long currency amount never escapes its slot
   *  (mobile parity with the web bar's relayoutBanners shrink-to-fit). The
   *  label's anchor is preserved, so only the rendered width collapses. */
  private fitValue(name: string, maxW: number): void {
    const lab = this.labels[name];
    if (!lab) return;
    lab.node.setScale(1, 1, 1);
    lab.updateRenderData(true);
    const w = lab.node.getComponent(UITransform)!.width;
    if (w > maxW && maxW > 4) {
      const k = maxW / w;
      lab.node.setScale(k, k, 1);
    }
  }
  setBalance(n: number): void {
    this.labels['balValue'].string = this.fmt(n);
    this.fitValue('balValue', 84); // stop before the USD chip at x196
  }
  setCurrency(c: string): void {
    this.currency = c;
    // Symbol now rides on every amount, so the separate ISO chip beside the
    // balance is redundant — clear it for the clean "$100.00" expert look.
    this.labels['balCur'].string = '';
  }
  setLastWin(n: number): void {
    this.labels['lastWinValue'].string = this.fmt(n);
    this.fitValue('lastWinValue', 76); // stay inside the LAST WIN banner (→x260)
  }
  setBet(n: number): void {
    const v = this.fmt(n);
    this.labels['stepValue'].string = v;
    this.labels['totalBetValue'].string = v;
    this.labels['betValue'].string = v;
    this.fitValue('stepValue', 90); // inside the stepper pill, between −/+
    this.fitValue('totalBetValue', 76); // inside the TOTAL BET banner (→x480)
    this.fitValue('betValue', 54); // stop before the divider at x330
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
  private reducedMotion = false;
  /** WCAG 2.3.3 — honor reduced-motion: stop the perpetual idle CTA breathe (non-
   *  essential motion). The static CTA still reads; press/state feedback stays. */
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
