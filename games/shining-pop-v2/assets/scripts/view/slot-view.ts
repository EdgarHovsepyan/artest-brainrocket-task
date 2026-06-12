// MVC — VIEW. Builds the whole board from code (background, reel frame, 5 reels,
// HUD, control deck, win-line overlay, ceremony/particle/anticipation layers) and
// exposes an imperative API the Controller drives. The View never reads model
// state and never computes a payout — it only renders what it is told.

import {
  _decorator,
  Button,
  Color,
  Component,
  EffectAsset,
  Graphics,
  Label,
  Material,
  Node,
  resources,
  Sprite,
  SpriteFrame,
  Texture2D,
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
import { SymbolView } from './symbol-view';
import { CeremonyView } from './ceremony-view';
import { AnticipationLayer } from './anticipation-layer';
import { ParticleLayer } from './particle-layer';
import { AudioManager } from './audio-manager';
import { applyFont, loadFonts } from './fonts';
import { PAL } from './palette';
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

// Non-finite guard: a bad value renders 0.00, never "NaN"/"∞" on the win ticker.
const fmt = (cents: number) => ((Number.isFinite(cents) ? cents : 0) / 100).toFixed(2);

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
  /** CC-1 shared shader-material kit. Loaded by `loadAssets()` from
   *  `resources/effects/<name>`. Entries stay `null` on load failure — every
   *  consumer must defend with a Graphics fallback (`getEffectMaterial` returns
   *  null when either the material missed or `vfx.materialsEnabled === false`). */
  private effectMaterials: Record<string, Material | null> = {};

  private reels: ReelView[] = [];
  private spinButton: Button | null = null;
  private spinSprite: Sprite | null = null;
  private balanceLabel: Label | null = null;
  private betLabel: Label | null = null;
  private winLabel: Label | null = null;
  private bannerLabel: Label | null = null;
  private winLineG: Graphics | null = null;
  private winSpark: Node | null = null;
  // Task 4.1 — additive payline-glow segments tracing the same polyline as the
  // Graphics stroke. The Graphics stroke stays as the always-on fallback; if
  // the shader fails / is disabled, these segments just render plain quads tinted.
  private winLineGlow: Node | null = null;
  private winLineGlowSegs: Node[] = [];
  // Task 6.3 — Svarka plasma core (4 stacked-alpha discs riding the line head,
  // pulse-scaled by a schedule stepper) + optional svarka-additive Sprite on
  // top. Replaces the single winSpark diamond. lastSparkPtIdx tracks the head's
  // last-known polyline-cell index so head-crosses-cell can fire sparkCascade.
  private plasmaCore: Node | null = null;
  private plasmaDiscs: Node[] = [];
  private plasmaTime = 0;
  private lastSparkPtIdx = -1;
  // Task 4.3 — flanking idle crystals docked outside the reel frame L/R.
  private flankCrystalL: Node | null = null;
  private flankCrystalR: Node | null = null;
  // Task 4.2 — reel portal warp sprites (top + bottom of the reel block) + bonus
  // grid-merge wipe. All three are additive sprites with optional CCEffect; the
  // fallback is a scale/alpha pulse via Node tween.
  private reelPortalTop: Node | null = null;
  private reelPortalBottom: Node | null = null;
  private gridMergeNode: Node | null = null;
  // Task 4.5 — Buy-Bonus ambient: Graphics glint sheen + optional plasma sprite.
  private buyGlint: Node | null = null;
  private buyPlasma: Node | null = null;
  // Task 1.2 — stacked-alpha feather over reel window mask top/bottom.
  private windowFeatherTop: Node | null = null;
  private windowFeatherBottom: Node | null = null;
  // VISUAL BUST — animated flame sprites (win-fire.effect) behind winning
  // symbols. A pool sized to the grid; activated at winning cell centres on a
  // win, deactivated on clear. Null material (vfx off / load fail) → the
  // radial symbol glow is the fallback.
  private winFlames: Node[] = [];
  private winBeams: Node[] = [];
  private whiteFrame: SpriteFrame | null = null;
  // CC-1 — shared u_time for all CCEffect materials advanced by a single schedule.
  private uTime = 0;
  // Cache of the last bonus-atmosphere mode so a re-entry to the same mode
  // doesn't re-fire the grid-merge wipe.
  private lastBonusMode: 'idle' | 'wilds' | 'crowns' | 'reels' = 'idle';
  // True while a bonus/free-spin feature is running — moves the logo to the
  // reels-left, vertically-centred spot (per fit()).
  private inBonus = false;
  // The buy-FAB's build-time scale (targetW/aw) — fit() multiplies it by a
  // per-orientation factor so the badge stays a consistent on-screen size.
  private buyFabBaseScale = 1;
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
    // CC-1: shared shader-material kit. Each .effect → a Material; failures
    // stay `null` (never throws — consumers fall back to Graphics).
    [
      'payline-glow',
      'reel-portal',
      'grid-merge',
      'crystal-idle',
      'buy-plasma',
      'svarka-additive',
      'win-fire',
      'symbol-win',
      'win-beam',
      'soft-burst',
    ].forEach((key) => {
      this.effectMaterials[key] = null;
      jobs.push(
        new Promise<void>((res) =>
          resources.load(`effects/${key}`, EffectAsset, (err, ea) => {
            if (!err && ea) {
              try {
                const mat = new Material();
                mat.initialize({ effectAsset: ea });
                this.effectMaterials[key] = mat;
              } catch {
                this.effectMaterials[key] = null;
              }
            }
            res();
          }),
        ),
      );
    });
    return Promise.all(jobs).then(() => undefined);
  }

  /** CC-1 accessor — returns the Material for `key`, or null if the master
   *  switch `vfx.materialsEnabled` is off or the .effect failed to load.
   *  Consumers MUST treat `null` as "use the Graphics fallback". */
  getEffectMaterial(key: string): Material | null {
    if (!VIEW_CONFIG.vfx.materialsEnabled) return null;
    return this.effectMaterials[key] ?? null;
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
    // Task 4.2 — fire a grid-merge wipe on every IDLE → bonus transition.
    if (mode !== 'idle' && this.lastBonusMode === 'idle') this.playGridMergeWipe();
    this.lastBonusMode = mode;
    // 2026-06-11 — bonus moves the logo to reels-left / vertical-centre. Refit
    // so the logo repositions immediately on enter/exit.
    const wasBonus = this.inBonus;
    this.inBonus = mode !== 'idle';
    if (this.inBonus !== wasBonus) this.fit();
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
    // Counter is integer-only — coerce defensively so it can NEVER show a
    // decimal/non-finite ("3 / 8", never "3 / 8.0" or "NaN / NaN").
    const _i = (v: number) => (Number.isFinite(v) ? Math.trunc(v) : 0);
    if (this.bonusHudSpins) this.bonusHudSpins.string = `${_i(spinIdx) + 1} / ${_i(totalSpins)}`;
    if (this.bonusHudWin) {
      const _cents = Number.isFinite(runningCents) ? runningCents : 0;
      this.bonusHudWin.string = (_cents / 100).toFixed(2);
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
    const root = this.node.parent ?? this.node;
    root.getChildByName('errorModal')?.destroy();
    const w = 460;
    const h = 220;
    // 2026-06-11 BUG FIX — Canvas-root parent + centred above the bar (same as
    // rcModal). Was a board child → inherited fit()'s scale/offset → clipped.
    const layer = this.mkNode('errorModal', 2600, 2200, root);
    layer.setSiblingIndex(root.children.length - 1);
    const scrim = layer.addComponent(Graphics);
    scrim.fillColor = new Color(0, 0, 0, 200);
    scrim.rect(-1300, -1100, 2600, 2200);
    scrim.fill();
    // hit-blocking on the scrim
    layer.on(Node.EventType.TOUCH_END, () => undefined);
    const card = this.mkNode('errCard', w, h, layer);
    card.setPosition(0, this.bottomInset / 2, 0);
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
    const root = this.node.parent ?? this.node;
    root.getChildByName('errorModal')?.destroy();
  }

  /** Reality Check (responsible-gaming): blocking session-summary card with
   *  Time / Spins / Bet / Net and CONTINUE (resets the timer) + STOP. */
  showRealityCheck(
    stats: { minutes: number; spins: number; betText: string; netText: string },
    onContinue: () => void,
    onStop: () => void,
  ): void {
    this.closeOverlays();
    const root = this.node.parent ?? this.node;
    root.getChildByName('rcModal')?.destroy();
    const w = 460;
    const h = 300;
    // 2026-06-11 BUG FIX — parent to the CANVAS ROOT (not the board) so the
    // modal does NOT inherit the board's fit() scale + offset (which pushed it
    // down into the betting bar with the buttons clipped). The card is then
    // centred in the area ABOVE the bar: Canvas-y = bottomInset/2 (the midpoint
    // of the visible region between the screen top and the bar). Screen-pixel
    // sized (scale 1), so it always fits.
    const layer = this.mkNode('rcModal', 2600, 2200, root);
    layer.setSiblingIndex(root.children.length - 1); // above board + bar
    const scrim = layer.addComponent(Graphics);
    scrim.fillColor = new Color(10, 10, 14, 200);
    scrim.rect(-1300, -1100, 2600, 2200);
    scrim.fill();
    layer.on(Node.EventType.TOUCH_END, () => undefined);
    const card = this.mkNode('rcCard', w, h, layer);
    card.setPosition(0, this.bottomInset / 2, 0); // centre in the area above the bar
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

    // Wave C — additive payline glow segments (4.1) + Svarka plasma core (6.3).
    // Built BEFORE the particles layer so plasma sits underneath shard bursts.
    this.buildWinLineGlow();
    this.buildPlasmaCore();
    // Wave C — reel portal warp + bonus grid-merge wipe (4.2). Hidden until fired.
    this.buildReelPortal();
    this.buildGridMerge();
    // Wave C — flanking idle crystals (4.3). fit() owns their L/R positioning.
    this.buildFlankCrystals();
    // VISUAL BUST — flame sprites behind winning symbols (built after reels so
    // the siblingIndex lookup finds the reels node).
    this.buildWinFlames();
    // CINEMA WAVE — win-line energy beams (win-beam.effect ribbons between
    // winning cells) + the soft-burst under-glow injection: cells lazily swap
    // their banded Graphics radial for the shader burst on first win.
    this.buildWinBeams();
    SymbolView.fxBurstMat = this.getEffectMaterial('soft-burst');
    SymbolView.fxWhiteFrame = this.getWhiteFrame();

    // VFX layers above the reels/win-lines
    this.anticipation = this.mkNode('anticipation', 10, 10, this.node).addComponent(
      AnticipationLayer,
    );
    this.particles = this.mkNode('particles', 10, 10, this.node).addComponent(ParticleLayer);

    // CC-1 schedule stepper advances u_time on all CCEffect materials + plasma pulse.
    this.schedule(this.tickUTime, 0);

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
      this.buyFabBaseScale = targetW / aw; // fit() multiplies this per-orientation
      fab.setScale(this.buyFabBaseScale, this.buyFabBaseScale, 1);
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
    // Idle life — breathe (fabAnim scale) + float (fabAnim position). BOTH on the
    // INNER node so fit() stays the sole owner of the OUTER fab.position; putting
    // the float on `fab` let it overwrite fit()'s dock every frame, pinning the
    // FAB to its build-time left position (the landscape right-dock never took).
    if (!this.reducedFx) {
      tween(fabAnim)
        .to(1.5, { scale: new Vec3(1.05, 1.05, 1) }, { easing: 'sineInOut' })
        .to(1.5, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
        .union()
        .repeatForever()
        .start();
      tween(fabAnim)
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

    // Task 4.5 — Buy-Bonus ambient FX (glint sweep + optional plasma).
    this.addBuyAmbient(fabPress, targetW);
  }

  /** Task 4.5 — diagonal glint sheen swept across the FAB face on a loop +
   *  optional buy-plasma.effect sprite UNDER the button art. The glint is the
   *  always-on Graphics fallback; the plasma is the additive overlay gated by
   *  vfx.materialsEnabled. reducedFx disables both. */
  private addBuyAmbient(fabPress: Node, fabW: number): void {
    if (this.reducedFx) return;
    const cfg = VIEW_CONFIG.buy.ambient;

    // Glint: a tilted bright-white parallelogram swept from L→R behind the art.
    // The fab clips its children (the buy art covers most of the surface), so a
    // sheen that slides across reads as a moving highlight, not a separate node.
    const glintNode = this.mkNode('buyGlint', fabW, fabW, fabPress);
    glintNode.setSiblingIndex(0); // behind the art sprite
    const gg = glintNode.addComponent(Graphics);
    gg.fillColor = new Color(255, 255, 255, 60);
    const gw = fabW * 0.22;
    const gh = fabW * 1.4;
    gg.moveTo(-gw, gh / 2);
    gg.lineTo(gw, gh / 2);
    gg.lineTo(gw + 24, -gh / 2);
    gg.lineTo(-gw + 24, -gh / 2);
    gg.close();
    gg.fill();
    glintNode.angle = -22;
    glintNode.setPosition(-fabW * 0.7, 0, 0);
    const gop = glintNode.addComponent(UIOpacity);
    gop.opacity = 0;
    const sweepDur = cfg.glintSweepMs / 1000;
    const gapDur = cfg.glintGapMs / 1000;
    tween(glintNode)
      .call(() => glintNode.setPosition(-fabW * 0.7, 0, 0))
      .delay(gapDur)
      .call(() => (gop.opacity = 220))
      .to(sweepDur, { position: new Vec3(fabW * 0.7, 0, 0) }, { easing: 'sineInOut' })
      .call(() => (gop.opacity = 0))
      .union()
      .repeatForever()
      .start();
    this.buyGlint = glintNode;

    // Plasma: a Sprite filling the fab face, clipped by the art layer. Material
    // is the additive overlay; without it the sprite is a low-alpha tinted plate.
    const plasmaNode = this.mkNode('buyPlasma', fabW, fabW, fabPress);
    plasmaNode.setSiblingIndex(0); // sits at the back
    const psp = plasmaNode.addComponent(Sprite);
    psp.sizeMode = Sprite.SizeMode.CUSTOM;
    psp.color = new Color(255, 90, 156, Math.round(cfg.plasmaAlpha * 255));
    const plasmaMat = this.getEffectMaterial('buy-plasma');
    if (plasmaMat) psp.customMaterial = plasmaMat;
    this.buyPlasma = plasmaNode;
  }

  /** Hide the FAB while the picker is open / future replay mode; show otherwise. */
  setBuyFabVisible(on: boolean): void {
    if (this.buyFab) this.buyFab.active = on;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Wave D helpers — dismissable-panel scrim + close-X (Tasks 3.1 + 3.2)
  // ════════════════════════════════════════════════════════════════════════

  /** Task 3.1 — full-bleed obsidian wash behind a dismissable panel. TOUCH_END
   *  on the scrim invokes `onTap`, fading out the panel. Compliance modals
   *  (errorModal, rcModal) pass an empty `onTap` so taps are SWALLOWED, not
   *  dismissed — preserves the regulatory "force the user to read" gate. */
  private mkScrim(parent: Node, onTap: () => void): Node {
    const scrim = this.mkNode('scrim', 2600, 2200, parent);
    scrim.setSiblingIndex(0); // behind the panel
    const g = scrim.addComponent(Graphics);
    const sc = new Color().fromHEX(PAL.scrim);
    g.fillColor = new Color(sc.r, sc.g, sc.b, Math.round(VIEW_CONFIG.modal.scrimAlpha * 255));
    g.rect(-1300, -1100, 2600, 2200);
    g.fill();
    scrim.on(Node.EventType.TOUCH_END, () => onTap());
    return scrim;
  }

  /** Task 3.2 — reusable crystal-faceted X in the panel's top-right corner.
   *  Min 44px hit + press squash + cyan-hairline backing plate. Used by all
   *  dismissable panels for an in-family iconography. */
  private mkCloseX(parent: Node, panelW: number, panelH: number, onClose: () => void): Node {
    const cfg = VIEW_CONFIG.modal.closeX;
    const x = panelW / 2 - cfg.inset;
    const y = panelH / 2 - cfg.inset;
    const node = this.mkNode(
      'closeX',
      cfg.size + cfg.hitPadding * 2,
      cfg.size + cfg.hitPadding * 2,
      parent,
    );
    node.setPosition(x, y, 0);
    const g = node.addComponent(Graphics);
    const half = cfg.size / 2;
    // Crystal backing plate — 3 stacked-alpha facets (NEVER hard black).
    g.fillColor = new Color(20, 12, 40, 200);
    g.roundRect(-half, -half, cfg.size, cfg.size, 12);
    g.fill();
    g.fillColor = new Color(70, 30, 110, 130);
    g.roundRect(-half + 3, -half + 3, cfg.size - 6, cfg.size - 6, 10);
    g.fill();
    g.lineWidth = 1.5;
    g.strokeColor = new Color().fromHEX(PAL.cyan);
    g.roundRect(-half, -half, cfg.size, cfg.size, 12);
    g.stroke();
    // X strokes — bold magenta/white double for the 2-color rim system.
    g.lineWidth = cfg.strokeWidth + 2;
    g.strokeColor = new Color(0, 0, 0, 180);
    const x0 = half * 0.45;
    g.moveTo(-x0, x0);
    g.lineTo(x0, -x0);
    g.moveTo(x0, x0);
    g.lineTo(-x0, -x0);
    g.stroke();
    g.lineWidth = cfg.strokeWidth;
    g.strokeColor = new Color(255, 245, 250, 255);
    g.moveTo(-x0, x0);
    g.lineTo(x0, -x0);
    g.moveTo(x0, x0);
    g.lineTo(-x0, -x0);
    g.stroke();
    // Press squash + tap → close.
    node.on(Node.EventType.TOUCH_START, () => {
      Tween.stopAllByTarget(node);
      tween(node)
        .to(0.08, { scale: new Vec3(0.88, 0.88, 1) }, { easing: 'quadOut' })
        .start();
    });
    const release = (tap: boolean): void => {
      Tween.stopAllByTarget(node);
      tween(node)
        .to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
        .start();
      if (tap) {
        this.audio.click();
        onClose();
      }
    };
    node.on(Node.EventType.TOUCH_END, () => release(true));
    node.on(Node.EventType.TOUCH_CANCEL, () => release(false));
    return node;
  }

  /** Convenience: add BOTH the scrim and the close-X to a panel in one call.
   *  panelW/panelH are the panel's content size; onClose is the dismiss callback. */
  private addPanelDismiss(panel: Node, panelW: number, panelH: number, onClose: () => void): void {
    this.mkScrim(panel, () => {
      if (VIEW_CONFIG.modal.dismissOnScrim) onClose();
    });
    this.mkCloseX(panel, panelW, panelH, onClose);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Wave C helpers — payline glow / Svarka / portal / merge / flank crystals
  // ════════════════════════════════════════════════════════════════════════

  /** Task 4.1 — additive sprite segments that trace each currently-drawn
   *  payline. Pre-allocates 5 segments (max line is 5 cells = 4 segments; +1
   *  spare). Each segment is a unit-white Sprite re-sized + rotated per draw. */
  private buildWinLineGlow(): void {
    const parent = this.mkNode('winLineGlow', 10, 10, this.node);
    this.winLineGlow = parent;
    const mat = this.getEffectMaterial('payline-glow');
    const cfg = VIEW_CONFIG.win.glow;
    for (let i = 0; i < 5; i++) {
      const seg = this.mkNode(`glowSeg${i}`, 1, cfg.widthPx, parent);
      const sp = seg.addComponent(Sprite);
      sp.sizeMode = Sprite.SizeMode.CUSTOM;
      if (mat) sp.customMaterial = mat;
      const op = seg.addComponent(UIOpacity);
      op.opacity = Math.round(cfg.alpha * 255);
      seg.active = false;
      this.winLineGlowSegs.push(seg);
    }
  }

  /** Task 6.3 — Svarka plasma core: 3-4 stacked-alpha discs riding the win-line
   *  head + optional svarka-additive Sprite for an additive bright core. The
   *  schedule stepper pulse-scales the discs. */
  private buildPlasmaCore(): void {
    const cfg = VIEW_CONFIG.win.svarka;
    const root = this.mkNode('plasmaCore', 40, 40, this.node);
    root.active = false;
    this.plasmaCore = root;
    for (let i = 0; i < cfg.coreDiscs; i++) {
      const disc = this.mkNode(`disc${i}`, 40, 40, root);
      const g = disc.addComponent(Graphics);
      // Stacked-alpha cyan core: outer dim, inner hot — fakes additive radiance.
      const r = 18 - i * 4;
      const alpha = 60 + i * 50;
      g.fillColor = new Color(127, 231, 255, alpha);
      g.moveTo(0, r);
      g.lineTo(r, 0);
      g.lineTo(0, -r);
      g.lineTo(-r, 0);
      g.close();
      g.fill();
      this.plasmaDiscs.push(disc);
    }
    // Optional additive svarka material on TOP of the discs.
    if (cfg.additiveMaterial) {
      const mat = this.getEffectMaterial('svarka-additive');
      if (mat) {
        const overlay = this.mkNode('plasmaOverlay', 60, 60, root);
        const sp = overlay.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.customMaterial = mat;
        sp.color = new Color().fromHEX(cfg.sparkColor);
      }
    }
  }

  /** VISUAL BUST — a tiny solid-white SpriteFrame so the flame sprites have a
   *  full-rect texture for the win-fire shader to multiply against (the shader
   *  supplies its own flame shape via vfall/hfall; the white frame just gives
   *  it a surface). Created once, reused by every flame sprite. */
  private getWhiteFrame(): SpriteFrame {
    if (this.whiteFrame) return this.whiteFrame;
    const w = 8;
    const data = new Uint8Array(w * w * 4).fill(255);
    // Cocos 3.8.8: reset() configures the GPU texture, uploadData() pushes the
    // raw RGBA bytes. (The ImageAsset({_data}) ctor path crashes the dynamic
    // atlas packer with a texSubImage2D overload error.)
    const tex = new Texture2D();
    tex.reset({ width: w, height: w, format: Texture2D.PixelFormat.RGBA8888 });
    tex.uploadData(data);
    const sf = new SpriteFrame();
    sf.texture = tex;
    sf.packable = false; // keep it OUT of the dynamic atlas (procedural texture)
    this.whiteFrame = sf;
    return sf;
  }

  /** VISUAL BUST — pool of animated flame sprites (win-fire.effect) placed
   *  behind winning symbols. Sized to the full grid (reels×rows). Each is a
   *  white-masked additive sprite with the flame material; hidden until a win
   *  positions + activates it. Null material → stays hidden (radial glow is the
   *  fallback). The flame node sits at siblingIndex below the symbol so the
   *  symbol reads on top of its own fire. */
  private buildWinFlames(): void {
    if (!VIEW_CONFIG.vfx.materialsEnabled) return;
    if (!VIEW_CONFIG.win.fireFlames.enabled) return; // per-symbol fire is in symbol-win now
    const mat = this.getEffectMaterial('win-fire');
    if (!mat) return; // no material → flames disabled, radial glow carries it
    const { cell } = VIEW_CONFIG.layout;
    const count = GRID.reels * GRID.rows;
    const root = this.mkNode('winFlames', 10, 10, this.node);
    // Render below the reels so symbols sit on top of the flame.
    const reelsNode = this.node.getChildByName('reels');
    if (reelsNode) root.setSiblingIndex(Math.max(0, reelsNode.getSiblingIndex()));
    for (let i = 0; i < count; i++) {
      const n = this.mkNode(`flame${i}`, cell * 1.4, cell * 1.7, root);
      const sp = n.addComponent(Sprite);
      sp.sizeMode = Sprite.SizeMode.CUSTOM;
      sp.spriteFrame = this.getWhiteFrame();
      sp.customMaterial = mat;
      sp.color = new Color(255, 255, 255, 255);
      n.active = false;
      this.winFlames.push(n);
    }
  }

  /** Activate flame sprites behind each winning cell centre. */
  private showWinFlames(centers: Vec3[]): void {
    if (this.reducedFx || !this.winFlames.length) return;
    centers.forEach((c, i) => {
      const n = this.winFlames[i];
      if (!n) return;
      // Flame rises FROM the bottom of the symbol → offset down a touch.
      n.setPosition(c.x, c.y - VIEW_CONFIG.layout.cell * 0.18, 0);
      n.active = true;
      n.setScale(0.6, 0.5, 1);
      const op = n.getComponent(UIOpacity) ?? n.addComponent(UIOpacity);
      op.opacity = 0;
      Tween.stopAllByTarget(op);
      Tween.stopAllByTarget(n);
      tween(op).to(0.18, { opacity: 235 }).start();
      tween(n)
        .to(0.22, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
        .start();
    });
  }

  /** Hide all flame sprites (on clear). */
  private hideWinFlames(): void {
    this.winFlames.forEach((n) => {
      if (!n) return;
      Tween.stopAllByTarget(n);
      const op = n.getComponent(UIOpacity);
      if (op) Tween.stopAllByTarget(op);
      n.active = false;
    });
  }

  /** CINEMA WAVE — pooled win-line energy-beam segments (win-beam.effect). Each
   *  is a white-frame additive sprite stretched + rotated between two winning
   *  cell centres. Null material → pool stays empty (embers + symbol fire carry
   *  the win read; no Graphics line fallback — drawn strokes were rejected). */
  private buildWinBeams(): void {
    if (!VIEW_CONFIG.vfx.materialsEnabled || !VIEW_CONFIG.win.beams.enabled) return;
    const mat = this.getEffectMaterial('win-beam');
    if (!mat) return;
    const cfg = VIEW_CONFIG.win.beams;
    const root = this.mkNode('winBeams', 10, 10, this.node);
    for (let i = 0; i < cfg.maxSegments; i++) {
      const n = this.mkNode(`beam${i}`, 100, cfg.heightPx, root);
      const sp = n.addComponent(Sprite);
      sp.sizeMode = Sprite.SizeMode.CUSTOM;
      sp.type = Sprite.Type.SIMPLE;
      sp.spriteFrame = this.getWhiteFrame();
      sp.customMaterial = mat;
      n.addComponent(UIOpacity).opacity = 0;
      n.active = false;
      this.winBeams.push(n);
    }
  }

  /** Lay the pooled beams along each winning line's cell-centre polyline. The
   *  segments overlap their feathered ends so the line reads as ONE continuous
   *  flowing energy ribbon, not jointed sticks. */
  private showWinBeams(lineWins: { lineIndex: number; count: number }[]): void {
    if (this.reducedFx || !this.winBeams.length) return;
    const cfg = VIEW_CONFIG.win.beams;
    let b = 0;
    for (const w of lineWins) {
      const pts = this.linePts(w);
      for (let i = 1; i < pts.length && b < this.winBeams.length; i++) {
        const p0 = pts[i - 1];
        const p1 = pts[i];
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const len = Math.hypot(dx, dy);
        if (len < 1) continue;
        const n = this.winBeams[b++];
        // Overscan 22% so feathered ends overlap into a continuous ribbon.
        n.getComponent(UITransform)!.setContentSize(len * 1.22, cfg.heightPx);
        n.setPosition((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, 0);
        n.angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        n.active = true;
        const op = n.getComponent(UIOpacity)!;
        Tween.stopAllByTarget(op);
        op.opacity = 0;
        tween(op)
          .to(cfg.fadeInMs / 1000, { opacity: cfg.holdOpacity })
          .start();
      }
    }
  }

  private hideWinBeams(): void {
    this.winBeams.forEach((n) => {
      const op = n.getComponent(UIOpacity);
      if (op) Tween.stopAllByTarget(op);
      n.active = false;
    });
  }

  /** Task 4.3 — two faceted-crystal Graphics nodes docked just outside the
   *  reel frame L/R at reelCenterY. Idle breathe + glow pulse via Node tween;
   *  position handled in fit() (orientation-gated). */
  private buildFlankCrystals(): void {
    const cfg = VIEW_CONFIG.decor.flankCrystal;
    if (!cfg.enabled) return; // 2026-06-11 — basic flat diamonds disabled
    const make = (name: string): Node => {
      const n = this.mkNode(name, cfg.sizePx, cfg.sizePx * 1.6, this.node);
      const g = n.addComponent(Graphics);
      const r = cfg.sizePx / 2;
      // Faceted magenta crystal: 3 stacked diamonds (dark → mid → bright facets)
      g.fillColor = new Color(154, 59, 214, 130);
      g.moveTo(0, r * 1.5);
      g.lineTo(r, 0);
      g.lineTo(0, -r * 1.5);
      g.lineTo(-r, 0);
      g.close();
      g.fill();
      g.fillColor = new Color(255, 90, 176, 170);
      g.moveTo(0, r * 1.2);
      g.lineTo(r * 0.6, 0);
      g.lineTo(0, -r * 1.2);
      g.lineTo(-r * 0.6, 0);
      g.close();
      g.fill();
      g.fillColor = new Color(255, 217, 236, 200);
      g.moveTo(0, r * 0.55);
      g.lineTo(r * 0.18, 0);
      g.lineTo(0, -r * 0.55);
      g.lineTo(-r * 0.18, 0);
      g.close();
      g.fill();
      n.active = false; // fit() turns them on when landscape
      // Optional shimmer material on top.
      const mat = this.getEffectMaterial('crystal-idle');
      if (mat) {
        const overlay = this.mkNode('shimmer', cfg.sizePx, cfg.sizePx * 1.6, n);
        const sp = overlay.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.customMaterial = mat;
        sp.color = new Color(255, 200, 240, 80);
      }
      if (!this.reducedFx) {
        // Idle breathe
        tween(n)
          .to(1.4, { scale: new Vec3(1.06, 1.06, 1) }, { easing: 'sineInOut' })
          .to(1.4, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
          .union()
          .repeatForever()
          .start();
      }
      return n;
    };
    this.flankCrystalL = make('flankCrystalL');
    this.flankCrystalR = make('flankCrystalR');
  }

  /** Task 4.2 — additive sprites docked at the reel block top/bottom. Hidden
   *  by default; fire entry/exit pulses on spin launch/settle. */
  private buildReelPortal(): void {
    const cfg = VIEW_CONFIG.spin.portal;
    if (!cfg.enabled) return; // 2026-06-11 — "arrow lines" disabled; skip build
    const portalMat = this.getEffectMaterial('reel-portal');
    const fringe = new Color().fromHEX(cfg.fringeColor);
    const make = (name: string): Node => {
      const n = this.mkNode(name, this.gw + 12, 30, this.node);
      const sp = n.addComponent(Sprite);
      sp.sizeMode = Sprite.SizeMode.CUSTOM;
      sp.color = new Color(fringe.r, fringe.g, fringe.b, 200);
      if (portalMat) sp.customMaterial = portalMat;
      const op = n.addComponent(UIOpacity);
      op.opacity = 0;
      n.active = false;
      return n;
    };
    this.reelPortalTop = make('reelPortalTop');
    this.reelPortalBottom = make('reelPortalBottom');
  }

  /** Task 4.2 — bonus-entry grid merge wipe. A full-bleed sprite swept across
   *  the reel block with grid-merge.effect; fallback = scale/alpha pulse. */
  private buildGridMerge(): void {
    const cfg = VIEW_CONFIG.bonus.mergeWipe;
    const mergeMat = this.getEffectMaterial('grid-merge');
    const n = this.mkNode('gridMergeWipe', this.gw + 12, this.gh + 12, this.node);
    const sp = n.addComponent(Sprite);
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.color = new Color(255, 90, 176, 200);
    if (mergeMat) sp.customMaterial = mergeMat;
    const op = n.addComponent(UIOpacity);
    op.opacity = 0;
    n.active = false;
    void cfg;
    this.gridMergeNode = n;
  }

  /** Fire the reel-portal entry pulse (on spin launch). */
  private playReelPortalEntry(): void {
    if (this.reducedFx) return;
    const cfg = VIEW_CONFIG.spin.portal;
    if (!cfg.enabled) return; // 2026-06-11 — "arrow lines" disabled
    [this.reelPortalTop, this.reelPortalBottom].forEach((n) => {
      if (!n) return;
      n.active = true;
      const op = n.getComponent(UIOpacity);
      if (!op) return;
      Tween.stopAllByTarget(op);
      op.opacity = 0;
      tween(op)
        .to(cfg.entryMs / 1000 / 2, { opacity: 230 }, { easing: 'sineOut' })
        .to(cfg.entryMs / 1000 / 2, { opacity: 0 }, { easing: 'sineIn' })
        .call(() => (n.active = false))
        .start();
    });
  }

  /** Fire the reel-portal exit pulse (on settle). */
  private playReelPortalExit(): void {
    if (this.reducedFx) return;
    const cfg = VIEW_CONFIG.spin.portal;
    if (!cfg.enabled) return; // 2026-06-11 — "arrow lines" disabled
    [this.reelPortalTop, this.reelPortalBottom].forEach((n) => {
      if (!n) return;
      n.active = true;
      const op = n.getComponent(UIOpacity);
      if (!op) return;
      Tween.stopAllByTarget(op);
      op.opacity = 0;
      tween(op)
        .to(cfg.exitMs / 1000 / 2, { opacity: 180 }, { easing: 'quadOut' })
        .to(cfg.exitMs / 1000 / 2, { opacity: 0 }, { easing: 'quadIn' })
        .call(() => (n.active = false))
        .start();
    });
  }

  /** Fire the grid-merge wipe on bonus entry. */
  private playGridMergeWipe(): void {
    if (this.reducedFx) return;
    const cfg = VIEW_CONFIG.bonus.mergeWipe;
    const n = this.gridMergeNode;
    if (!n) return;
    n.active = true;
    const op = n.getComponent(UIOpacity);
    if (!op) return;
    Tween.stopAllByTarget(op);
    op.opacity = 0;
    n.setPosition(0, ((this.gh + 12) / 2) * cfg.dir, 0);
    n.setScale(1, 0.2, 1);
    tween(op)
      .to(cfg.ms / 1000 / 2, { opacity: 230 }, { easing: 'sineOut' })
      .to(cfg.ms / 1000 / 2, { opacity: 0 }, { easing: 'sineIn' })
      .call(() => (n.active = false))
      .start();
    tween(n)
      .to(cfg.ms / 1000, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' })
      .start();
  }

  /** Schedule stepper: advance the shared u_time uniform on all CCEffect
   *  materials so per-frame shader animation ticks reliably (a plain-object
   *  tween wouldn't tick in the 3.8.8 web runtime). Also pulse-scales the
   *  plasma core discs while visible (Task 6.3 corePulse). */
  private tickUTime = (dt: number): void => {
    this.uTime += dt;
    if (VIEW_CONFIG.vfx.materialsEnabled) {
      const keys = [
        'payline-glow',
        'reel-portal',
        'grid-merge',
        'crystal-idle',
        'buy-plasma',
        'svarka-additive',
        'win-fire',
      ];
      for (const k of keys) {
        const m = (this as any).effectMaterials?.[k];
        if (m && typeof m.setProperty === 'function') {
          try {
            m.setProperty('u_time', this.uTime);
          } catch {
            /* swallow */
          }
        }
      }
    }
    // Task 6.3 plasma core pulse — when visible, scale each disc with a sine
    // pulse, slightly out of phase per disc so the core "breathes".
    if (this.plasmaCore && this.plasmaCore.active) {
      const cfg = VIEW_CONFIG.win.svarka;
      this.plasmaTime += dt;
      const period = cfg.corePulseMs / 1000;
      for (let i = 0; i < this.plasmaDiscs.length; i++) {
        const phase = (i / this.plasmaDiscs.length) * Math.PI;
        const s =
          1 +
          (cfg.corePulseScale - 1) *
            0.5 *
            (1 + Math.sin((this.plasmaTime / period) * Math.PI * 2 + phase));
        this.plasmaDiscs[i].setScale(s, s, 1);
      }
    }
  };

  private buildBackground(): void {
    // Task 1.1 — oversize base + painted bg by bgCoverOverscan so the bleed
    // area always exceeds 16:9 / 21:9 / 9:16 / 9:21. Without this the engine
    // cover (#0a0610) shows as a letterbox band on ultrawide and tall viewports.
    const overscan = VIEW_CONFIG.layout.bgCoverOverscan;
    const baseW = Math.round(2600 * overscan);
    const baseH = Math.round(2200 * overscan);
    const base = this.mkNode('bg', baseW, baseH, this.node);
    const bg = base.addComponent(Graphics);
    bg.fillColor = new Color(10, 6, 16, 255); // deep violet base (#0a0610)
    bg.rect(-baseW / 2, -baseH / 2, baseW, baseH);
    bg.fill();
    if (this.brandFrames.bg) {
      // The master's painted candy world, cover-fit over the whole bleed area
      // (2752x1536 source). Procedural depth bands are skipped — the painting
      // carries its own light; bokeh + vignette still layer on top. Overscan
      // (Task 1.1) also lifted into the photo so its painted edges bleed off
      // the viewport on ultrawide/tall rather than docking inside the cover.
      const ratio = 2752 / 1536;
      const w = Math.max(baseW, baseH * ratio);
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
    // Corner gems — bigger faceted crystals (2026-06-11, user: "corner need
    // big"). 3 stacked facets: dark outer → magenta mid → bright white core,
    // for a real cut-gem read instead of a flat diamond.
    const gem = (cx: number, cy: number) => {
      const R = 17; // half-height (was 10)
      g.fillColor = new Color(154, 59, 214, 180); // violet outer facet
      g.moveTo(cx, cy + R);
      g.lineTo(cx + R * 0.8, cy);
      g.lineTo(cx, cy - R);
      g.lineTo(cx - R * 0.8, cy);
      g.close();
      g.fill();
      g.fillColor = new Color(255, 90, 156, 245); // magenta mid facet
      g.moveTo(cx, cy + R * 0.66);
      g.lineTo(cx + R * 0.5, cy);
      g.lineTo(cx, cy - R * 0.66);
      g.lineTo(cx - R * 0.5, cy);
      g.close();
      g.fill();
      g.fillColor = new Color(255, 245, 250, 220); // bright core glint
      g.moveTo(cx, cy + R * 0.28);
      g.lineTo(cx + R * 0.2, cy);
      g.lineTo(cx, cy - R * 0.28);
      g.lineTo(cx - R * 0.2, cy);
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
    // Polish 2026-06-11 — per-REEL column plates (5 total) instead of per-cell
    // (15 total). The per-cell version drew a visible cream border around each
    // cell, making the matrix read as a grid of 15 separate tiles rather than 5
    // continuous reels. AAA slot convention is continuous reels (Lightning,
    // Reactoonz, Gates, etc.) — symbols flow as one unbroken column. The faint
    // fill + soft column rim keep the glass-panel cue without the grid noise.
    const { cell, gap } = VIEW_CONFIG.layout;
    for (let r = 0; r < GRID.reels; r++) {
      const x = -this.gw / 2 + r * this.pitch + 3;
      const y = -this.gh / 2 + 3;
      const colW = cell - 6;
      const colH = this.gh - 6;
      // Soft glass fill — single column, not stacked tiles.
      sg.fillColor = new Color(255, 255, 255, 8);
      sg.roundRect(x, y, colW, colH, 12);
      sg.fill();
      // Subtle column rim — cream candy at low alpha so the reel reads as
      // a glass panel, not a hard frame.
      sg.lineWidth = 1.5;
      sg.strokeColor = new Color(244, 228, 205, 60);
      sg.roundRect(x, y, colW, colH, 12);
      sg.stroke();
      // Top sheen swept across the full column for the gloss.
      sg.fillColor = new Color(255, 255, 255, 10);
      sg.roundRect(x + 3, y + colH - 18, colW - 6, 12, 8);
      sg.fill();
    }
    void gap;
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
    // Task 1.2 — stacked-alpha edge feather over the top + bottom of the
    // GRAPHICS_RECT reel mask so symbols dissolve into the bezel instead of
    // snapping at the hard mask edge. Built once; spans gw, mirrored top/bottom.
    this.buildWindowFeather();
  }

  /** Task 1.2 — 5 stacked translucent dark rects fading inward over
   *  windowFeatherPx, drawn above the reel strips so the cells dissolve into
   *  the bezel at the mask edge. Two nodes total: one at the top of the reel
   *  window, one at the bottom. */
  private buildWindowFeather(): void {
    const { reelCenterY, windowFeatherPx } = VIEW_CONFIG.layout;
    const make = (sign: 1 | -1, name: string): Node => {
      const n = this.mkNode(name, this.gw + 4, windowFeatherPx, this.node);
      const g = n.addComponent(Graphics);
      const steps = 5;
      // sign = +1: top edge → dark band sits above the mask edge, fading DOWN
      //         (outer alpha high, inner alpha 0) so cells exiting the window dim.
      // sign = -1: bottom edge → mirrored.
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const stripH = windowFeatherPx / steps;
        const yTop =
          sign === 1 ? windowFeatherPx / 2 - i * stripH : -windowFeatherPx / 2 + i * stripH;
        const alpha = Math.round(180 * (1 - t)); // outer→inner: 180→0
        g.fillColor = new Color(10, 6, 16, alpha);
        g.rect(-(this.gw + 4) / 2, yTop - (sign === 1 ? stripH : 0), this.gw + 4, stripH);
        g.fill();
      }
      // Park the node at (0, reelCenterY ± gh/2 ± windowFeatherPx/2). fit()
      // owns repositioning if gh changes; this is the initial placement.
      n.setPosition(0, reelCenterY + sign * (this.gh / 2 - windowFeatherPx / 2), 0);
      return n;
    };
    this.windowFeatherTop = make(1, 'windowFeatherTop');
    this.windowFeatherBottom = make(-1, 'windowFeatherBottom');
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

  /** Task 1.3 — collision-clamped FAB dock-x. Computes the FAB centre x so its
   *  inner edge stays >= frameHalfW + minClearancePx and outer edge stays
   *  <= screenHalfW/scale - edgePadPx. On a narrow viewport where neither
   *  constraint can be met, returns null and the caller hides the FAB. */
  private fabDockX(sign: 1 | -1, scale: number, screenW: number): number | null {
    const fab = VIEW_CONFIG.layout.fab;
    const frameHalfW = this.gw / 2 + 24; // halo on the frame
    const fabHalfW = fab.sizePx / 2;
    const ideal = sign * (frameHalfW + fab.gapPx + fabHalfW);
    const screenHalfWLocal = screenW / 2 / scale;
    const outerLimit = screenHalfWLocal - fab.edgePadPx - fabHalfW;
    const innerLimit = frameHalfW + fab.minClearancePx + fabHalfW;
    if (outerLimit < innerLimit) return null; // narrow viewport — hide
    const idealAbs = Math.abs(ideal);
    const clampedAbs = Math.max(innerLimit, Math.min(outerLimit, idealAbs));
    return sign * clampedAbs;
  }

  private fit(): void {
    const vis = view.getVisibleSize();
    const L = VIEW_CONFIG.layout;
    const { designWidth, designHeight, reelCenterY } = L;
    const availH = Math.max(160, vis.height - this.bottomInset);
    // Fit + centre the CONTENT BAND, not the full 760 design. With the shared
    // betting bar (externalControls) there is no bottom control deck, so the
    // live content is just logo-top -> reels-bottom; fitting that band makes the
    // reels fill the screen and removes the dead space the empty deck reserved.
    // Logo top + reels bottom from Task 1.1 tunables.
    const contentTop = L.contentTopPx;
    const contentBottom = this.externalControls
      ? reelCenterY - this.gh / 2 - L.boardBottomGapPx // reels bottom + clean gap to the bar
      : -designHeight / 2; // own-HUD build keeps the full design envelope
    const contentH = contentTop - contentBottom;
    const contentCenter = (contentTop + contentBottom) / 2;
    const isLandscape = vis.width > vis.height * 1.05;
    // Task 7.1 — portrait reels fill ≥90% of visible width. The 760 design
    // envelope is irrelevant in portrait (it wins on height-clamp already);
    // instead, scale to portraitWidthFill * vis.width / gw so the reels are
    // designed-portrait-wide regardless of canvas aspect.
    const sWidth = isLandscape
      ? (vis.width * L.landscapeWidthFill) / designWidth
      : (vis.width * L.portraitWidthFill) / this.gw;
    const s = Math.min(sWidth, availH / contentH);
    this.node.setScale(s, s, 1);
    // Land the content centre at the centre of the area above the bar.
    this.node.setPosition(0, this.bottomInset / 2 - contentCenter * s, 0);

    // Orientation-gated title + FAB placement (same threshold the rest of the app
    // uses). LANDSCAPE: the big top-centre logo crowded the reels and the FAB was
    // a lone heavy mass on the left making the (already-centred) reels read
    // off-centre. Shrink the logo to the upper-LEFT shoulder and move the FAB to
    // the RIGHT margin so the composition is balanced around the centred reels.
    // PORTRAIT: untouched (top-centre logo); the FAB is hidden because Task 7.2
    // moves Buy into the betting bar deck — the board FAB would overlap the FAB
    // slot in portrait.
    if (this.logoNode) {
      if (isLandscape) {
        // 2026-06-11 — SCREEN-RELATIVE logo (responsive). Convert a screen
        // fraction (0,0)=bottom-left .. (1,1)=top-right into board-local coords
        // by inverse-transforming through the board position + scale, so the
        // logo holds its top-left screen spot at ANY viewport. In bonus it
        // slides to the reels-left, vertically-centred.
        this.logoNode.setScale(L.logo.landscapeScale, L.logo.landscapeScale, 1);
        const fx = this.inBonus ? L.logo.bonusScreenX : L.logo.landscapeScreenX;
        const fy = this.inBonus ? L.logo.bonusScreenY : L.logo.landscapeScreenY;
        const canvasX = (fx - 0.5) * vis.width;
        const canvasY = (fy - 0.5) * vis.height;
        this.logoNode.setPosition(
          (canvasX - this.node.position.x) / s,
          (canvasY - this.node.position.y) / s,
          0,
        );
      } else {
        this.logoNode.setScale(1, 1, 1);
        this.logoNode.setPosition(0, L.logo.topY - 10, 0);
      }
    }
    if (this.titleCaption) {
      // The long MAX-WIN caption is orphaned at top-centre once the logo moves
      // left; hide it in landscape (the same info lives in the intro peek + info
      // panel) and keep it under the logo in portrait.
      this.titleCaption.active = !isLandscape;
    }
    if (this.buyFab) {
      // 2026-06-11 — the board FAB IS the BUY BONUS component in BOTH
      // orientations (matches the PixiJS reference; the redundant bar control
      // was removed — it caused the "two circles"). LANDSCAPE: docked on the
      // LEFT of the reels at reelCenterY (reference parity). PORTRAIT: in the
      // bottom-left deck, screen-relative + counter-scaled so the big portrait
      // board scale doesn't blow it up.
      const fab = L.fab;
      const base = this.buyFabBaseScale;
      if (isLandscape) {
        this.buyFab.setScale(base, base, 1); // build-time size on the reel shoulder
        const x = this.fabDockX(fab.landscapeDockSign as 1 | -1, s, vis.width);
        if (x === null) {
          this.buyFab.active = false; // viewport too narrow for both frame + FAB
        } else {
          this.buyFab.active = true;
          this.buyFab.setPosition(x, reelCenterY, 0);
        }
      } else {
        this.buyFab.active = true;
        // Counter-scale by the board scale so the badge stays a consistent
        // on-screen size in portrait (where the board scale is large).
        const cs = Math.max(0.3, (base * fab.portraitScale) / Math.max(0.001, s));
        this.buyFab.setScale(cs, cs, 1);
        const canvasX = (fab.portraitScreenX - 0.5) * vis.width;
        // CLAMP above the control band: portraitScreenY is a screen fraction, but
        // the bar band's height varies per viewport — on tall phones the fixed
        // fraction lands INSIDE the band and the FAB covers the balance strip
        // (user-reported overlap). Force the FAB's bottom edge to clear the
        // board's bottom inset (bar band + safe area) by 12 screen px.
        const fabScreenH = (this.buyFab.getComponent(UITransform)?.height ?? 96) * cs * s;
        const fromBottom = Math.max(
          fab.portraitScreenY * vis.height,
          this.bottomInset + fabScreenH / 2 + 12,
        );
        const canvasY = fromBottom - vis.height / 2;
        this.buyFab.setPosition(
          (canvasX - this.node.position.x) / s,
          (canvasY - this.node.position.y) / s,
          0,
        );
      }
    }
    // Task 1.2 — keep the feather nodes pinned to the reel window edges.
    if (this.windowFeatherTop) {
      this.windowFeatherTop.setPosition(0, reelCenterY + this.gh / 2 - L.windowFeatherPx / 2, 0);
    }
    if (this.windowFeatherBottom) {
      this.windowFeatherBottom.setPosition(0, reelCenterY - this.gh / 2 + L.windowFeatherPx / 2, 0);
    }
    // Task 4.3 — flanking crystals docked just outside the frame L/R at
    // reelCenterY. Portrait hides them (FAB used to own that margin; mobile
    // bar's deck Buy still does); landscape shows them as decor.
    // portraitVisible flag overrides.
    if (this.flankCrystalL && this.flankCrystalR) {
      const cfg = VIEW_CONFIG.decor.flankCrystal;
      const shouldShow = isLandscape || cfg.portraitVisible;
      this.flankCrystalL.active = shouldShow;
      this.flankCrystalR.active = shouldShow;
      if (shouldShow) {
        const fx = this.gw / 2 + cfg.marginPx + cfg.sizePx / 2;
        this.flankCrystalL.setPosition(-fx, reelCenterY, 0);
        this.flankCrystalR.setPosition(fx, reelCenterY, 0);
      }
    }
    // Task 4.2 — keep portal sprites pinned to the reel block top/bottom.
    if (this.reelPortalTop) this.reelPortalTop.setPosition(0, reelCenterY + this.gh / 2 + 6, 0);
    if (this.reelPortalBottom)
      this.reelPortalBottom.setPosition(0, reelCenterY - this.gh / 2 - 6, 0);
    if (this.gridMergeNode) this.gridMergeNode.setPosition(0, reelCenterY, 0);
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
    // Tasks 3.1 + 3.2 — scrim outside-click dismiss + crystal close-X.
    this.addPanelDismiss(panel, w, h, () => this.closeAutoplayPanel());
    this.autoplayPanel = panel;
  }

  openAutoplayPanel(): void {
    this.closeOverlays();
    this.popOpen(this.autoplayPanel);
    this.audio.modalOpen();
  }

  closeAutoplayPanel(): void {
    this.popClose(this.autoplayPanel);
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
    // Tasks 3.1 + 3.2 — scrim outside-click dismiss + crystal close-X.
    this.addPanelDismiss(panel, w, h, () => this.closeSettingsPanel());
    this.settingsPanel = panel;
  }

  openSettingsPanel(): void {
    this.closeOverlays();
    this.popOpen(this.settingsPanel);
    this.audio.modalOpen();
  }

  closeSettingsPanel(): void {
    this.popClose(this.settingsPanel);
  }

  // ---- GAME INFORMATION panel (master parity: Rules / Paytable / Info tabs) --
  /** Rebuild the info panel on the given tab. Content derives from logic data
   *  (paytable rows, computed max win) so the panel can never drift from the math. */
  private buildInfoPanel(tab: 'rules' | 'paytable' | 'info'): void {
    const wasOpen = this.infoPanel?.active ?? true;
    this.infoPanel?.destroy();
    this.infoTab = tab;
    // Task 3.3 — all sizes from VIEW_CONFIG.info; localization-safe wrapping.
    const info = VIEW_CONFIG.info;
    const w = info.panelW;
    const h = info.panelH;
    const panel = this.mkNode('infoPanel', w, h, this.node);
    panel.setPosition(0, VIEW_CONFIG.layout.reelCenterY - 40, 0);
    panel.active = wasOpen;
    this.surfChrome(panel, w, h, 46);
    this.mkLabel('GAME INFORMATION', 0, h / 2 - 26, info.titleSize, ACID, panel);
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
    // Task 3.3 — wrapping label factory. Uses RESIZE_HEIGHT + enableWrapText
    // + a measured contentWidth (panel inner minus margins). Returns the laid-
    // out height so the caller can stack the next line at `y - height - lineGap`.
    const contentWidth = w - info.leftMargin * 2;
    const wrapLine = (
      text: string,
      y: number,
      size: number = info.bodySize,
      col: Color = MUTED,
    ): number => {
      const n = this.mkNode('infoLine', contentWidth, size + 8, panel);
      n.setPosition(-w / 2 + info.leftMargin, y, 0);
      // Anchor top-left so the label's box grows downward when wrapping.
      const ut = n.getComponent(UITransform);
      if (ut) ut.setAnchorPoint(0, 1);
      const l = n.addComponent(Label);
      l.string = text;
      l.fontSize = size;
      l.lineHeight = Math.round(size * 1.32);
      l.color = col;
      l.horizontalAlign = Label.HorizontalAlign.LEFT;
      l.overflow = Label.Overflow.RESIZE_HEIGHT;
      l.enableWrapText = true;
      applyFont(l, 'body');
      // Force a layout pass so the measured height is available immediately.
      l.updateRenderData(true);
      return ut ? ut.height : size + 4;
    };
    if (tab === 'rules') {
      let y = top;
      for (const line of RULES_LINES) {
        const ht = wrapLine('· ' + line, y);
        y -= ht + info.lineGap;
      }
      y -= 14;
      const headerHt = wrapLine('CONTROLS', y, info.headerSize, ACID);
      y -= headerHt + info.lineGap;
      for (const line of CONTROLS_LINES) {
        const ht = wrapLine(line, y);
        y -= ht + info.lineGap;
      }
    } else if (tab === 'paytable') {
      // Paytable is a measured-column table, not a wrap field — keep the existing
      // tight rendering since the row labels are short (single symbol names).
      this.mkLabel('SYMBOL', -w / 2 + info.leftMargin, top, 11, ACID, panel).horizontalAlign =
        Label.HorizontalAlign.LEFT;
      [3, 4, 5].forEach((n, i) => {
        const head = this.mkLabel(`x${n}`, w / 2 - 170 + i * 62, top, 11, ACID, panel);
        head.horizontalAlign = Label.HorizontalAlign.RIGHT;
      });
      let y = top - 28;
      for (const row of paytableRows()) {
        this.mkLabel(row.name, -w / 2 + info.leftMargin, y, 12, MUTED, panel).horizontalAlign =
          Label.HorizontalAlign.LEFT;
        [row.pay3, row.pay4, row.pay5].forEach((pay, i) => {
          const v = this.mkLabel(String(pay), w / 2 - 170 + i * 62, y, 12, MUTED, panel);
          v.horizontalAlign = Label.HorizontalAlign.RIGHT;
        });
        y -= 30;
      }
      wrapLine('Pays are line-bet multiples.', y - 6, info.captionSize);
    } else {
      let y = top;
      const stat = (label: string, value: string) => {
        this.mkLabel(label, -w / 2 + info.leftMargin, y, 12, MUTED, panel).horizontalAlign =
          Label.HorizontalAlign.LEFT;
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
      y -= wrapLine('RTP is calculated over many plays.', y, info.captionSize) + info.lineGap;
      wrapLine('Individual sessions may vary.', y, info.captionSize);
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
    // Tasks 3.1 + 3.2 — scrim outside-click dismiss + crystal close-X.
    this.addPanelDismiss(panel, w, h, () => this.closeInfoPanel());
    this.infoPanel = panel;
  }

  openInfoPanel(): void {
    this.closeOverlays();
    if (!this.infoPanel) this.buildInfoPanel(this.infoTab);
    this.popOpen(this.infoPanel);
    this.audio.modalOpen();
  }

  closeInfoPanel(): void {
    this.popClose(this.infoPanel);
  }

  // ---- MENU hub (master pending item: menu shows more than one destination) --
  /** Small hub the bar's menu glyph opens: BUY FEATURE / SETTINGS / AUTOPLAY. */
  openMenuHub(): void {
    if (!this.menuHub) this.menuHub = this.buildMenuHub();
    this.closeOverlays();
    this.popOpen(this.menuHub);
  }

  /** Task 3.4 — per-entry presentation (accent gem + one-line caption). Mirrors
   *  the BUY_PRESENT pattern so the menu and buy panel read as one design system. */
  private static MENU_PRESENT: Record<string, { accent: string; caption: string }> = {
    'BUY FEATURE': { accent: '#ff5ab0', caption: 'Skip the wait — buy any feature' },
    'QUICK BET': { accent: '#ffcf5a', caption: 'Preset stake grid' },
    'GAME INFO': { accent: '#7fe7ff', caption: 'Rules, paytable, RTP' },
    SETTINGS: { accent: '#c566ff', caption: 'Sound, turbo, reduced FX' },
    AUTOPLAY: { accent: '#b86fda', caption: 'Run a planned series of spins' },
  };

  private buildMenuHub(): Node {
    // Task 3.4 — row-cards premium redesign. Each entry: candy tile + left gem
    // (accent colour per MENU_PRESENT) + display-font label + caption + right
    // chevron + press squash. Sized by VIEW_CONFIG.menu.
    const cfg = VIEW_CONFIG.menu;
    const entries: [string, () => void][] = [
      ['BUY FEATURE', () => this.openBuyMenu()],
      ['QUICK BET', () => this.openQuickBetPanel()],
      ['GAME INFO', () => this.openInfoPanel()],
      ['SETTINGS', () => this.openSettingsPanel()],
      ['AUTOPLAY', () => this.openAutoplayPanel()],
    ];
    const w = cfg.panelW;
    const titleBand = 64;
    const h = titleBand + entries.length * (cfg.rowH + cfg.rowGap) + 24;
    const hub = this.mkNode('menuHub', w, h, this.node);
    hub.setPosition(0, VIEW_CONFIG.layout.reelCenterY, 0);
    hub.active = false;
    this.surfChrome(hub, w, h, titleBand);
    this.mkLabel('MENU', 0, h / 2 - 26, cfg.titleSize, ACID, hub);

    const rowW = w - 36;
    let y = h / 2 - titleBand - cfg.rowH / 2 - 4;
    entries.forEach(([label, open], i) => {
      void i;
      const present = SlotView.MENU_PRESENT[label] ?? { accent: '#ff7ad0', caption: '' };
      const row = this.mkNode(`menuRow_${label}`, rowW, cfg.rowH, hub);
      row.setPosition(0, y, 0);

      // Candy tile background — soft violet with cyan hairline rim.
      const tile = row.addComponent(Graphics);
      tile.fillColor = new Color().fromHEX(PAL.tileBg);
      tile.roundRect(-rowW / 2, -cfg.rowH / 2, rowW, cfg.rowH, 14);
      tile.fill();
      tile.lineWidth = 1.2;
      tile.strokeColor = new Color(127, 231, 255, 110);
      tile.roundRect(-rowW / 2, -cfg.rowH / 2, rowW, cfg.rowH, 14);
      tile.stroke();

      // Left accent gem (diamond) at the inner edge — tier colour.
      const gemNode = this.mkNode('gem', cfg.gemSize * 2, cfg.gemSize * 2, row);
      gemNode.setPosition(-rowW / 2 + 22, 0, 0);
      const gg = gemNode.addComponent(Graphics);
      const accent = new Color().fromHEX(present.accent);
      accent.a = Math.round(cfg.accentAlpha * 255);
      gg.fillColor = accent;
      gg.moveTo(0, cfg.gemSize);
      gg.lineTo(cfg.gemSize, 0);
      gg.lineTo(0, -cfg.gemSize);
      gg.lineTo(-cfg.gemSize, 0);
      gg.close();
      gg.fill();
      gg.fillColor = new Color(255, 255, 255, 180);
      gg.moveTo(0, cfg.gemSize * 0.5);
      gg.lineTo(cfg.gemSize * 0.32, 0);
      gg.lineTo(0, -cfg.gemSize * 0.5);
      gg.lineTo(-cfg.gemSize * 0.32, 0);
      gg.close();
      gg.fill();

      // Display-font label + body caption — stacked vertically next to gem.
      const labelNode = this.mkNode('label', rowW * 0.7, cfg.labelSize + 4, row);
      labelNode.setPosition(-rowW / 2 + 56, 8, 0);
      const lbl = labelNode.addComponent(Label);
      lbl.string = label;
      lbl.fontSize = cfg.labelSize;
      lbl.lineHeight = cfg.labelSize + 2;
      lbl.color = new Color().fromHEX(PAL.valueText);
      lbl.horizontalAlign = Label.HorizontalAlign.LEFT;
      const labelUt = labelNode.getComponent(UITransform);
      if (labelUt) labelUt.setAnchorPoint(0, 0.5);
      applyFont(lbl, 'display');

      const captionNode = this.mkNode('caption', rowW * 0.7, cfg.captionSize + 4, row);
      captionNode.setPosition(-rowW / 2 + 56, -10, 0);
      const cap = captionNode.addComponent(Label);
      cap.string = present.caption;
      cap.fontSize = cfg.captionSize;
      cap.lineHeight = cfg.captionSize + 2;
      cap.color = MUTED;
      cap.horizontalAlign = Label.HorizontalAlign.LEFT;
      const capUt = captionNode.getComponent(UITransform);
      if (capUt) capUt.setAnchorPoint(0, 0.5);
      applyFont(cap, 'body');

      // Right chevron — fake "drill-in" affordance.
      const chevNode = this.mkNode('chev', 14, 14, row);
      chevNode.setPosition(rowW / 2 - 22, 0, 0);
      const cg = chevNode.addComponent(Graphics);
      cg.lineWidth = 2.4;
      cg.strokeColor = new Color(255, 200, 240, 200);
      cg.moveTo(-3, 6);
      cg.lineTo(4, 0);
      cg.lineTo(-3, -6);
      cg.stroke();

      // Press-squash + tap → close menu, open destination.
      row.on(Node.EventType.TOUCH_START, () => {
        Tween.stopAllByTarget(row);
        tween(row)
          .to(0.08, { scale: new Vec3(0.97, 0.97, 1) }, { easing: 'quadOut' })
          .start();
      });
      const release = (tap: boolean): void => {
        Tween.stopAllByTarget(row);
        tween(row)
          .to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
          .start();
        if (tap) {
          this.audio.click();
          hub.active = false;
          open();
        }
      };
      row.on(Node.EventType.TOUCH_END, () => release(true));
      row.on(Node.EventType.TOUCH_CANCEL, () => release(false));

      y -= cfg.rowH + cfg.rowGap;
    });

    // Tasks 3.1 + 3.2 — scrim outside-click dismiss + crystal close-X.
    this.addPanelDismiss(hub, w, h, () => (hub.active = false));
    return hub;
  }

  /** Hide every floating panel (one overlay at a time, master parity). */
  /** Reusable panel OPEN transition — pop-scale + fade in (backOut). Cancels any
   *  in-flight close tween (Tween.stopAllByTarget also kills the pending
   *  deactivate .call), so open-after-close never leaves a panel hidden. */
  private popOpen(node: Node | null): void {
    if (!node) return;
    const op = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
    Tween.stopAllByTarget(node);
    Tween.stopAllByTarget(op);
    node.active = true;
    node.setScale(0.86, 0.86, 1);
    op.opacity = 0;
    tween(node)
      .to(0.2, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
      .start();
    tween(op).to(0.16, { opacity: 255 }).start();
  }

  /** Reusable panel CLOSE transition — fade + settle out, then deactivate and
   *  reset so the next open starts clean. No-op if already inactive. */
  private popClose(node: Node | null): void {
    if (!node || !node.active) return;
    const op = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
    Tween.stopAllByTarget(node);
    Tween.stopAllByTarget(op);
    tween(node)
      .to(0.12, { scale: new Vec3(0.92, 0.92, 1) }, { easing: 'quadIn' })
      .start();
    tween(op)
      .to(0.12, { opacity: 0 })
      .call(() => {
        node.active = false;
        node.setScale(1, 1, 1);
        op.opacity = 255;
      })
      .start();
  }

  closeOverlays(): void {
    this.closeBuyMenu();
    this.popClose(this.autoplayPanel);
    this.popClose(this.settingsPanel);
    this.popClose(this.menuHub);
    this.popClose(this.infoPanel);
    this.popClose(this.quickBetPanel);
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
    // Tasks 3.1 + 3.2 — scrim outside-click dismiss + crystal close-X.
    this.addPanelDismiss(panel, w, h, () => this.closeQuickBetPanel());
    this.quickBetPanel = panel;
  }

  openQuickBetPanel(): void {
    this.closeOverlays();
    this.popOpen(this.quickBetPanel);
    this.audio.modalOpen();
  }

  closeQuickBetPanel(): void {
    this.popClose(this.quickBetPanel);
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
      // 2026-06-11 polish — REMOVED the white-pink confirm flash entirely. It
      // peaked at alpha 55 (22% white over the whole screen) which the user
      // reads as a "white flash on tap". The intro panel's own fade is the
      // confirmation; a separate flash bloom is gratuitous and conflicts with
      // the AAA "no white moments ever" rule. Leaving the node-creation lines
      // commented out as a marker against accidental re-introduction.
      //   const flash = this.mkNode('introFlash', 4000, 3200, ov);
      //   ... fg.fillColor = new Color(255, 240, 250, 255); fg.rect(...); fg.fill();
      //   ... tween(fop).to(0.08, { opacity: 55 }).to(0.24, { opacity: 0 }).start();
      // Single clean fade — the gate starts dimming IMMEDIATELY (no 0.18 delay),
      // so there's no "dim lingers under a white flash then flickers out" stage.
      const op = ov.getComponent(UIOpacity) ?? ov.addComponent(UIOpacity);
      tween(op)
        .to(0.32, { opacity: 0 }, { easing: 'quadOut' })
        .call(() => ov.destroy())
        .start();

      // Task 4.4 — micro cross-dissolve. The original 320ms hold + fade left a
      // perceived "screen went black" stage; instead start at startAlpha (< 255
      // so the painted bg is visible underneath FROM THE FIRST FRAME) and fade
      // to 0 over a short ms (≤120 typical). The intro overlay's own quadOut
      // does the heavy lifting; this is only the few-frame insurance against
      // the engine's first-paint gap.
      const intro = VIEW_CONFIG.intro.fade;
      if (intro.ms > 0) {
        const fadeParent = this.node.parent ?? this.node;
        const fade = this.mkNode('introFade', 4000, 3200, fadeParent);
        fade.setSiblingIndex(fadeParent.children.length - 1); // top of root tree
        const dg = fade.addComponent(Graphics);
        const c = new Color().fromHEX(intro.color);
        dg.fillColor = c;
        dg.rect(-2000, -1600, 4000, 3200);
        dg.fill();
        const dop = fade.addComponent(UIOpacity);
        dop.opacity = intro.startAlpha;
        const t = tween(dop);
        if (intro.holdMs > 0) t.delay(intro.holdMs / 1000);
        t.to(intro.ms / 1000, { opacity: 0 }, { easing: 'sineOut' })
          .call(() => fade.destroy())
          .start();
      }

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
    // Task 4.2 — portal entry pulse at launch (single fire — both top/bottom).
    this.playReelPortalEntry();
    await Promise.all(
      this.reels.map((reel, i) => {
        let dur = (minSpinMs + i * reelStopStaggerMs) / 1000;
        if (antic && i >= 3) {
          dur += extraSeconds;
          // 2026-06-11 — aura geometry gated. The drag-time alone carries the
          // tension; the magenta column + lightning diamonds are gone.
          if (VIEW_CONFIG.anticipation.showAura) {
            this.anticipation.spawn(
              this.cellCenter(i, 0).x,
              VIEW_CONFIG.layout.reelCenterY,
              VIEW_CONFIG.layout.cell + 12,
              this.gh + 14,
              this.reducedFx,
            );
          }
        }
        return reel.spinTo(grid[i], dur, speedMul).then(() => {
          this.audio.reelStop(i, turbo);
          // Task 4.2 — portal exit pulse on the LAST reel's settle.
          if (i === this.reels.length - 1) this.playReelPortalExit();
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
    // CINEMA WAVE — shader rim-light/sweep on winners. reducedFx → null so the
    // symbol falls back to the Graphics sheen; otherwise advance the shared
    // material's u_time globally (one stepper, all overlays animate in sync).
    const winMat = this.reducedFx ? null : this.getEffectMaterial('symbol-win');
    this.reels.forEach((reel, i) => reel.highlight(byReel[i] ?? [], i * 0.06, rich, winMat));
    // One global u_time stepper drives symbol-win + soft-burst + win-beam in sync.
    // The burst shows on EVERY win (it replaced the always-on glow), so schedule
    // whenever any shader-backed win layer can be visible.
    const anyWinFx =
      winMat ?? this.getEffectMaterial('soft-burst') ?? this.getEffectMaterial('win-beam');
    if (anyWinFx && !this.reducedFx && totalCells > 0) {
      this.symWinT = 0;
      this.unschedule(this.tickSymbolWin);
      this.schedule(this.tickSymbolWin, 0);
    }

    this.winLines = result.lineWins.map((w) => ({ lineIndex: w.lineIndex, count: w.count }));
    if (this.winLines.length === 0) return;

    // 2026-06-11 FIRE redesign — no drawn payline geometry. The win reads from
    // the warm symbol glow + rising fire embers off every winning cell. Skip
    // the entire line-reveal pipeline (polyline + glow segments + plasma core).
    if (!VIEW_CONFIG.win.showLines) {
      const centers: Vec3[] = [];
      byReel.forEach((rows, reel) => {
        (rows ?? []).forEach((row) => centers.push(this.cellCenter(reel, row)));
      });
      if (centers.length && !this.reducedFx) {
        this.particles.fireEmbers(centers);
        // Per-symbol fire now lives IN symbol-win.effect (clipped to each symbol
        // silhouette). The old rectangular flame quads are gated OFF — they read
        // as a "fire background box" which the user rejected.
        if (VIEW_CONFIG.win.fireFlames.enabled) this.showWinFlames(centers);
        // CINEMA WAVE — the shader win-line: flowing energy ribbons along each
        // winning line's cell centres (win-beam.effect, ember/gold plasma).
        if (VIEW_CONFIG.win.beams.enabled) this.showWinBeams(this.winLines);
      }
      return;
    }

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
    this.unschedule(this.tickSymbolWin);
    if (this.winSpark) this.winSpark.active = false;
    // Wave C — drop the additive overlays back to inactive on clear.
    if (this.plasmaCore) this.plasmaCore.active = false;
    if (this.winLineGlow) this.winLineGlowSegs.forEach((s) => (s.active = false));
    this.lastSparkPtIdx = -1;
    this.hideWinFlames(); // VISUAL BUST — drop the flame sprites on clear
    this.hideWinBeams(); // CINEMA WAVE — drop the energy ribbons on clear
    this.stopWinLinePulse();
    this.winLines = [];
    this.winLineG?.clear();
    this.reels.forEach((reel) => reel.clearHighlight());
  }

  /** CINEMA WAVE — advance u_time on ALL win-presentation materials while a win
   *  is shown: symbol-win (fire/rim/sweep on the symbol), soft-burst (rotating
   *  god-ray glow behind it), win-beam (flowing line ribbons). ONE stepper keeps
   *  them phase-locked; per-node fades are UIOpacity envelopes. Stopped in
   *  clearWins. */
  private symWinT = 0;
  private tickSymbolWin = (dt: number): void => {
    this.symWinT += dt;
    for (const key of ['symbol-win', 'soft-burst', 'win-beam']) {
      const m = this.effectMaterials[key];
      if (m) m.setProperty('u_time', this.symWinT);
    }
  };

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
      if (this.plasmaCore) this.plasmaCore.active = false;
      if (this.winLineGlow) this.winLineGlowSegs.forEach((s) => (s.active = false));
      this.winCycle = 0;
      this.cycleWinLine();
      this.schedule(this.cycleWinLine, VIEW_CONFIG.win.lineCycleSeconds);
      return;
    }
    this.revealP += dt / this.revealDur;
    if (this.revealP >= 1) {
      this.revealP = 0;
      this.revealIdx++;
      this.lastSparkPtIdx = -1; // fresh line — re-arm sparkCascade triggers
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
    // Task 4.1 — hide all glow segments first; the current line repopulates them.
    if (this.winLineGlow) this.winLineGlowSegs.forEach((s) => (s.active = false));
    const cur = this.winLines[this.revealIdx];
    if (cur) {
      const pts = this.linePts(cur);
      const drawn: Vec3[] = [];
      const head = this.polyAt(pts, this.revealP, drawn);
      this.strokeLine(drawn, true, LINE_HUES[cur.lineIndex % LINE_HUES.length]);
      // Task 4.1 — additive glow segments tracing the same `drawn` polyline.
      // Each segment is a stretched/rotated Sprite tinted by the line hue; the
      // payline-glow.effect material (if loaded) modulates it additively.
      if (this.winLineGlow && drawn.length >= 2) {
        const hue = LINE_HUES[cur.lineIndex % LINE_HUES.length];
        const tint = new Color(hue.r, hue.g, hue.b, 255);
        const wpx = VIEW_CONFIG.win.glow.widthPx;
        for (let i = 1; i < drawn.length && i - 1 < this.winLineGlowSegs.length; i++) {
          const a = drawn[i - 1];
          const b = drawn[i];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy);
          if (len < 1) continue;
          const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
          const seg = this.winLineGlowSegs[i - 1];
          seg.active = true;
          seg.setPosition((a.x + b.x) / 2, (a.y + b.y) / 2, 0);
          seg.angle = ang;
          const ut = seg.getComponent(UITransform);
          if (ut) ut.setContentSize(len, wpx);
          const sp = seg.getComponent(Sprite);
          if (sp) sp.color = tint;
        }
      }
      // Task 6.3 — plasma core rides the head (replaces the single winSpark
      // diamond). Stacked-alpha discs pulse-scale via tickUTime; the optional
      // svarka-additive sprite is the additive intensifier on top.
      if (this.plasmaCore) {
        this.plasmaCore.active = true;
        this.plasmaCore.setPosition(head.x, head.y, 0);
        if (this.winSpark) this.winSpark.active = false; // deprecated by plasma
      } else if (this.winSpark) {
        // Pure fallback path (shouldn't normally hit; build always makes plasma)
        this.winSpark.active = true;
        this.winSpark.setPosition(head.x, head.y, 0);
      }
      // Task 6.3 — head-crosses-cell: fire sparkCascade + shake the winning
      // symbol. drawn.length-1 is the latest fully-drawn pt; when it increases,
      // the head just crossed into a new cell column.
      const newIdx = drawn.length - 1;
      if (newIdx > this.lastSparkPtIdx) {
        const pt = drawn[newIdx];
        if (pt && this.particles && !this.reducedFx) {
          this.particles.sparkCascade(pt.x, pt.y);
        }
        // Reel index === polyline pt index (one pt per reel for a paying line).
        if (!this.reducedFx && newIdx < cur.count) {
          const row = PAYLINES[cur.lineIndex]?.[newIdx];
          if (row !== undefined && this.reels[newIdx]) {
            const sv = VIEW_CONFIG.win.svarka;
            this.reels[newIdx].shakeRow(row, sv.shakeAmp, sv.shakeMs);
          }
        }
        this.lastSparkPtIdx = newIdx;
      }
    } else {
      // No current line to draw — reset spark tracking.
      this.lastSparkPtIdx = -1;
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
    // Task 5.MATRIX — EPIC-tier coin geyser fires through the CC-2 particle pool.
    this.ceremony.onCoinGeyser = () => {
      if (!this.reducedFx) this.particles.coinGeyser();
    };
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

  /** Stroke a (possibly partial) polyline. Polish 2026-06-11: dramatically cut
   *  the visible stroke alpha so the line reads as an ATMOSPHERIC guide rather
   *  than a graphic "drawn line through the symbols". The visual reading of the
   *  win line is now carried by the cell pulse (playWin), the additive
   *  payline-glow shader segments (Task 4.1), the Svarka plasma core riding
   *  the head (Task 6.3), and the spark cascades on head-crosses-cell. The
   *  Graphics stroke survives as a faint trace only — never as the dominant
   *  visual. (slot-vfx-artist canon: never lead with a raw colored line.) */
  private strokeLine(pts: Vec3[], bright: boolean, color: Color): void {
    const g = this.winLineG;
    if (!g || pts.length < 2) return;
    const path = () => {
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    };
    // Soft black underlay — kept thin + low-alpha for a subtle depth seat.
    g.lineWidth = bright ? 5 : 3;
    g.strokeColor = new Color(0, 0, 0, bright ? 90 : 50);
    path();
    g.stroke();
    // Coloured core — cut from full-alpha graphic to a soft atmospheric tint.
    // The shader bloom (payline-glow material) + plasma core + cell pulse
    // carry the actual visual weight; this is just a subtle path memory.
    g.lineWidth = bright ? 2 : 1.5;
    g.strokeColor = bright
      ? new Color(color.r, color.g, color.b, 75)
      : new Color(color.r, color.g, color.b, 40);
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
