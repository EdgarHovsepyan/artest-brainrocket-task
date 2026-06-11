// MVC — VIEW. Builds the whole board from code (background, reel frame, 5 reels,
// HUD, control deck, win-line overlay, ceremony/particle/anticipation layers) and
// exposes an imperative API the Controller drives. The View never reads model
// state and never computes a payout — it only renders what it is told.

import {
  _decorator,
  Button,
  Color,
  Component,
  Graphics,
  Label,
  Node,
  resources,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
  UIOpacity,
  UITransform,
  Vec3,
  view,
} from 'cc';
import { BONUS_MODES, BonusMode, GRID, PAYLINES, SYMBOLS } from '../logic/game-config';
import {
  CONTROLS_LINES,
  maxWinMultiple,
  paytableRows,
  RTP_DISPLAY,
  RULES_LINES,
  VOLATILITY_DISPLAY,
} from '../logic/info-content';
import { createRng } from '../logic/rng';
import { SpinResult } from '../logic/types';
import { winningCellsByReel } from '../logic/win-cells';
import { VIEW_CONFIG } from './view-config';
import { ReelView } from './reel-view';
import { CeremonyView } from './ceremony-view';
import { AnticipationLayer } from './anticipation-layer';
import { ParticleLayer } from './particle-layer';
import { AudioManager } from './audio-manager';
import { applyFont, loadFonts } from './fonts';
import { BuyBonusModal, BuyTier } from './buy-bonus-modal';

const { ccclass } = _decorator;

// ---- Palette: SHINING-POP crystal-violet — magenta on deep violet (was acid/black) ----
// Names kept for minimal churn; values repointed to the shining-pop identity (palette.ts).
const ACID = new Color(255, 0, 127, 255); // primary magenta accent (#ff007f)
const INK = new Color(20, 10, 32, 255); // deep violet glass fill (#140a20)
const PLATE = new Color(25, 17, 64, 255); // HUD panel violet (#191140)
const PLATE_EDGE = new Color(184, 111, 218, 255); // orchid rim (#b86fda)
const SHADOW = new Color(5, 2, 12, 170); // obsidian shadow
const MUTED = new Color(201, 206, 216, 255); // white-smoke caption (kill purple text)

// Per-payline colour identity (WL6): 10 max-contrast candy hues so overlapping
// lines stay readable instead of collapsing into one magenta jumble. All vivid
// enough to clear ~3:1 on the deep-violet bg.
const LINE_HUES = [
  '#ff4fa3', // magenta
  '#ffd23f', // gold
  '#3fe0ff', // cyan
  '#7cff5c', // lime
  '#ff7a3f', // orange
  '#b98cff', // violet
  '#ff6b6b', // coral
  '#5cffd0', // teal
  '#ffa6e6', // pink
  '#c6ff4f', // chartreuse
].map((h) => new Color().fromHEX(h));

const SYM_RES = [
  'sym_wild',
  'sym_h1_crown',
  'sym_h2_heart',
  'sym_h3_diamond',
  'sym_h4_horseshoe',
  'sym_l1_a',
  'sym_l2_k',
  'sym_l3_q',
  'sym_l4_j',
  'sym_l5_10',
];

const fmt = (cents: number) => (cents / 100).toFixed(2);

interface DeckButton {
  node: Node;
  label: Label;
  setActive(on: boolean): void;
}

export interface BuyOption {
  mode: string;
  name: string;
  costText: string;
}

export interface AutoplayPanelConfig {
  counts: readonly number[];
  allowInfinity: boolean;
  stopOnFeature: boolean;
  stopOnBigWin: boolean;
}

export type AutoplayOptionKey = 'stopOnFeature' | 'stopOnBigWin';

export interface SettingsPanelConfig {
  soundOn: boolean;
  turboMode: 0 | 1 | 2;
  reducedFx: boolean;
}

export type SettingsKey = 'sound' | 'turboMode' | 'reducedFx';

@ccclass('SlotView')
export class SlotView extends Component {
  private frames: SpriteFrame[] = [];
  private spinFrames: Record<string, SpriteFrame> = {};
  private brandFrames: Record<string, SpriteFrame> = {};

  private reels: ReelView[] = [];
  private spinButton: Button | null = null;
  private spinSprite: Sprite | null = null;
  private balanceLabel: Label | null = null;
  private betLabel: Label | null = null;
  private winLabel: Label | null = null;
  private bannerLabel: Label | null = null;
  private winLineG: Graphics | null = null;
  private winSpark: Node | null = null;
  // Sequential charged-reveal state (WL1/WL3) — driven by Component.schedule.
  private revealIdx = 0;
  private revealP = 0;
  private revealDur = 0.24;

  private ceremony!: CeremonyView;
  private anticipation!: AnticipationLayer;
  private particles!: ParticleLayer;
  readonly audio = new AudioManager();

  private turboBtn: DeckButton | null = null;
  private autoBtn: DeckButton | null = null;
  private soundBtn: DeckButton | null = null;
  private buyMenu: Node | null = null;
  private buyModal: BuyBonusModal | null = null;
  private buyFab: Node | null = null;
  private buyBetStepCb: ((dir: number) => void) | null = null;
  private autoplayPanel: Node | null = null;
  private autoplayStartCb: ((spins: number) => void) | null = null;
  private autoplayOptionCb: ((key: AutoplayOptionKey, value: boolean) => void) | null = null;
  private settingsPanel: Node | null = null;
  private settingsChangeCb: ((key: SettingsKey, value: number | boolean) => void) | null = null;
  private menuHub: Node | null = null;
  private infoPanel: Node | null = null;
  private infoTab: 'rules' | 'paytable' | 'info' = 'rules';
  private quickBetPanel: Node | null = null;
  private betSelectCb: ((cents: number) => void) | null = null;
  private reducedFx = false;
  private bonusHud: Node | null = null;
  private bonusHudSpins: Label | null = null;
  private bonusHudWin: Label | null = null;
  private bonusWash: Node | null = null;
  private bonusWashOp: UIOpacity | null = null;

  private spinCb: (() => void) | null = null;
  private buyCb: ((mode: string) => void) | null = null;
  private turboCb: (() => void) | null = null;
  private autoCb: (() => void) | null = null;
  private soundCb: (() => void) | null = null;

  private gw = 0;
  private gh = 0;
  private pitch = 0;
  // Title block — stored so fit() can shrink + reparent it to the upper-LEFT in
  // landscape (it stays top-centre in portrait). logoArt holds the breathing
  // sprite on an INNER child so fit()'s scale on logoNode never fights the
  // idle breathe tween.
  private logoNode: Node | null = null;
  private titleCaption: Node | null = null;

  private winLines: { lineIndex: number; count: number }[] = [];
  private winCycle = 0;

  /** When `externalControls` is true the View skips its own HUD + control deck —
   *  the shared BettingBar provides them (the Controller wires it). */
  private externalControls = false;

  async init(externalControls = false): Promise<void> {
    this.externalControls = externalControls;
    await this.loadAssets();
    this.build();
  }

  private loadAssets(): Promise<void> {
    const jobs: Promise<void>[] = [loadFonts()];
    SYM_RES.forEach((name, id) => {
      jobs.push(
        new Promise<void>((res) =>
          resources.load(`sym/${name}/spriteFrame`, SpriteFrame, (err, sf) => {
            if (!err && sf) this.frames[id] = sf;
            res();
          }),
        ),
      );
    });
    ['spin_idle', 'spin_active'].forEach((name) => {
      jobs.push(
        new Promise<void>((res) =>
          resources.load(`ui2/${name}/spriteFrame`, SpriteFrame, (err, sf) => {
            if (!err && sf) this.spinFrames[name] = sf;
            res();
          }),
        ),
      );
    });
    // Brand assets ported from the master: the real logo (black-keyed) + the
    // painted candy background. Missing files fall back to procedural art.
    [
      ['ui2/logo', 'logo'],
      ['bg/bg', 'bg'],
      ['ui2/btn_spin', 'spinArt'],
      ['ui2/studio', 'studio'],
      ['ui2/buy_bonus', 'buyArt'],
      ['win/tier_standard', 'tier0'],
      ['win/tier_hot', 'tier1'],
      ['win/tier_mega', 'tier2'],
    ].forEach(([path, key]) => {
      jobs.push(
        new Promise<void>((res) =>
          resources.load(`${path}/spriteFrame`, SpriteFrame, (err, sf) => {
            if (!err && sf) this.brandFrames[key] = sf;
            res();
          }),
        ),
      );
    });
    return Promise.all(jobs).then(() => undefined);
  }

  // ---- small node helpers ---------------------------------------------------
  private mkNode(name: string, w: number, h: number, parent: Node): Node {
    const n = new Node(name);
    // Inherit the parent's render layer: nodes created AFTER the boot-time
    // relayer pass (lazy panels, rebuilt panels) otherwise sit on DEFAULT,
    // which the 2D UI renderer skips -> invisible UI.
    n.layer = parent.layer;
    n.addComponent(UITransform).setContentSize(w, h);
    parent.addChild(n);
    return n;
  }

  /** Public refit hook — the controller owns cc.view's single resize callback. */
  refit(): void {
    this.fit();
  }

  /** Brand art lookup for sibling surfaces (the bar wears the real spin button). */
  getBrandFrame(key: string): SpriteFrame | null {
    return this.brandFrames[key] ?? null;
  }

  /** Per-mode bonus atmosphere wash (master parity: pink-shimmer / hot-magenta
   *  / electric-violet). Tints the world without re-rendering it. */
  setBonusAtmosphere(mode: 'idle' | 'wilds' | 'crowns' | 'reels'): void {
    const tints: Record<typeof mode, [number, number, number, number]> = {
      idle: [0, 0, 0, 0],
      wilds: [255, 90, 156, 26],
      crowns: [255, 0, 127, 38],
      reels: [186, 60, 218, 44],
    };
    const [r, g, b, a] = tints[mode];
    if (!this.bonusWash) {
      this.bonusWash = this.mkNode('bonus_wash', 2600, 2200, this.node);
      this.bonusWash.addComponent(Graphics);
      this.bonusWashOp = this.bonusWash.addComponent(UIOpacity);
      this.bonusWashOp.opacity = 0;
      this.bonusWash.setSiblingIndex(2); // above the painted bg, under the reels
    }
    const gg = this.bonusWash.getComponent(Graphics)!;
    gg.clear();
    gg.fillColor = new Color(r, g, b, a);
    gg.rect(-1300, -1100, 2600, 2200);
    gg.fill();
    Tween.stopAllByTarget(this.bonusWashOp!);
    tween(this.bonusWashOp!)
      .to(0.45, { opacity: mode === 'idle' ? 0 : 255 }, { easing: 'sineInOut' })
      .start();
  }

  /** Free-spin HUD: spins remaining + running total. Approval point — the
   *  player must always know where they are in the bonus. */
  setBonusHud(spinIdx: number | null, totalSpins: number, runningCents: number): void {
    if (spinIdx == null) {
      if (this.bonusHud) {
        const op = this.bonusHud.getComponent(UIOpacity) ?? this.bonusHud.addComponent(UIOpacity);
        const node = this.bonusHud;
        Tween.stopAllByTarget(op);
        tween(op)
          .to(0.25, { opacity: 0 })
          .call(() => node.destroy())
          .start();
        this.bonusHud = null;
        this.bonusHudSpins = null;
        this.bonusHudWin = null;
      }
      return;
    }
    if (!this.bonusHud) {
      const hud = this.mkNode('bonus_hud', 540, 80, this.node);
      hud.setPosition(0, 388, 0);
      this.surfChrome(hud, 540, 76, 0);
      this.mkLabel('FREE SPINS', -120, 14, 13, MUTED, hud);
      this.bonusHudSpins = this.mkLabel('1 / 8', -120, -14, 22, ACID, hud, true);
      this.mkLabel('TOTAL WIN', 130, 14, 13, MUTED, hud);
      this.bonusHudWin = this.mkLabel('0.00', 130, -14, 22, ACID, hud, true);
      const op = hud.addComponent(UIOpacity);
      op.opacity = 0;
      tween(op).to(0.3, { opacity: 255 }, { easing: 'sineOut' }).start();
      this.bonusHud = hud;
    }
    if (this.bonusHudSpins) this.bonusHudSpins.string = `${spinIdx + 1} / ${totalSpins}`;
    if (this.bonusHudWin) {
      this.bonusHudWin.string = (runningCents / 100).toFixed(2);
      Tween.stopAllByTarget(this.bonusHudWin.node);
      this.bonusHudWin.node.setScale(1.2, 1.2, 1);
      tween(this.bonusHudWin.node)
        .to(0.25, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
        .start();
    }
  }

  /** Network/error modal: dismissible card centred over the dimmed game,
   *  blocks input to background. Title + body + button label. Returns true if
   *  newly shown (controller decides what to do on dismiss via callback). */
  showError(title: string, body: string, buttonLabel: string, onAction: () => void): void {
    this.closeOverlays();
    const existing = this.node.getChildByName('errorModal');
    existing?.destroy();
    const w = 460;
    const h = 220;
    const layer = this.mkNode('errorModal', 2600, 2200, this.node);
    const scrim = layer.addComponent(Graphics);
    scrim.fillColor = new Color(0, 0, 0, 200);
    scrim.rect(-1300, -1100, 2600, 2200);
    scrim.fill();
    // hit-blocking on the scrim
    layer.on(Node.EventType.TOUCH_END, () => undefined);
    const card = this.mkNode('errCard', w, h, layer);
    this.surfChrome(card, w, h, 46);
    this.mkLabel(title, 0, h / 2 - 30, 22, ACID, card, true);
    this.mkLabel(body, 0, h / 2 - 78, 14, MUTED, card);
    this.mkTextButton(
      buttonLabel,
      0,
      -h / 2 + 38,
      180,
      44,
      () => {
        layer.destroy();
        onAction();
      },
      card,
    );
  }

  dismissError(): void {
    this.node.getChildByName('errorModal')?.destroy();
  }

  /** Reality Check (responsible-gaming): blocking session-summary card with
   *  Time / Spins / Bet / Net and CONTINUE (resets the timer) + STOP. */
  showRealityCheck(
    stats: { minutes: number; spins: number; betText: string; netText: string },
    onContinue: () => void,
    onStop: () => void,
  ): void {
    this.closeOverlays();
    this.node.getChildByName('rcModal')?.destroy();
    const w = 460;
    const h = 300;
    const layer = this.mkNode('rcModal', 2600, 2200, this.node);
    const scrim = layer.addComponent(Graphics);
    scrim.fillColor = new Color(10, 10, 14, 200);
    scrim.rect(-1300, -1100, 2600, 2200);
    scrim.fill();
    layer.on(Node.EventType.TOUCH_END, () => undefined);
    const card = this.mkNode('rcCard', w, h, layer);
    this.surfChrome(card, w, h, 50);
    this.mkLabel('REALITY CHECK', 0, h / 2 - 32, 22, ACID, card, true);
    this.mkLabel('You have been playing for a while.', 0, h / 2 - 64, 13, MUTED, card);
    const cells: [string, string][] = [
      ['TIME', `${stats.minutes} min`],
      ['SPINS', String(stats.spins)],
      ['BET', stats.betText],
      ['NET', stats.netText],
    ];
    cells.forEach(([lbl, val], i) => {
      const x = -w / 2 + 58 + (i * (w - 116)) / 3;
      this.mkLabel(lbl, x, 24, 11, MUTED, card);
      this.mkLabel(val, x, 2, 16, new Color(245, 247, 250, 255), card, true);
    });
    this.mkTextButton(
      'STOP',
      -110,
      -h / 2 + 40,
      170,
      46,
      () => {
        layer.destroy();
        onStop();
      },
      card,
    );
    this.mkTextButton(
      'CONTINUE',
      110,
      -h / 2 + 40,
      170,
      46,
      () => {
        layer.destroy();
        onContinue();
      },
      card,
    ).setActive(true);
  }

  /** Master drawSurfChrome port — ONE premium panel language for every popup:
   *  violet glass gradient body, glossy top sheen, magenta bloom + hot border,
   *  cyan dispersion hairline, optional title divider. Gradients approximated
   *  with stacked stops (cc.Graphics has none). */
  private surfChrome(parent: Node, w: number, h: number, titleDivAt = 0): Graphics {
    const g = parent.addComponent(Graphics);
    g.fillColor = new Color(25, 16, 52, 248);
    g.roundRect(-w / 2, -h / 2, w, h, 16);
    g.fill();
    g.fillColor = new Color(13, 8, 30, 240);
    g.roundRect(-w / 2, -h / 2, w, h * 0.55, 14);
    g.fill();
    g.fillColor = new Color(255, 255, 255, 13);
    g.roundRect(-w / 2 + 3, h / 2 - h * 0.24, w - 6, h * 0.21, 12);
    g.fill();
    g.lineWidth = 7;
    g.strokeColor = new Color(255, 0, 127, 55);
    g.roundRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2, 17);
    g.stroke();
    g.lineWidth = 2.5;
    g.strokeColor = new Color(255, 90, 156, 255);
    g.roundRect(-w / 2, -h / 2, w, h, 16);
    g.stroke();
    g.lineWidth = 1;
    g.strokeColor = new Color(191, 232, 255, 45);
    g.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 13);
    g.stroke();
    if (titleDivAt > 0) {
      g.lineWidth = 1.5;
      g.strokeColor = new Color(207, 120, 224, 90);
      g.moveTo(-w / 2 + 18, h / 2 - titleDivAt);
      g.lineTo(w / 2 - 18, h / 2 - titleDivAt);
      g.stroke();
    }
    return g;
  }

  /** Screen px reserved at the bottom for the web bar's solid band — the board
   *  contain-fits into the remaining area and centres above it. */
  setBottomInset(px: number): void {
    this.bottomInset = px;
    this.fit();
  }

  private mkLabel(
    text: string,
    x: number,
    y: number,
    size: number,
    col: Color,
    parent = this.node,
    display = false,
  ): Label {
    const n = this.mkNode('lbl', 460, size + 8, parent);
    n.setPosition(x, y, 0);
    const l = n.addComponent(Label);
    l.string = text;
    l.fontSize = size;
    l.lineHeight = size + 4;
    l.color = col;
    l.isBold = true;
    l.horizontalAlign = Label.HorizontalAlign.CENTER;
    applyFont(l, display ? 'display' : 'body');
    return l;
  }

  private mkPlate(
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    accentTop = false,
  ): void {
    const sh = this.mkNode('plate_sh', w, h, this.node);
    sh.setPosition(x, y - 6, 0);
    const sg = sh.addComponent(Graphics);
    sg.fillColor = SHADOW;
    sg.roundRect(-w / 2, -h / 2, w, h, radius);
    sg.fill();

    const p = this.mkNode('plate', w, h, this.node);
    p.setPosition(x, y, 0);
    const g = p.addComponent(Graphics);
    g.fillColor = PLATE;
    g.roundRect(-w / 2, -h / 2, w, h, radius);
    g.fill();
    g.lineWidth = 2;
    g.strokeColor = PLATE_EDGE;
    g.roundRect(-w / 2, -h / 2, w, h, radius);
    g.stroke();
    if (accentTop) {
      g.lineWidth = 3;
      g.strokeColor = ACID;
      g.moveTo(-w / 2 + radius, h / 2 - 1);
      g.lineTo(w / 2 - radius, h / 2 - 1);
      g.stroke();
    }
  }

  private mkReadout(x: number, y: number, caption: string, value: string, valueCol: Color): Label {
    this.mkLabel(caption, x, y + 18, 13, MUTED);
    return this.mkLabel(value, x, y - 14, 28, valueCol);
  }

  /** A drawn text button with press feedback + an active (acid) state. */
  private mkTextButton(
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    cb: () => void,
    parent = this.node,
  ): DeckButton {
    const n = this.mkNode('btn_' + text, w, h, parent);
    n.setPosition(x, y, 0);
    const g = n.addComponent(Graphics);
    const draw = (active: boolean) => {
      g.clear();
      g.fillColor = SHADOW;
      g.roundRect(-w / 2, -h / 2 - 4, w, h, 10);
      g.fill();
      g.fillColor = active ? ACID : PLATE;
      g.roundRect(-w / 2, -h / 2, w, h, 10);
      g.fill();
      g.lineWidth = 2;
      g.strokeColor = ACID;
      g.roundRect(-w / 2, -h / 2, w, h, 10);
      g.stroke();
    };
    draw(false);
    const lbl = this.mkLabel(text, 0, 0, Math.min(18, h * 0.34), Color.WHITE, n);
    n.addComponent(Button);
    n.on(Node.EventType.TOUCH_START, () => n.setScale(0.94, 0.94, 1));
    const release = () => n.setScale(1, 1, 1);
    n.on(Node.EventType.TOUCH_END, release);
    n.on(Node.EventType.TOUCH_CANCEL, release);
    n.on(Button.EventType.CLICK, cb);
    return {
      node: n,
      label: lbl,
      setActive: (on: boolean) => {
        draw(on);
        lbl.color = on ? INK : Color.WHITE;
      },
    };
  }

  // ---- board ---------------------------------------------------------------
  private build(): void {
    const { cell, gap } = VIEW_CONFIG.layout;
    this.gw = GRID.reels * cell + (GRID.reels - 1) * gap;
    this.gh = GRID.rows * cell + (GRID.rows - 1) * gap;
    this.pitch = cell + gap;

    this.buildBackground();
    this.buildTitle();
    this.buildFrame();
    this.buildReels();

    this.winLineG = this.mkNode('winLines', 10, 10, this.node).addComponent(Graphics);
    // Hot leading-edge spark that rides along each line as it draws L->R (WL1).
    // Sibling created AFTER winLines so it renders on top of the stroke.
    const spark = this.mkNode('winSpark', 26, 26, this.node);
    const sg = spark.addComponent(Graphics);
    sg.fillColor = new Color(255, 255, 255, 235);
    sg.moveTo(0, 12);
    sg.lineTo(8, 0);
    sg.lineTo(0, -12);
    sg.lineTo(-8, 0);
    sg.close();
    sg.fill();
    sg.fillColor = new Color(255, 220, 245, 120);
    sg.moveTo(0, 20);
    sg.lineTo(5, 0);
    sg.lineTo(0, -20);
    sg.lineTo(-5, 0);
    sg.close();
    sg.fill();
    spark.active = false;
    this.winSpark = spark;

    // VFX layers above the reels/win-lines
    this.anticipation = this.mkNode('anticipation', 10, 10, this.node).addComponent(
      AnticipationLayer,
    );
    this.particles = this.mkNode('particles', 10, 10, this.node).addComponent(ParticleLayer);

    if (!this.externalControls) {
      this.buildHud();
      this.buildControlDeck();
    }
    this.bannerLabel = this.mkLabel('', 0, 250, 36, ACID, this.node, true);

    // ceremony on top of everything; shakes the whole view node
    this.ceremony = this.mkNode('ceremonyLayer', 10, 10, this.node).addComponent(CeremonyView);
    this.ceremony.build(this.node);

    // Always-visible buy-feature FAB docked in the empty side margin (Pixi parity)
    this.buildBuyFab();

    this.fit();
  }

  /** Floating Buy-Feature button ported from the Pixi flagship: a candy FAB that
   *  lives in the empty left margin, vertically centred on the reels, with idle
   *  breathe/float/glow life and a press squash. A child of this.node, so fit()
   *  rescales/repositions it with the board automatically — no per-frame layout.
   *  Visual-only; taps the SAME buy modal the menu hub uses. */
  private buildBuyFab(): void {
    const sf = this.brandFrames.buyArt ?? null;
    const fab = this.mkNode('buyFab', 96, 96, this.node);
    const fabAnim = this.mkNode('buyFabAnim', 96, 96, fab);
    // Separate press node so the press squash never fights the breathe on fabAnim.
    const fabPress = this.mkNode('buyFabPress', 96, 96, fabAnim);
    let targetW = 100;
    if (sf) {
      const os = sf.originalSize;
      const aw = Math.max(1, os.width);
      const ah = Math.max(1, os.height);
      [fab, fabAnim, fabPress].forEach((n) => n.getComponent(UITransform)!.setContentSize(aw, ah));
      // Glow = tinted, scaled, low-opacity duplicate (Cocos has no BlurFilter, so
      // this approximates the Pixi additive blur).
      const glowN = this.mkNode('buyGlow', aw, ah, fabPress);
      const gsp = glowN.addComponent(Sprite);
      gsp.sizeMode = Sprite.SizeMode.CUSTOM;
      gsp.spriteFrame = sf;
      gsp.color = new Color(255, 90, 156, 255);
      glowN.setScale(1.1, 1.1, 1);
      const gop = glowN.addComponent(UIOpacity);
      gop.opacity = 120;
      if (!this.reducedFx) {
        tween(gop)
          .to(1.2, { opacity: 210 }, { easing: 'sineInOut' })
          .to(1.2, { opacity: 120 }, { easing: 'sineInOut' })
          .union()
          .repeatForever()
          .start();
      }
      const artN = this.mkNode('buyArtSprite', aw, ah, fabPress);
      const asp = artN.addComponent(Sprite);
      asp.sizeMode = Sprite.SizeMode.CUSTOM;
      asp.spriteFrame = sf;
      fab.setScale(targetW / aw, targetW / aw, 1);
    } else {
      // Fallback candy pill if the art frame is missing.
      const g = fabPress.addComponent(Graphics);
      g.fillColor = new Color(179, 36, 126, 255);
      g.roundRect(-48, -48, 96, 96, 22);
      g.fill();
      g.lineWidth = 3;
      g.strokeColor = new Color(143, 232, 255, 255);
      g.roundRect(-48, -48, 96, 96, 22);
      g.stroke();
      this.mkLabel('BUY\nBONUS', 0, 0, 17, new Color(255, 255, 255, 255), fabPress, true);
    }
    // Dock in the left margin (gap from the frame edge), centred on the reels.
    fab.setPosition(-(this.gw / 2 + 14 + targetW / 2), VIEW_CONFIG.layout.reelCenterY, 0);
    // Idle life — breathe (fabAnim scale) + float (fab position). Node tweens only.
    if (!this.reducedFx) {
      tween(fabAnim)
        .to(1.5, { scale: new Vec3(1.05, 1.05, 1) }, { easing: 'sineInOut' })
        .to(1.5, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
        .union()
        .repeatForever()
        .start();
      tween(fab)
        .by(1.9, { position: new Vec3(0, 7, 0) }, { easing: 'sineInOut' })
        .by(1.9, { position: new Vec3(0, -7, 0) }, { easing: 'sineInOut' })
        .union()
        .repeatForever()
        .start();
    }
    // Press squash + tap → open the buy modal (same entry as the menu hub).
    let downAt = 0;
    fab.on(Node.EventType.TOUCH_START, () => {
      downAt = 1;
      Tween.stopAllByTarget(fabPress);
      tween(fabPress)
        .to(0.1, { scale: new Vec3(0.94, 0.94, 1) }, { easing: 'cubicOut' })
        .start();
    });
    const release = (tap: boolean): void => {
      Tween.stopAllByTarget(fabPress);
      tween(fabPress)
        .to(0.42, { scale: new Vec3(1, 1, 1) }, { easing: 'elasticOut' })
        .start();
      if (tap && downAt) {
        this.audio.click();
        this.openBuyMenu();
      }
      downAt = 0;
    };
    fab.on(Node.EventType.TOUCH_END, () => release(true));
    fab.on(Node.EventType.TOUCH_CANCEL, () => release(false));
    this.buyFab = fab;
  }

  /** Hide the FAB while the picker is open / future replay mode; show otherwise. */
  setBuyFabVisible(on: boolean): void {
    if (this.buyFab) this.buyFab.active = on;
  }

  private buildBackground(): void {
    const base = this.mkNode('bg', 2600, 2200, this.node);
    const bg = base.addComponent(Graphics);
    bg.fillColor = new Color(10, 6, 16, 255); // deep violet base (#0a0610)
    bg.rect(-1300, -1100, 2600, 2200);
    bg.fill();
    if (this.brandFrames.bg) {
      // The master's painted candy world, cover-fit over the whole bleed area
      // (2752x1536 source). Procedural depth bands are skipped — the painting
      // carries its own light; bokeh + vignette still layer on top.
      const ratio = 2752 / 1536;
      const w = Math.max(2600, 2200 * ratio);
      const photo = this.mkNode('bg_art', w, w / ratio, this.node);
      const sp = photo.addComponent(Sprite);
      sp.sizeMode = Sprite.SizeMode.CUSTOM;
      sp.spriteFrame = this.brandFrames.bg;
      photo.getComponent(UITransform)!.setContentSize(w, w / ratio);
      const op = photo.addComponent(UIOpacity);
      op.opacity = 235;
    } else {
      // Vertical depth wash — three stacked translucent bands approximate the
      // master's painted gradient (lighter horizon behind the reels, dark floor).
      bg.fillColor = new Color(40, 22, 78, 70); // indigo horizon
      bg.rect(-1300, -120, 2600, 620);
      bg.fill();
      bg.fillColor = new Color(25, 17, 64, 90); // mid violet
      bg.rect(-1300, -560, 2600, 440);
      bg.fill();
      bg.fillColor = new Color(4, 2, 8, 130); // floor shadow
      bg.rect(-1300, -1100, 2600, 460);
      bg.fill();
    }

    // Bokeh field — deterministic scatter of soft candy diamonds (no circles).
    // Seeded RNG so every boot composes identically.
    const dots = this.mkNode('bg_bokeh', 10, 10, this.node);
    const dg = dots.addComponent(Graphics);
    const rng = createRng(20260610).next;
    for (let i = 0; i < 30; i++) {
      const x = (rng() - 0.5) * 1500;
      const y = (rng() - 0.5) * 1100;
      const r = 4 + rng() * 14;
      const warm = rng() > 0.55;
      dg.fillColor = warm
        ? new Color(255, 90, 156, Math.round(10 + rng() * 22)) // pink candy
        : new Color(120, 200, 255, Math.round(8 + rng() * 16)); // cool sparkle
      dg.moveTo(x, y - r);
      dg.lineTo(x + r, y);
      dg.lineTo(x, y + r);
      dg.lineTo(x - r, y);
      dg.close();
      dg.fill();
    }
    tween(dots)
      .to(3.4, { position: new Vec3(0, 10, 0) }, { easing: 'sineInOut' })
      .to(3.4, { position: new Vec3(0, 0, 0) }, { easing: 'sineInOut' })
      .union()
      .repeatForever()
      .start();

    const glow = this.mkNode('bg_glow', 10, 10, this.node);
    glow.setPosition(0, VIEW_CONFIG.layout.reelCenterY, 0);
    const gg = glow.addComponent(Graphics);
    // Ambient depth: faint stacked ACID diamonds (NOT rings — VFX-ban compliant).
    const DIAMONDS = 6;
    for (let i = DIAMONDS; i > 0; i--) {
      const t = i / DIAMONDS;
      const w = 620 * t;
      const h = 470 * t;
      gg.fillColor = new Color(255, 90, 156, Math.round(2 + (1 - t) * 7)); // soft pink bloom (#ff5a9c)
      gg.moveTo(0, -h);
      gg.lineTo(w, 0);
      gg.lineTo(0, h);
      gg.lineTo(-w, 0);
      gg.close();
      gg.fill();
    }
    tween(glow)
      .to(2.6, { scale: new Vec3(1.05, 1.05, 1) }, { easing: 'sineInOut' })
      .to(2.6, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
      .union()
      .repeatForever()
      .start();

    // Directional corner vignette — pulls the eye to the board (master ART-04).
    const vig = this.mkNode('bg_vignette', 10, 10, this.node);
    const vg = vig.addComponent(Graphics);
    vg.fillColor = new Color(0, 0, 0, 110);
    [
      [-1300, 1100, 1, -1],
      [1300, 1100, -1, -1],
      [-1300, -1100, 1, 1],
      [1300, -1100, -1, 1],
    ].forEach(([cx, cy, dx, dy]) => {
      vg.moveTo(cx, cy);
      vg.lineTo(cx + dx * 560, cy);
      vg.lineTo(cx, cy + dy * 420);
      vg.close();
      vg.fill();
    });
  }

  private buildTitle(): void {
    // OUTER node = the transform fit() moves/scales per orientation. The art +
    // breathe live on an INNER child so the responsive scale never fights the
    // idle breathe tween.
    const logo = this.mkNode('logo', 300, 150, this.node);
    logo.setPosition(0, 312, 0);
    this.logoNode = logo;
    const art = this.mkNode('logoArt', 300, 150, logo);
    if (this.brandFrames.logo) {
      // The REAL game logo (master art, black-keyed offline).
      const sp = art.addComponent(Sprite);
      sp.sizeMode = Sprite.SizeMode.CUSTOM;
      sp.spriteFrame = this.brandFrames.logo;
      art.getComponent(UITransform)!.setContentSize(232, 145);
    } else {
      // Fallback: brand-family text block.
      const back = art.addComponent(Graphics);
      back.fillColor = new Color(255, 0, 127, 26);
      back.roundRect(-185, -40, 370, 84, 18);
      back.fill();
      const shining = this.mkLabel('SHINING', 0, 22, 30, new Color(245, 247, 250, 255), art);
      shining.isItalic = true;
      const pop = this.mkLabel('POP  V2', 0, -12, 34, ACID, art);
      pop.isItalic = true;
      const gg = this.mkNode('logo_gems', 10, 10, art).addComponent(Graphics);
      [-208, 208].forEach((x) => {
        gg.fillColor = new Color(255, 90, 156, 200);
        gg.moveTo(x, 14);
        gg.lineTo(x + 9, 2);
        gg.lineTo(x, -10);
        gg.lineTo(x - 9, 2);
        gg.close();
        gg.fill();
      });
    }
    tween(art)
      .to(1.8, { scale: new Vec3(1.025, 1.025, 1) }, { easing: 'sineInOut' })
      .to(1.8, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
      .union()
      .repeatForever()
      .start();
    this.titleCaption = this.mkLabel(
      `MAX WIN ${maxWinMultiple().toLocaleString('en-US')}× · 10 LINES · WILD STRIKE`,
      0,
      230,
      12,
      MUTED,
    ).node;
  }

  private buildFrame(): void {
    const { reelCenterY } = VIEW_CONFIG.layout;
    const w = this.gw + 24;
    const h = this.gh + 24;
    const frame = this.mkNode('frame', w, h, this.node);
    frame.setPosition(0, reelCenterY, 0);
    const g = frame.addComponent(Graphics);
    // Drop shadow grounds the board on the bg (master: every panel floats on shadow).
    g.fillColor = new Color(0, 0, 0, 150);
    g.roundRect(-w / 2 - 6, -h / 2 - 12, w + 12, h + 8, 16);
    g.fill();
    // Master frame proportions (flagship drawReelFrame): no hard bezel box — a
    // layered soft pink halo lifts the window off the bg instead of a 4px border.
    g.lineWidth = 2.5;
    g.strokeColor = new Color(255, 138, 184, 13);
    for (let k = 3; k >= 1; k--) {
      g.roundRect(-w / 2 - k * 2.5, -h / 2 - k * 2.5, w + k * 5, h + k * 5, 12 + k * 2.5);
      g.stroke();
    }
    // Dark glass window — translucent (master 0.72) so the painted bg reads through.
    g.fillColor = new Color(20, 10, 32, 184);
    g.roundRect(-w / 2, -h / 2, w, h, 12);
    g.fill();
    // Flagship 2-color rim system: smoke-white outer + soft pink inner edge.
    g.lineWidth = 2.5;
    g.strokeColor = new Color(245, 247, 250, 140);
    g.roundRect(-w / 2, -h / 2, w, h, 12);
    g.stroke();
    g.lineWidth = 1.6;
    g.strokeColor = new Color(255, 90, 156, 89);
    g.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 9);
    g.stroke();
    // Beveled crystal read (master ART-02): bright top-inner band, deep bottom shadow.
    const bevH = h * 0.12;
    for (let i = 1; i <= 4; i++) {
      const bh = bevH * (1.05 - i * 0.18);
      g.fillColor = new Color(245, 247, 250, Math.round((0.06 - i * 0.012) * 255));
      g.roundRect(-w / 2 + 4, h / 2 - 4 - bh, w - 8, bh, 8);
      g.fill();
    }
    for (let i = 1; i <= 3; i++) {
      g.fillColor = new Color(5, 2, 10, Math.round((0.08 - i * 0.015) * 255));
      g.rect(-w / 2 + 4, -h / 2 + 4 + (i - 1) * 2, w - 8, bevH * 0.65);
      g.fill();
    }
    // Corner gems (faceted diamonds — the brand accent, no circles).
    const gem = (cx: number, cy: number) => {
      g.fillColor = new Color(255, 90, 156, 235);
      g.moveTo(cx, cy + 10);
      g.lineTo(cx + 8, cy);
      g.lineTo(cx, cy - 10);
      g.lineTo(cx - 8, cy);
      g.close();
      g.fill();
      g.fillColor = new Color(255, 255, 255, 120);
      g.moveTo(cx, cy + 4);
      g.lineTo(cx + 3, cy);
      g.lineTo(cx, cy - 4);
      g.lineTo(cx - 3, cy);
      g.close();
      g.fill();
    };
    gem(-w / 2 - 8, h / 2 + 8);
    gem(w / 2 + 8, h / 2 + 8);
    gem(-w / 2 - 8, -h / 2 - 8);
    gem(w / 2 + 8, -h / 2 - 8);

    const sep = this.mkNode('reelSeps', this.gw, this.gh, this.node);
    sep.setPosition(0, reelCenterY, 0);
    const sg = sep.addComponent(Graphics);
    // Master parity: PER-CELL candy plates — soft glass fill + cream border per
    // cell (the flagship's cookie-tile window), not flat columns.
    const { cell, gap } = VIEW_CONFIG.layout;
    for (let r = 0; r < GRID.reels; r++) {
      for (let row = 0; row < GRID.rows; row++) {
        const x = -this.gw / 2 + r * this.pitch + 3;
        const y = this.gh / 2 - row * (cell + gap) - cell + 3;
        sg.fillColor = new Color(255, 255, 255, 8);
        sg.roundRect(x, y, cell - 6, cell - 6, 10);
        sg.fill();
        sg.lineWidth = 2;
        sg.strokeColor = new Color(244, 228, 205, 80); // cream candy rim
        sg.roundRect(x, y, cell - 6, cell - 6, 10);
        sg.stroke();
        sg.fillColor = new Color(255, 255, 255, 10); // top sheen per cell
        sg.roundRect(x + 3, y + cell - 26, cell - 12, 16, 8);
        sg.fill();
      }
    }
  }

  private buildReels(): void {
    const { cell, reelCenterY } = VIEW_CONFIG.layout;
    const reelsRoot = this.mkNode('reels', this.gw, this.gh, this.node);
    reelsRoot.setPosition(0, reelCenterY, 0);
    for (let r = 0; r < GRID.reels; r++) {
      const reelNode = new Node(`reel_${r}`);
      reelsRoot.addChild(reelNode);
      reelNode.setPosition(-this.gw / 2 + cell / 2 + r * this.pitch, 0, 0);
      const rv = reelNode.addComponent(ReelView);
      rv.build(this.frames);
      this.reels[r] = rv;
    }
  }

  private buildHud(): void {
    this.mkPlate(0, -170, 660, 70, 14, true);
    this.balanceLabel = this.mkReadout(-220, -170, 'BALANCE', '0.00', Color.WHITE);
    this.betLabel = this.mkReadout(0, -170, 'BET (10 LINES)', '0.00', MUTED);
    this.winLabel = this.mkReadout(220, -170, 'WIN', '0.00', ACID);
  }

  private buildControlDeck(): void {
    this.buildSpinButton();
    this.mkTextButton('BUY', -248, -296, 80, 56, () => this.toggleBuyMenu());
    this.turboBtn = this.mkTextButton('TURBO', -150, -296, 80, 48, () => this.turboCb?.());
    this.autoBtn = this.mkTextButton('AUTO', 150, -296, 80, 48, () => this.autoCb?.());
    this.soundBtn = this.mkTextButton('SOUND', 248, -296, 80, 56, () => this.soundCb?.());
  }

  private buildSpinButton(): void {
    const size = 116;
    const n = this.mkNode('spinBtn', size, size, this.node);
    n.setPosition(0, -296, 0);
    const sp = n.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.type = Sprite.Type.SIMPLE;
    if (this.spinFrames['spin_idle']) {
      sp.spriteFrame = this.spinFrames['spin_idle'];
    } else {
      const g = n.addComponent(Graphics);
      g.fillColor = ACID;
      // faceted octagon (NOT a circle — VFX-ban compliant)
      const rad = size / 2;
      for (let k = 0; k < 8; k++) {
        const a = (Math.PI / 4) * k - Math.PI / 8;
        const px = Math.cos(a) * rad;
        const py = Math.sin(a) * rad;
        if (k === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.close();
      g.fill();
      this.mkLabel('SPIN', 0, 0, 28, INK, n);
    }
    this.spinSprite = sp;
    this.spinButton = n.addComponent(Button);
    const setF = (k: string) => {
      if (this.spinFrames[k]) sp.spriteFrame = this.spinFrames[k];
    };
    n.on(Node.EventType.TOUCH_START, () => {
      setF('spin_active');
      n.setScale(0.94, 0.94, 1);
    });
    const release = () => {
      setF('spin_idle');
      n.setScale(1, 1, 1);
    };
    n.on(Node.EventType.TOUCH_END, release);
    n.on(Node.EventType.TOUCH_CANCEL, release);
    n.on(Button.EventType.CLICK, () => this.spinCb?.());
  }

  // ---- responsive contain-fit ----------------------------------------------
  private bottomInset = 0;

  private fit(): void {
    const vis = view.getVisibleSize();
    const { designWidth, designHeight, reelCenterY } = VIEW_CONFIG.layout;
    const availH = Math.max(160, vis.height - this.bottomInset);
    // Fit + centre the CONTENT BAND, not the full 760 design. With the shared
    // betting bar (externalControls) there is no bottom control deck, so the
    // live content is just logo-top -> reels-bottom; fitting that band makes the
    // reels fill the screen and removes the dead space the empty deck reserved.
    // Logo top incl. breathing headroom (logo y312, ~145 tall, ×1.04) + margin
    // so it never clips the screen top; reels keep a clean gap above the bar.
    const contentTop = 410;
    const contentBottom = this.externalControls
      ? reelCenterY - this.gh / 2 - 34 // reels bottom + clean gap to the bar
      : -designHeight / 2; // own-HUD build keeps the full design envelope
    const contentH = contentTop - contentBottom;
    const contentCenter = (contentTop + contentBottom) / 2;
    const s = Math.min(vis.width / designWidth, availH / contentH);
    this.node.setScale(s, s, 1);
    // Land the content centre at the centre of the area above the bar.
    this.node.setPosition(0, this.bottomInset / 2 - contentCenter * s, 0);

    // Orientation-gated title + FAB placement (same threshold the rest of the app
    // uses). LANDSCAPE: the big top-centre logo crowded the reels and the FAB was
    // a lone heavy mass on the left making the (already-centred) reels read
    // off-centre. Shrink the logo to the upper-LEFT shoulder and move the FAB to
    // the RIGHT margin so the composition is balanced around the centred reels.
    // PORTRAIT: untouched (top-centre logo, left FAB) — that layout is correct.
    const isLandscape = vis.width > vis.height * 1.05;
    if (this.logoNode) {
      if (isLandscape) {
        this.logoNode.setScale(0.6, 0.6, 1);
        this.logoNode.setPosition(-this.gw / 2 + 30, 322, 0); // above the frame's left shoulder
      } else {
        this.logoNode.setScale(1, 1, 1);
        this.logoNode.setPosition(0, 312, 0);
      }
    }
    if (this.titleCaption) {
      // The long MAX-WIN caption is orphaned at top-centre once the logo moves
      // left; hide it in landscape (the same info lives in the intro peek + info
      // panel) and keep it under the logo in portrait.
      this.titleCaption.active = !isLandscape;
    }
    if (this.buyFab) {
      const fabX = this.gw / 2 + 14 + 50;
      this.buyFab.setPosition(isLandscape ? fabX : -fabX, reelCenterY, 0);
    }
    // Keep the (screen-space) buy modal sized/centred above the bar on resize.
    if (this.buyModal?.isOpen()) this.fitBuyModal();
  }

  // ---- buy menu (premium modal — flagship parity) ---------------------------
  /** Per-mode presentation (accent + one-line special). Visual only — costs and
   *  spin counts come from the model/config, never invented here. */
  private static BUY_PRESENT: Record<string, { accent: string; special: string }> = {
    wilds: { accent: '#ff5ab0', special: 'Wilds stick & bounce every spin' },
    crowns: { accent: '#ffcf5a', special: 'Crowns lock in for the feature' },
    reels: { accent: '#b86fda', special: 'Full wild reels strike in' },
  };

  /** (Re)build the premium buy-feature modal from the model's modes + costs.
   *  Same signature as the old plain list — the controller is unchanged; only the
   *  surface is upgraded to the flagship 3-tier card (committed BuyBonusModal). */
  configureBuyMenu(options: BuyOption[]): void {
    if (!this.buyModal) {
      // SCREEN-SPACE overlay (like the intro), NOT a board child — otherwise the
      // board's contain-fit scale + offset drag the card down into the betting
      // bar and clip its bottom rows. Parent to the Canvas-level root + a high
      // sibling index so it sits above the bar; fitBuyModal() then sizes/centres
      // it within the safe area above the bar.
      const root = this.node.parent ?? this.node;
      const host = this.mkNode('buyModal', 10, 10, root);
      host.setPosition(0, 0, 0);
      host.setSiblingIndex(root.children.length - 1);
      this.buyModal = host.addComponent(BuyBonusModal);
      this.buyModal.on('buy', (mode) => {
        this.buyModal?.close();
        this.buyCb?.(mode as string);
      });
      this.buyModal.on('bet:inc', () => this.buyBetStepCb?.(1));
      this.buyModal.on('bet:dec', () => this.buyBetStepCb?.(-1));
      this.buyModal.on('ui:click', () => this.audio.click());
    }
    const tiers: BuyTier[] = options.map((o, i) => {
      const present = SlotView.BUY_PRESENT[o.mode] ?? { accent: '#ff7ad0', special: '' };
      return {
        mode: o.mode,
        name: o.name,
        spins: BONUS_MODES[o.mode as BonusMode]?.spins ?? 8,
        costText: o.costText,
        special: present.special,
        accent: present.accent,
        frame: this.brandFrames['tier' + i] ?? null,
      };
    });
    this.buyModal.configure(tiers, this.buyBetText);
  }

  private buyBetText = '';
  /** Push the current bet text into the modal's inline stepper (controller sets it). */
  setBuyBet(betText: string): void {
    this.buyBetText = betText;
    this.buyModal?.setBet(betText);
  }
  /** Refresh each tier's live cost after a bet change (controller supplies texts). */
  refreshBuyCosts(costTexts: string[]): void {
    this.buyModal?.setCosts(costTexts);
  }
  /** Wire the modal's inline bet stepper back to the controller's bet ladder. */
  onBuyBetStep(cb: (dir: number) => void): void {
    this.buyBetStepCb = cb;
  }

  private toggleBuyMenu(): void {
    if (this.buyModal?.isOpen()) this.closeBuyMenu();
    else this.openBuyMenu();
  }

  closeBuyMenu(): void {
    this.buyModal?.close();
    this.setBuyFabVisible(true);
  }

  openBuyMenu(): void {
    this.closeOverlays();
    this.fitBuyModal(); // size + centre within the safe area above the bar before showing
    this.buyModal?.open();
    this.audio.buyOpen();
    this.setBuyFabVisible(false); // hide the FAB behind its own picker
  }

  /** Drive the screen-space buy modal's fit with the live bar inset so its bottom
   *  rows (YOUR BET stepper + CANCEL/BUY) never clip behind the betting bar. */
  private fitBuyModal(): void {
    if (!this.buyModal) return;
    const vis = view.getVisibleSize();
    this.buyModal.fit(vis.width, vis.height, this.bottomInset);
  }

  // ---- autoplay panel (parity port of the master's AUTOPLAY drawer) ----------
  /** (Re)build the autoplay panel: count tiles + the two stop toggles.
   *  Rebuilt by the Controller whenever a toggle flips (master parity: the Pixi
   *  drawer re-populates on toggle). Hidden until the AUTO control opens it. */
  configureAutoplayPanel(cfg: AutoplayPanelConfig): void {
    const wasOpen = this.autoplayPanel?.active ?? false;
    this.autoplayPanel?.destroy();
    const counts: number[] = [...cfg.counts];
    if (cfg.allowInfinity) counts.push(Infinity);
    const cols = 3;
    const rows = Math.ceil(counts.length / cols);
    const w = 380;
    const h = 92 + rows * 60 + 2 * 56;
    const panel = this.mkNode('autoplayPanel', w, h, this.node);
    panel.setPosition(0, VIEW_CONFIG.layout.reelCenterY, 0);
    panel.active = wasOpen;
    this.surfChrome(panel, w, h, 44);
    this.mkLabel('AUTOPLAY', 0, h / 2 - 28, 22, ACID, panel);
    this.mkLabel('Number of spins:', 0, h / 2 - 58, 13, MUTED, panel);
    counts.forEach((n, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = (col - 1) * 118;
      const y = h / 2 - 96 - row * 60;
      this.mkTextButton(
        n === Infinity ? '∞' : String(n),
        x,
        y,
        104,
        46,
        () => {
          panel.active = false;
          this.autoplayStartCb?.(n);
        },
        panel,
      );
    });
    const toggleRow = (
      label: string,
      desc: string,
      on: boolean,
      key: AutoplayOptionKey,
      y: number,
    ) => {
      const lbl = this.mkLabel(label, -64, y + 8, 14, MUTED, panel);
      lbl.horizontalAlign = Label.HorizontalAlign.LEFT;
      const d = this.mkLabel(desc, -64, y - 12, 10, MUTED, panel);
      d.horizontalAlign = Label.HorizontalAlign.LEFT;
      const pill = this.mkTextButton(
        on ? 'ON' : 'OFF',
        w / 2 - 64,
        y,
        72,
        36,
        () => this.autoplayOptionCb?.(key, !on),
        panel,
      );
      pill.setActive(on);
    };
    const ty = h / 2 - 96 - rows * 60 - 12;
    toggleRow(
      'Stop on Free Spins',
      'End auto if feature triggers',
      cfg.stopOnFeature,
      'stopOnFeature',
      ty,
    );
    toggleRow('Stop on Big Win', `≥ 25× total bet`, cfg.stopOnBigWin, 'stopOnBigWin', ty - 56);
    this.autoplayPanel = panel;
  }

  openAutoplayPanel(): void {
    this.closeOverlays();
    if (this.autoplayPanel) this.autoplayPanel.active = true;
    this.audio.modalOpen();
  }

  closeAutoplayPanel(): void {
    if (this.autoplayPanel) this.autoplayPanel.active = false;
  }

  // ---- settings panel (parity port of the master's SETTINGS drawer) ----------
  /** (Re)build: Sound toggle · Turbo Speed OFF/TURBO/MEGA pills · Reduced Effects.
   *  Rebuilt by the Controller on every change (master parity: drawer re-populates). */
  configureSettingsPanel(cfg: SettingsPanelConfig): void {
    const wasOpen = this.settingsPanel?.active ?? false;
    this.settingsPanel?.destroy();
    const w = 380;
    const h = 92 + 3 * 62;
    const panel = this.mkNode('settingsPanel', w, h, this.node);
    panel.setPosition(0, VIEW_CONFIG.layout.reelCenterY, 0);
    panel.active = wasOpen;
    this.surfChrome(panel, w, h, 44);
    this.mkLabel('SETTINGS', 0, h / 2 - 28, 22, ACID, panel);
    const row = (label: string, desc: string, y: number) => {
      const l = this.mkLabel(label, -64, y + 8, 14, MUTED, panel);
      l.horizontalAlign = Label.HorizontalAlign.LEFT;
      const d = this.mkLabel(desc, -64, y - 12, 10, MUTED, panel);
      d.horizontalAlign = Label.HorizontalAlign.LEFT;
    };
    let y = h / 2 - 78;
    row('Sound', 'SFX & win audio', y);
    this.mkTextButton(
      cfg.soundOn ? 'ON' : 'OFF',
      w / 2 - 64,
      y,
      72,
      36,
      () => this.settingsChangeCb?.('sound', !cfg.soundOn),
      panel,
    ).setActive(cfg.soundOn);
    y -= 62;
    row('Turbo Speed', 'Spin pacing — affects auto delay', y);
    (['OFF', 'TURBO', 'MEGA'] as const).forEach((name, mode) => {
      this.mkTextButton(
        name,
        w / 2 - 178 + mode * 62,
        y,
        56,
        32,
        () => this.settingsChangeCb?.('turboMode', mode),
        panel,
      ).setActive(cfg.turboMode === mode);
    });
    y -= 62;
    row('Reduced Effects', 'Less motion & particles', y);
    this.mkTextButton(
      cfg.reducedFx ? 'ON' : 'OFF',
      w / 2 - 64,
      y,
      72,
      36,
      () => this.settingsChangeCb?.('reducedFx', !cfg.reducedFx),
      panel,
    ).setActive(cfg.reducedFx);
    this.settingsPanel = panel;
  }

  openSettingsPanel(): void {
    this.closeOverlays();
    if (this.settingsPanel) this.settingsPanel.active = true;
    this.audio.modalOpen();
  }

  closeSettingsPanel(): void {
    if (this.settingsPanel) this.settingsPanel.active = false;
  }

  // ---- GAME INFORMATION panel (master parity: Rules / Paytable / Info tabs) --
  /** Rebuild the info panel on the given tab. Content derives from logic data
   *  (paytable rows, computed max win) so the panel can never drift from the math. */
  private buildInfoPanel(tab: 'rules' | 'paytable' | 'info'): void {
    const wasOpen = this.infoPanel?.active ?? true;
    this.infoPanel?.destroy();
    this.infoTab = tab;
    const w = 460;
    const h = 560;
    const panel = this.mkNode('infoPanel', w, h, this.node);
    panel.setPosition(0, VIEW_CONFIG.layout.reelCenterY - 40, 0);
    panel.active = wasOpen;
    this.surfChrome(panel, w, h, 46);
    this.mkLabel('GAME INFORMATION', 0, h / 2 - 26, 20, ACID, panel);
    (['rules', 'paytable', 'info'] as const).forEach((name, i) => {
      this.mkTextButton(
        name.toUpperCase(),
        (i - 1) * 130,
        h / 2 - 66,
        118,
        34,
        () => this.buildInfoPanel(name),
        panel,
      ).setActive(tab === name);
    });
    const top = h / 2 - 104;
    const left = (text: string, y: number, size = 12, col = MUTED) => {
      const l = this.mkLabel(text, -w / 2 + 24, y, size, col, panel);
      l.horizontalAlign = Label.HorizontalAlign.LEFT;
      return l;
    };
    if (tab === 'rules') {
      let y = top;
      for (const line of RULES_LINES) {
        left('· ' + line, y);
        y -= 26;
      }
      y -= 14;
      left('CONTROLS', y, 14, ACID);
      y -= 26;
      for (const line of CONTROLS_LINES) {
        left(line, y);
        y -= 24;
      }
    } else if (tab === 'paytable') {
      left('SYMBOL', top, 11, ACID);
      [3, 4, 5].forEach((n, i) => {
        const head = this.mkLabel(`x${n}`, w / 2 - 170 + i * 62, top, 11, ACID, panel);
        head.horizontalAlign = Label.HorizontalAlign.RIGHT;
      });
      let y = top - 28;
      for (const row of paytableRows()) {
        left(row.name, y, 12);
        [row.pay3, row.pay4, row.pay5].forEach((pay, i) => {
          const v = this.mkLabel(String(pay), w / 2 - 170 + i * 62, y, 12, MUTED, panel);
          v.horizontalAlign = Label.HorizontalAlign.RIGHT;
        });
        y -= 30;
      }
      left('Pays are line-bet multiples.', y - 6, 10);
    } else {
      let y = top;
      const stat = (label: string, value: string) => {
        left(label, y, 12);
        const v = this.mkLabel(value, w / 2 - 80, y, 13, ACID, panel);
        v.horizontalAlign = Label.HorizontalAlign.RIGHT;
        y -= 30;
      };
      stat('RTP', RTP_DISPLAY);
      stat('MAX WIN', `${maxWinMultiple().toLocaleString('en-US')}× line bet`);
      stat('VOLATILITY', VOLATILITY_DISPLAY);
      stat('LINES', String(PAYLINES.length));
      stat('GRID', `${GRID.reels}×${GRID.rows}`);
      y -= 10;
      left('RTP is calculated over many plays.', y, 10);
      y -= 22;
      left('Individual sessions may vary.', y, 10);
    }
    const close = this.mkTextButton(
      'CLOSE',
      0,
      -h / 2 + 38,
      120,
      40,
      () => this.closeInfoPanel(),
      panel,
    );
    void close;
    this.infoPanel = panel;
  }

  openInfoPanel(): void {
    this.closeOverlays();
    if (!this.infoPanel) this.buildInfoPanel(this.infoTab);
    if (this.infoPanel) this.infoPanel.active = true;
    this.audio.modalOpen();
  }

  closeInfoPanel(): void {
    if (this.infoPanel) this.infoPanel.active = false;
  }

  // ---- MENU hub (master pending item: menu shows more than one destination) --
  /** Small hub the bar's menu glyph opens: BUY FEATURE / SETTINGS / AUTOPLAY. */
  openMenuHub(): void {
    if (!this.menuHub) this.menuHub = this.buildMenuHub();
    this.closeOverlays();
    this.menuHub.active = true;
  }

  private buildMenuHub(): Node {
    const entries: [string, () => void][] = [
      ['BUY FEATURE', () => this.openBuyMenu()],
      ['QUICK BET', () => this.openQuickBetPanel()],
      ['GAME INFO', () => this.openInfoPanel()],
      ['SETTINGS', () => this.openSettingsPanel()],
      ['AUTOPLAY', () => this.openAutoplayPanel()],
    ];
    const w = 300;
    const h = 64 + entries.length * 60;
    const hub = this.mkNode('menuHub', w, h, this.node);
    hub.setPosition(0, VIEW_CONFIG.layout.reelCenterY, 0);
    hub.active = false;
    this.surfChrome(hub, w, h, 44);
    this.mkLabel('MENU', 0, h / 2 - 26, 20, ACID, hub);
    entries.forEach(([label, open], i) => {
      this.mkTextButton(
        label,
        0,
        h / 2 - 78 - i * 60,
        240,
        46,
        () => {
          hub.active = false;
          open();
        },
        hub,
      );
    });
    return hub;
  }

  /** Hide every floating panel (one overlay at a time, master parity). */
  closeOverlays(): void {
    this.closeBuyMenu();
    if (this.autoplayPanel) this.autoplayPanel.active = false;
    if (this.settingsPanel) this.settingsPanel.active = false;
    if (this.menuHub) this.menuHub.active = false;
    if (this.infoPanel) this.infoPanel.active = false;
    if (this.quickBetPanel) this.quickBetPanel.active = false;
  }

  // ---- QUICK BET panel (master parity: preset stake grid, not raw arithmetic) --
  configureQuickBetPanel(levelsCents: readonly number[], currentCents: number): void {
    const wasOpen = this.quickBetPanel?.active ?? false;
    this.quickBetPanel?.destroy();
    const cols = 3;
    const rows = Math.ceil(levelsCents.length / cols);
    const w = 380;
    const h = 96 + rows * 60;
    const panel = this.mkNode('quickBetPanel', w, h, this.node);
    panel.setPosition(0, VIEW_CONFIG.layout.reelCenterY, 0);
    panel.active = wasOpen;
    this.surfChrome(panel, w, h, 44);
    this.mkLabel('QUICK BET', 0, h / 2 - 28, 22, ACID, panel);
    this.mkLabel('Total bet (10 lines):', 0, h / 2 - 58, 13, MUTED, panel);
    levelsCents.forEach((cents, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      this.mkTextButton(
        fmt(cents),
        (col - 1) * 118,
        h / 2 - 96 - row * 60,
        104,
        46,
        () => {
          panel.active = false;
          this.betSelectCb?.(cents);
        },
        panel,
      ).setActive(cents === currentCents);
    });
    this.quickBetPanel = panel;
  }

  openQuickBetPanel(): void {
    this.closeOverlays();
    if (this.quickBetPanel) this.quickBetPanel.active = true;
    this.audio.modalOpen();
  }

  onBetSelect(cb: (cents: number) => void): void {
    this.betSelectCb = cb;
  }

  // ---- INTRO GATE — first-gesture overlay (audio unlock + branded arrival) ----
  /** Full-screen tap-to-play overlay. The FIRST gesture anywhere must unlock the
   *  AudioContext (master learning) — the controller wires that; this is the
   *  branded surface. */
  buildIntro(onDismiss: () => void): void {
    // The intro is a SCREEN overlay, not part of the game board. Parent it to the
    // Canvas root (sibling of the view + bar) so the board fit() transform never
    // drags it, and a high sibling index keeps it ABOVE the betting bar — the old
    // bug where the bar covered the lower intro (CTA/studio "only logo showing").
    const root = this.node.parent ?? this.node;
    // Oversized so it covers any aspect even before the board fit settles.
    const ov = this.mkNode('intro', 4000, 3200, root);
    const g = ov.addComponent(Graphics);
    // Softer dim (was 232 ≈ opaque) so the painted candy world reads THROUGH the
    // gate — branded arrival over the real bg, not a flat black card.
    g.fillColor = new Color(8, 4, 16, 150);
    g.rect(-2000, -1600, 4000, 3200);
    g.fill();
    // Deeper centre pool behind the logo so the wordmark keeps its contrast.
    g.fillColor = new Color(6, 3, 12, 90);
    g.rect(-900, -520, 1800, 1040);
    g.fill();
    // Corner vignette so the eye pulls to the centre (matches the board ART-04).
    g.fillColor = new Color(0, 0, 0, 120);
    [
      [-1300, 1100, 1, -1],
      [1300, 1100, -1, -1],
      [-1300, -1100, 1, 1],
      [1300, -1100, -1, 1],
    ].forEach(([cx, cy, dx, dy]) => {
      g.moveTo(cx, cy);
      g.lineTo(cx + dx * 620, cy);
      g.lineTo(cx, cy + dy * 480);
      g.close();
      g.fill();
    });

    // Soft candy glow behind the logo — layered pink diamonds (no circles),
    // slowly breathing. Gives the arrival depth instead of a flat black field.
    const glow = this.mkNode('introGlow', 10, 10, ov);
    glow.setPosition(0, 70, 0);
    const gg = glow.addComponent(Graphics);
    for (let k = 6; k > 0; k--) {
      const t = k / 6;
      const w = 520 * t;
      const h = 360 * t;
      gg.fillColor = new Color(255, 90, 156, Math.round(3 + (1 - t) * 9));
      gg.moveTo(0, -h);
      gg.lineTo(w, 0);
      gg.lineTo(0, h);
      gg.lineTo(-w, 0);
      gg.close();
      gg.fill();
    }
    tween(glow)
      .to(2.4, { scale: new Vec3(1.06, 1.06, 1) }, { easing: 'sineInOut' })
      .to(2.4, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
      .union()
      .repeatForever()
      .start();

    // Deterministic floating candy sparkles (seeded — identical every boot).
    const spk = this.mkNode('introSparks', 10, 10, ov);
    const sg = spk.addComponent(Graphics);
    const rng = createRng(20260611).next;
    for (let i = 0; i < 16; i++) {
      const x = (rng() - 0.5) * 1200;
      const y = (rng() - 0.5) * 900;
      const r = 4 + rng() * 9;
      sg.fillColor =
        rng() > 0.5
          ? new Color(255, 120, 180, Math.round(40 + rng() * 60))
          : new Color(160, 210, 255, Math.round(30 + rng() * 50));
      sg.moveTo(x, y - r);
      sg.lineTo(x + r, y);
      sg.lineTo(x, y + r);
      sg.lineTo(x - r, y);
      sg.close();
      sg.fill();
    }
    tween(spk)
      .to(3.6, { position: new Vec3(0, 22, 0) }, { easing: 'sineInOut' })
      .to(3.6, { position: new Vec3(0, 0, 0) }, { easing: 'sineInOut' })
      .union()
      .repeatForever()
      .start();

    // LOGO — entrance pop (scale + fade) then a gentle breathing loop.
    const logoNode = this.mkNode('introLogo', 440, 276, ov);
    logoNode.setPosition(0, 70, 0);
    const logoOp = logoNode.addComponent(UIOpacity);
    logoOp.opacity = 0;
    if (this.brandFrames.logo) {
      const sp = logoNode.addComponent(Sprite);
      sp.sizeMode = Sprite.SizeMode.CUSTOM;
      sp.spriteFrame = this.brandFrames.logo;
    } else {
      const t1 = this.mkLabel('SHINING', 0, 40, 34, new Color(245, 247, 250, 255), logoNode);
      t1.isItalic = true;
      const t2 = this.mkLabel('POP  V2', 0, 2, 38, ACID, logoNode);
      t2.isItalic = true;
    }
    logoNode.setScale(0.72, 0.72, 1);
    tween(logoOp).to(0.4, { opacity: 255 }, { easing: 'quadOut' }).start();
    tween(logoNode)
      .to(0.55, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
      .call(() => {
        tween(logoNode)
          .to(1.8, { scale: new Vec3(1.035, 1.035, 1) }, { easing: 'sineInOut' })
          .to(1.8, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
          .union()
          .repeatForever()
          .start();
      })
      .start();

    // MAX-WIN teaser line (fades in under the logo).
    const teaser = this.mkLabel(
      `MAX WIN ${maxWinMultiple().toLocaleString('en-US')}× · WILD STRIKE`,
      0,
      -70,
      14,
      MUTED,
      ov,
    );
    const teaserOp = teaser.node.addComponent(UIOpacity);
    teaserOp.opacity = 0;
    tween(teaserOp).delay(0.45).to(0.4, { opacity: 220 }).start();

    // CTA — a candy pill with a brighter label so it reads as a button, not text.
    // Dropped below the game-info peek that now occupies the mid-band.
    const ctaGroup = this.mkNode('introCta', 320, 72, ov);
    ctaGroup.setPosition(0, -288, 0);
    const cg = ctaGroup.addComponent(Graphics);
    const drawCta = (glowA: number) => {
      if (!cg.isValid) return; // guard: tween may tick a frame after destroy
      cg.clear();
      cg.fillColor = new Color(255, 90, 156, Math.round(40 + glowA * 50));
      cg.roundRect(-150, -34, 300, 68, 34);
      cg.fill();
      cg.fillColor = new Color(255, 0, 127, 235);
      cg.roundRect(-138, -28, 276, 56, 28);
      cg.fill();
      cg.fillColor = new Color(255, 255, 255, 30);
      cg.roundRect(-132, -22, 264, 20, 18);
      cg.fill();
      cg.lineWidth = 2;
      cg.strokeColor = new Color(255, 200, 235, 235);
      cg.roundRect(-138, -28, 276, 56, 28);
      cg.stroke();
    };
    drawCta(0);
    this.mkLabel('TAP TO PLAY', 0, 0, 22, new Color(255, 255, 255, 255), ctaGroup);
    const ctaOp = ctaGroup.addComponent(UIOpacity);
    ctaOp.opacity = 0;
    tween(ctaOp).delay(0.5).to(0.4, { opacity: 255 }).start();
    tween(ctaGroup)
      .delay(0.5)
      .to(0.9, { scale: new Vec3(1.06, 1.06, 1) }, { easing: 'sineInOut' })
      .to(0.9, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
      .union()
      .repeatForever()
      .start();
    // Pulse the pill's outer glow in sync (proxy tween drives the redraw).
    const glowProxy = { v: 0 };
    tween(glowProxy)
      .delay(0.5)
      .to(0.9, { v: 1 }, { onUpdate: () => drawCta(glowProxy.v) })
      .to(0.9, { v: 0 }, { onUpdate: () => drawCta(glowProxy.v) })
      .union()
      .repeatForever()
      .start();

    // GAME-INFO PEEK — show OUR game (top-paying symbols + their payouts +
    // RTP/volatility/lines + the buy-feature names), not just a MAX teaser, and
    // NOT the removed third-party studio badge. Every value is read-only from the
    // LOCKED math/data (paytableRows / RTP_DISPLAY / VOLATILITY_DISPLAY /
    // PAYLINES / BONUS_MODES) so the intro can never drift from the paytable.
    const peek = this.mkNode('introPeek', 460, 170, ov);
    peek.setPosition(0, -150, 0);
    const peekOp = peek.addComponent(UIOpacity);
    peekOp.opacity = 0;
    const top = paytableRows().slice(0, 4); // Wild + top highs (PAYTABLE order)
    const gapX = 100;
    top.forEach((row, i) => {
      const cx = (i - (top.length - 1) / 2) * gapX;
      const cell = this.mkNode(`peekSym${row.id}`, 58, 58, peek);
      cell.setPosition(cx, 22, 0);
      const sf = this.frames[row.id];
      if (sf) {
        const sp = cell.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.spriteFrame = sf;
      } else {
        this.mkLabel(row.name, 0, 0, 12, new Color(245, 247, 250, 255), cell);
      }
      this.mkLabel(`×${row.pay5}`, cx, -16, 16, ACID, peek);
    });
    this.mkLabel(
      `RTP ${RTP_DISPLAY}  ·  VOL ${VOLATILITY_DISPLAY}  ·  ${PAYLINES.length} LINES`,
      0,
      -56,
      14,
      MUTED,
      peek,
    );
    this.mkLabel(
      `BUY: ${Object.values(BONUS_MODES)
        .map((m) => m.name)
        .join('   ·   ')}`,
      0,
      -82,
      13,
      new Color(255, 150, 200, 255),
      peek,
    );
    tween(peekOp).delay(0.6).to(0.5, { opacity: 235 }).start();

    // Screen-fit the gate (it's a Canvas overlay now, not board-space): scale so
    // the logo→studio band fits the viewport, centred at screen centre. Raise it
    // above the bar — the bar node is created AFTER the intro in boot, so re-assert
    // the top sibling index next frame (when the bar exists).
    const vis = view.getVisibleSize();
    // Taller content band now (logo → peek → CTA), so fit to ~880 of height so
    // the bottom CTA never clips on a short/portrait viewport.
    const introS = Math.min(vis.width / 480, vis.height / 880, 1.3);
    ov.setScale(introS, introS, 1);
    ov.setPosition(0, 0, 0);
    const raise = (): void => {
      if (ov.isValid && ov.parent) ov.setSiblingIndex(ov.parent.children.length - 1);
    };
    raise();
    this.scheduleOnce(raise, 0);

    // Tap anywhere → a quick confirming flash + logo punch, then fade the gate.
    ov.once(Node.EventType.TOUCH_END, () => {
      this.audio.click();
      // Stop the repeatForever glow proxy (a PLAIN-object tween that would
      // otherwise keep ticking after ov.destroy() and redraw a destroyed
      // Graphics → crash). Node tweens auto-stop on destroy; this one does not.
      Tween.stopAllByTarget(glowProxy);
      Tween.stopAllByTarget(logoNode);
      tween(logoNode)
        .to(0.12, { scale: new Vec3(1.12, 1.12, 1) }, { easing: 'quadOut' })
        .to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'quadIn' })
        .start();
      // Soft confirming bloom — sized to FULLY cover the 4000×3200 scrim (the old
      // 2600×2200 flash left a dim border ring that read as a white rectangle),
      // kept brief + low-alpha so it can't pop as a separate white stage.
      const flash = this.mkNode('introFlash', 4000, 3200, ov);
      const fg = flash.addComponent(Graphics);
      fg.fillColor = new Color(255, 240, 250, 255);
      fg.rect(-2000, -1600, 4000, 3200);
      fg.fill();
      const fop = flash.addComponent(UIOpacity);
      fop.opacity = 0;
      tween(fop).to(0.08, { opacity: 55 }).to(0.24, { opacity: 0 }).start();
      // Single clean fade — the gate starts dimming IMMEDIATELY (no 0.18 delay),
      // so there's no "dim lingers under a white flash then flickers out" stage.
      const op = ov.getComponent(UIOpacity) ?? ov.addComponent(UIOpacity);
      tween(op)
        .to(0.32, { opacity: 0 }, { easing: 'quadOut' })
        .call(() => ov.destroy())
        .start();
      onDismiss();
    });
  }

  /** Reduced-effects accessibility flag — gates particles + anticipation drag. */
  setReducedFx(on: boolean): void {
    this.reducedFx = on;
    this.reels.forEach((r) => r.setReducedMotion(on));
  }

  // ---- public API the Controller drives ------------------------------------
  onSpinClicked(cb: () => void): void {
    this.spinCb = cb;
  }
  onBuyClicked(cb: (mode: string) => void): void {
    this.buyCb = cb;
  }
  onTurboClicked(cb: () => void): void {
    this.turboCb = cb;
  }
  onAutoClicked(cb: () => void): void {
    this.autoCb = cb;
  }
  onAutoplayStart(cb: (spins: number) => void): void {
    this.autoplayStartCb = cb;
  }
  onAutoplayOption(cb: (key: AutoplayOptionKey, value: boolean) => void): void {
    this.autoplayOptionCb = cb;
  }
  onSettingsChange(cb: (key: SettingsKey, value: number | boolean) => void): void {
    this.settingsChangeCb = cb;
  }
  onSoundClicked(cb: () => void): void {
    this.soundCb = cb;
  }

  setTurboVisual(on: boolean): void {
    this.turboBtn?.setActive(on);
  }
  setAutoVisual(on: boolean): void {
    this.autoBtn?.setActive(on);
  }
  setSoundVisual(muted: boolean): void {
    if (this.soundBtn) this.soundBtn.label.string = muted ? 'MUTED' : 'SOUND';
  }

  setBalance(cents: number): void {
    if (this.balanceLabel) this.balanceLabel.string = fmt(cents);
  }
  setBet(cents: number): void {
    if (this.betLabel) this.betLabel.string = fmt(cents);
  }
  setWin(cents: number): void {
    if (this.winLabel) this.winLabel.string = fmt(cents);
  }

  /** Transient banner (e.g. "WILD ×3", bonus name). Empty string clears. */
  setBanner(text: string): void {
    const l = this.bannerLabel;
    if (!l) return;
    l.string = text;
    if (text) {
      l.node.setScale(0.6, 0.6, 1);
      tween(l.node)
        .to(0.25, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
        .start();
      this.scheduleOnce(() => {
        if (this.bannerLabel) this.bannerLabel.string = '';
      }, 1.6);
    }
  }

  showGrid(grid: number[][]): void {
    this.reels.forEach((reel, i) => reel.show(grid[i]));
  }

  setInteractable(on: boolean): void {
    if (this.spinButton) this.spinButton.interactable = on;
    const op =
      this.spinSprite?.node.getComponent(UIOpacity) ??
      this.spinSprite?.node.addComponent(UIOpacity);
    if (op) op.opacity = on ? 255 : 130;
  }

  isSpinning(): boolean {
    return this.reels.some((r) => r.spinning);
  }

  /** Slam all reels to their result now (re-click quick-stop). */
  quickStopReels(): void {
    this.anticipation.clear();
    this.reels.forEach((r) => r.quickStop());
  }

  /**
   * Animate every reel to its result; resolves when all settle. `speedMul` < 1 is
   * faster (turbo / bonus). Adds anticipation drag + glow to the late reels when a
   * WILD STRIKE is brewing (>= minEarlyWilds wilds already showing in reels 0..2).
   */
  async playSpin(grid: number[][], speedMul = 1): Promise<void> {
    const { minSpinMs, reelStopStaggerMs } = VIEW_CONFIG.spin;
    const { minEarlyWilds, extraSeconds } = VIEW_CONFIG.anticipation;

    let earlyWilds = 0;
    for (let r = 0; r < 3; r++) for (const id of grid[r]) if (id === SYMBOLS.WILD) earlyWilds++;
    const antic = earlyWilds >= minEarlyWilds && !this.reducedFx;
    const turbo = speedMul <= VIEW_CONFIG.turbo.turbo;

    this.audio.spinStart();
    this.audio.startRush();
    if (antic) this.audio.anticipation();
    await Promise.all(
      this.reels.map((reel, i) => {
        let dur = (minSpinMs + i * reelStopStaggerMs) / 1000;
        if (antic && i >= 3) {
          dur += extraSeconds;
          this.anticipation.spawn(
            this.cellCenter(i, 0).x,
            VIEW_CONFIG.layout.reelCenterY,
            VIEW_CONFIG.layout.cell + 12,
            this.gh + 14,
          );
        }
        return reel.spinTo(grid[i], dur, speedMul).then(() => {
          this.audio.reelStop(i, turbo);
          const wildRows: number[] = [];
          grid[i].forEach((id, row) => {
            if (id === SYMBOLS.WILD) wildRows.push(row);
          });
          if (wildRows.length) {
            reel.flashWilds(wildRows);
            this.audio.wildLand();
          }
          if (i >= 3) this.anticipation.clear();
        });
      }),
    );
    this.audio.stopRush();
    this.anticipation.clear();
  }

  showWins(result: SpinResult): void {
    this.clearWins();
    const byReel = winningCellsByReel(result, GRID.reels);
    // WAVE BLINK (slot-vfx): stagger the per-symbol pulse L->R by reel so the win
    // reads as a wave, not a flash. The rich in-cell sheen/sparkle fires only on
    // FOCUSED wins (<= 8 cells); on dense wins (full wild reel lights 20+ cells)
    // the per-cell white sheens would stack into a wash, so those get pulse+glow.
    const totalCells = byReel.reduce((sum, rows) => sum + (rows ? rows.length : 0), 0);
    const rich = totalCells <= 8;
    this.reels.forEach((reel, i) => reel.highlight(byReel[i] ?? [], i * 0.06, rich));

    this.winLines = result.lineWins.map((w) => ({ lineIndex: w.lineIndex, count: w.count }));
    if (this.winLines.length === 0) return;
    this.startWinLinePulse();
    if (this.reducedFx) {
      // WL8: reduced-motion swaps the animated draw for an instant reveal, but
      // keeps colour identity + the readability cycle.
      this.winCycle = 0;
      this.cycleWinLine();
      this.schedule(this.cycleWinLine, VIEW_CONFIG.win.lineCycleSeconds);
      return;
    }
    // WL3: sequential charged reveal with momentum — more lines draw faster, so
    // dense wins build rhythm instead of one mushy simultaneous flash. Then fall
    // into the existing one-bright cycle for readability.
    this.revealDur = Math.max(0.1, 0.26 - this.winLines.length * 0.016);
    this.revealIdx = 0;
    this.revealP = 0;
    this.schedule(this.tickReveal, 0);
  }

  clearWins(): void {
    this.unschedule(this.cycleWinLine);
    this.unschedule(this.tickReveal);
    if (this.winSpark) this.winSpark.active = false;
    this.stopWinLinePulse();
    this.winLines = [];
    this.winLineG?.clear();
    this.reels.forEach((reel) => reel.clearHighlight());
  }

  /** Subtle idle breathe on the whole win-line overlay once drawn (WL1 tail). */
  private startWinLinePulse(): void {
    const node = this.winLineG?.node;
    if (!node) return;
    const op = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
    Tween.stopAllByTarget(op);
    op.opacity = 255;
    if (this.reducedFx) return;
    tween(op)
      .to(0.55, { opacity: 205 }, { easing: 'sineInOut' })
      .to(0.55, { opacity: 255 }, { easing: 'sineInOut' })
      .union()
      .repeatForever()
      .start();
  }

  private stopWinLinePulse(): void {
    const node = this.winLineG?.node;
    if (!node) return;
    const op = node.getComponent(UIOpacity);
    if (op) {
      Tween.stopAllByTarget(op);
      op.opacity = 255;
    }
  }

  /** Per-frame charged-draw stepper: fully-revealed lines dim, current line drawn
   *  up to revealP with the hot spark at its head, rest not yet shown. */
  private tickReveal = (dt: number): void => {
    if (this.revealIdx >= this.winLines.length) {
      this.unschedule(this.tickReveal);
      if (this.winSpark) this.winSpark.active = false;
      this.winCycle = 0;
      this.cycleWinLine();
      this.schedule(this.cycleWinLine, VIEW_CONFIG.win.lineCycleSeconds);
      return;
    }
    this.revealP += dt / this.revealDur;
    if (this.revealP >= 1) {
      this.revealP = 0;
      this.revealIdx++;
      this.audio.countTick(0.5); // per-line tick as each trace lands
    }
    this.redrawReveal();
  };

  private redrawReveal(): void {
    const g = this.winLineG;
    if (!g) return;
    g.clear();
    for (let i = 0; i < this.revealIdx && i < this.winLines.length; i++) {
      const w = this.winLines[i];
      this.strokeLine(this.linePts(w), false, LINE_HUES[w.lineIndex % LINE_HUES.length]);
    }
    const cur = this.winLines[this.revealIdx];
    if (cur) {
      const pts = this.linePts(cur);
      const drawn: Vec3[] = [];
      const head = this.polyAt(pts, this.revealP, drawn);
      this.strokeLine(drawn, true, LINE_HUES[cur.lineIndex % LINE_HUES.length]);
      if (this.winSpark) {
        this.winSpark.active = true;
        this.winSpark.setPosition(head.x, head.y, 0);
      }
    }
  }

  /** Bounce the sticky cells (persistent wilds/crowns) after a free spin so they
   *  read as locked + alive rather than respun. positions = [reel, row][]. */
  pulseSticky(positions: Array<[number, number]>): void {
    if (!positions || positions.length === 0) return;
    const byReel: number[][] = this.reels.map(() => []);
    for (const [reel, row] of positions) if (byReel[reel]) byReel[reel].push(row);
    this.reels.forEach((reel, i) => {
      if (byReel[i].length) reel.bounceSticky(byReel[i]);
    });
  }

  // Count-up state — driven by Component.schedule, NOT tween({v:0}). A
  // plain-object tween target is never ticked by the TweenSystem in this 3.8.8
  // web runtime (MEMORY cocos-web-runtime-animation-gotchas), so the HUD WIN
  // could snap/freeze; a scheduled frame-stepper always advances.
  private winCountTo = 0;
  private winCountDur = 1;
  private winCountElapsed = 0;
  private winCountLastTick = 0;

  /** Kinetic count-up of the win amount, with audio ticks. */
  countUp(toCents: number): void {
    const { baseMs, logScaleMs, maxMs } = VIEW_CONFIG.counter;
    this.winCountDur = Math.max(
      0.2,
      Math.min(maxMs, baseMs + Math.log10(toCents + 1) * logScaleMs) / 1000,
    );
    this.winCountTo = toCents;
    this.winCountElapsed = 0;
    this.winCountLastTick = 0;
    this.setWin(0);
    this.unschedule(this.tickWin);
    this.schedule(this.tickWin, 0);
  }

  /** Frame-stepped HUD count-up (arrow fn so `this` binds + unschedule matches). */
  private tickWin = (dt: number): void => {
    this.winCountElapsed += dt;
    const p = Math.min(1, this.winCountElapsed / this.winCountDur);
    const v = Math.round(this.winCountTo * p);
    this.setWin(v);
    if (p - this.winCountLastTick > 0.12) {
      this.winCountLastTick = p;
      this.audio.countTick(p);
    }
    if (p >= 1) {
      this.unschedule(this.tickWin);
      this.setWin(this.winCountTo);
    }
  };

  /** Big-win ceremony (tiered). Returns false for small wins (HUD count-up only).
   *  The CONTROLLER owns the triumphant win sting + LDW gate; here we only AV-sync
   *  the ceremony's OWN beats — a physical braam on the detonation frame and a
   *  per-pip tick as the big number rolls (both safe: the ceremony only shows for
   *  8x+ wins, never an LDW return). */
  playCeremony(winCents: number, betCents: number, multiplier: number): boolean {
    this.ceremony.onDetonate = () => {
      if (!this.reducedFx) this.audio.impact();
    };
    this.ceremony.onCountPip = () => this.audio.countTick(0.6);
    return this.ceremony.show(winCents, betCents, multiplier, this.reducedFx);
  }

  showFeatureUnlocked(name: string): void {
    this.ceremony.showFeatureUnlocked(name);
  }

  /** Shard burst from the winning cells, scaled by win/total-bet multiple. */
  burstParticles(result: SpinResult, multiple: number): void {
    if (this.reducedFx) return;
    const centers: Vec3[] = [];
    const seen = new Set<string>();
    for (const w of result.lineWins) {
      const rows = PAYLINES[w.lineIndex];
      for (let reel = 0; reel < w.count; reel++) {
        const key = reel + ',' + rows[reel];
        if (!seen.has(key)) {
          seen.add(key);
          centers.push(this.cellCenter(reel, rows[reel]));
        }
      }
    }
    this.particles.burst(centers, multiple);
  }

  setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
  }

  setVolume(v: number): void {
    this.audio.setVolume(v);
  }

  // ---- winning-line overlay -------------------------------------------------
  private cellCenter(reel: number, row: number): Vec3 {
    const { cell, reelCenterY } = VIEW_CONFIG.layout;
    return new Vec3(
      -this.gw / 2 + cell / 2 + reel * this.pitch,
      reelCenterY + (1 - row) * this.pitch,
      0,
    );
  }

  /** The cell-centre polyline for a winning line. */
  private linePts(w: { lineIndex: number; count: number }): Vec3[] {
    const rows = PAYLINES[w.lineIndex];
    const pts: Vec3[] = [];
    for (let reel = 0; reel < w.count; reel++) pts.push(this.cellCenter(reel, rows[reel]));
    return pts;
  }

  /** Walk `pts` to a fraction of total arc length; push the visited points into
   *  `out` and return the interpolated head (for the leading spark). */
  private polyAt(pts: Vec3[], frac: number, out: Vec3[]): Vec3 {
    out.length = 0;
    if (pts.length === 0) return new Vec3();
    out.push(pts[0]);
    if (pts.length < 2 || frac >= 1) {
      out.length = 0;
      out.push(...pts);
      return pts[pts.length - 1];
    }
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Vec3.distance(pts[i - 1], pts[i]);
    let target = total * Math.max(0, frac);
    let head = pts[0];
    for (let i = 1; i < pts.length; i++) {
      const seg = Vec3.distance(pts[i - 1], pts[i]);
      if (target <= seg) {
        const t = seg > 0 ? target / seg : 0;
        head = new Vec3(
          pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
          pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
          0,
        );
        out.push(head);
        return head;
      }
      target -= seg;
      out.push(pts[i]);
      head = pts[i];
    }
    return head;
  }

  /** Stroke a (possibly partial) polyline: dark underlay + per-line coloured core. */
  private strokeLine(pts: Vec3[], bright: boolean, color: Color): void {
    const g = this.winLineG;
    if (!g || pts.length < 2) return;
    const path = () => {
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    };
    g.lineWidth = bright ? 11 : 7;
    g.strokeColor = new Color(0, 0, 0, bright ? 205 : 115);
    path();
    g.stroke();
    g.lineWidth = bright ? 6 : 3.5;
    g.strokeColor = bright
      ? new Color(color.r, color.g, color.b, 255)
      : new Color(color.r, color.g, color.b, 150);
    path();
    g.stroke();
  }

  private drawWinLine(w: { lineIndex: number; count: number }, bright: boolean): void {
    this.strokeLine(this.linePts(w), bright, LINE_HUES[w.lineIndex % LINE_HUES.length]);
  }

  private cycleWinLine = (): void => {
    const g = this.winLineG;
    if (!g || this.winLines.length === 0) return;
    g.clear();
    for (const w of this.winLines) this.drawWinLine(w, false);
    const cur = this.winLines[this.winCycle % this.winLines.length];
    this.drawWinLine(cur, true);
    this.winCycle++;
  };
}
