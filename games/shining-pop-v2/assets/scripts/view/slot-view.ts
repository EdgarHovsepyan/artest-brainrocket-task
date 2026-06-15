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
  sp,
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
import { BONUS_MODES, BonusMode, GRID, PAYLINES, SCATTER, SYMBOLS } from '../logic/game-config';
import { formatMoney } from '../logic/money';
import {
  CONTROLS_LINES,
  FEATURES_LINES,
  maxWinMultiple,
  paytableRows,
  RTP_DISPLAY,
  RULES_LINES,
  SCATTER_LINES,
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
import { ParticlePool } from './particle-pool';
import { formatVfxHud } from './perf';
import { AudioManager } from './audio-manager';
import { applyFont, loadFonts } from './fonts';
import { PAL } from './palette';
import { BuyBonusModal, BuyTier } from './buy-bonus-modal';

const { ccclass } = _decorator;

const ACID = new Color(255, 0, 127, 255);
const INK = new Color(20, 10, 32, 255);
const PLATE = new Color(25, 17, 64, 255);
const PLATE_EDGE = new Color(184, 111, 218, 255);
const SHADOW = new Color(5, 2, 12, 170);
const MUTED = new Color(201, 206, 216, 255);

const LINE_HUES = [
  '#ff4fa3',
  '#ffd23f',
  '#3fe0ff',
  '#7cff5c',
  '#ff7a3f',
  '#b98cff',
  '#ff6b6b',
  '#5cffd0',
  '#ffa6e6',
  '#c6ff4f',
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

const fmt = (cents: number) => formatMoney((Number.isFinite(cents) ? cents : 0) / 100, 'USD');

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

  private effectMaterials: Record<string, Material | null> = {};

  private reels: ReelView[] = [];
  private spinButton: Button | null = null;
  private spinSprite: Sprite | null = null;
  private balanceLabel: Label | null = null;
  private betLabel: Label | null = null;
  private winLabel: Label | null = null;
  private bannerLabel: Label | null = null;
  private winLineG: Graphics | null = null;

  private winLift!: Node;
  private winSpark: Node | null = null;

  private winLineGlow: Node | null = null;
  private winLineGlowSegs: Node[] = [];

  private plasmaCore: Node | null = null;
  private plasmaDiscs: Node[] = [];
  private plasmaTime = 0;
  private lastSparkPtIdx = -1;

  private flankCrystalL: Node | null = null;
  private flankCrystalR: Node | null = null;

  private reelPortalTop: Node | null = null;
  private reelPortalBottom: Node | null = null;
  private gridMergeNode: Node | null = null;

  private buyPlasma: Node | null = null;

  private windowFeatherTop: Node | null = null;
  private windowFeatherBottom: Node | null = null;

  private winFlames: Node[] = [];
  private winBeams: Node[] = [];
  private winCoreG: Graphics | null = null;
  private whiteFrame: SpriteFrame | null = null;

  private uTime = 0;

  private lastBonusMode: 'idle' | 'wilds' | 'crowns' | 'reels' = 'idle';

  private inBonus = false;

  private fsBg: sp.Skeleton | null = null;
  private fsBgOp: UIOpacity | null = null;
  private fsBgLoading = false;

  private preloadedSpines: Record<string, sp.SkeletonData> = {};

  private cineBloomOp: UIOpacity | null = null;
  private cineWipe: Node | null = null;
  private cineWipeOp: UIOpacity | null = null;
  private cineWipeBand: Node | null = null;
  private cineWipeG: Graphics | null = null;

  private parallaxLayers: { node: Node; depth: number; baseX: number; baseY: number }[] = [];
  private pxLean = 0;
  private pxLeanTarget = 0;
  private pxPulse = 0;

  private buyFabBaseScale = 1;

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
  // Explicit open-state: the modal's close() only flips node.active after a fade,
  // so anyOverlayOpen() can't read node.active synchronously. This tracks intent.
  private buyMenuOpen = false;
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

  onOverlay: ((open: boolean) => void) | null = null;
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

  private bgArt: Node | null = null;
  private gw = 0;
  private gh = 0;
  private pitch = 0;

  private logoNode: Node | null = null;
  private titleCaption: Node | null = null;

  private winLines: { lineIndex: number; count: number }[] = [];

  private lineWinPops: Node[] = [];
  private winCycle = 0;

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
    jobs.push(
      new Promise<void>((res) =>
        resources.load(`sym/sym_wild_win/spriteFrame`, SpriteFrame, (err, sf) => {
          if (!err && sf) SymbolView.wildWinFrame = sf;
          res();
        }),
      ),
    );
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
      'particle-glow',
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

    ['spine/cupid-fs-bg/cupid_freespins_background', 'spine/cupid-wf/cupid-wf'].forEach((path) => {
      jobs.push(
        new Promise<void>((res) =>
          resources.load(path, sp.SkeletonData, (err, data) => {
            if (!err && data) this.preloadedSpines[path] = data;
            else console.warn('[spine] preload failed (fallback will run):', path, err);
            res();
          }),
        ),
      );
    });
    return Promise.all(jobs).then(() => undefined);
  }

  getEffectMaterial(key: string): Material | null {
    if (!VIEW_CONFIG.vfx.materialsEnabled) return null;
    return this.effectMaterials[key] ?? null;
  }

  private mkNode(name: string, w: number, h: number, parent: Node): Node {
    const n = new Node(name);

    n.layer = parent.layer;
    n.addComponent(UITransform).setContentSize(w, h);
    parent.addChild(n);
    return n;
  }

  refit(): void {
    this.fit();
  }

  // object-fit: cover for the background photo. The board content is scaled by
  // `s` to fit the reels; the bg must NOT inherit that — it scales independently
  // to always FILL the screen (preserve aspect, crop overflow), centred on the
  // screen, so no dark gaps show on any device aspect.
  private fitBackgroundCover(s: number, vis: { width: number; height: number }): void {
    if (!this.bgArt || s <= 0) return;
    const ut = this.bgArt.getComponent(UITransform);
    if (!ut) return;
    const ratio = 2752 / 1536;
    const overscan = VIEW_CONFIG.layout.bgCoverOverscan;
    // Screen size expressed in this.node's local units (the node is scaled by s).
    const localW = vis.width / s;
    const localH = vis.height / s;
    const w = Math.max(localW, localH * ratio) * overscan;
    ut.setContentSize(w, w / ratio);
    // Re-centre on the screen (canvas centre 0,0; this.node sits at 0,posY).
    this.bgArt.setPosition(0, -this.node.position.y / s, 0);
  }

  getBrandFrame(key: string): SpriteFrame | null {
    return this.brandFrames[key] ?? null;
  }

  setBonusAtmosphere(mode: 'idle' | 'wilds' | 'crowns' | 'reels'): void {
    if (mode !== 'idle' && this.lastBonusMode === 'idle') this.playGridMergeWipe();
    this.lastBonusMode = mode;

    const wasBonus = this.inBonus;
    this.inBonus = mode !== 'idle';
    if (this.inBonus !== wasBonus) {
      this.fit();

      this.updateFreeSpinScene(this.inBonus);
    }
    const tints: Record<typeof mode, [number, number, number, number]> = {
      idle: [0, 0, 0, 0],
      wilds: [255, 90, 156, 26],
      crowns: [255, 200, 70, 44],
      reels: [186, 60, 218, 44],
    };
    const [r, g, b, a] = tints[mode];
    if (!this.bonusWash) {
      this.bonusWash = this.mkNode('bonus_wash', 2600, 2200, this.node);
      this.bonusWash.addComponent(Graphics);
      this.bonusWashOp = this.bonusWash.addComponent(UIOpacity);
      this.bonusWashOp.opacity = 0;
      this.bonusWash.setSiblingIndex(2);
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

  private updateFreeSpinScene(entering: boolean): void {
    if (entering) {
      this.ensureFsBg(() => {
        const sk = this.fsBg;
        if (!sk || !sk.node.isValid) return;

        if (this.fsBgOp) {
          Tween.stopAllByTarget(this.fsBgOp);
          this.fsBgOp.opacity = 0;
        }
        sk.setAnimation(0, 'freespins-intro', false);
        sk.addAnimation(0, 'freespins-idle', true, 0);
        sk.updateAnimation(0);

        const frame = this.node.getChildByName('frame');
        if (frame) sk.node.setSiblingIndex(Math.max(0, frame.getSiblingIndex() - 1));
        this.fadeBaseBgForBonus(true);
        sk.node.active = true;
        if (this.fsBgOp) {
          tween(this.fsBgOp).to(0.5, { opacity: 255 }, { easing: 'sineOut' }).start();
        }
      });
    } else if (this.fsBg && this.fsBg.node.active && this.fsBgOp) {
      this.fadeBaseBgForBonus(false);
      this.fsBg.setAnimation(0, 'freespins-outro', false);
      Tween.stopAllByTarget(this.fsBgOp);
      tween(this.fsBgOp)
        .to(0.5, { opacity: 0 }, { easing: 'sineIn' })
        .call(() => {
          if (this.fsBg) this.fsBg.node.active = false;
        })
        .start();
    } else if (!entering) {
      this.fadeBaseBgForBonus(false);
    }
  }

  private baseBgLayers: UIOpacity[] | null = null;
  private fadeBaseBgForBonus(dim: boolean): void {
    if (!this.baseBgLayers) {
      this.baseBgLayers = ['bg_bokeh', 'bg_glow', 'bg_vignette']
        .map((nm) => this.node.getChildByName(nm))
        .filter((n): n is Node => !!n)
        .map((n) => n.getComponent(UIOpacity) ?? n.addComponent(UIOpacity));
    }
    for (const op of this.baseBgLayers) {
      Tween.stopAllByTarget(op);
      tween(op)
        .to(0.45, { opacity: dim ? 40 : 255 }, { easing: 'sineInOut' })
        .start();
    }
  }

  private ensureFsBg(cb: () => void): void {
    if (this.fsBg) {
      cb();
      return;
    }
    if (this.fsBgLoading) return;
    this.fsBgLoading = true;
    resources.load('spine/cupid-fs-bg/cupid_freespins_background', sp.SkeletonData, (err, data) => {
      this.fsBgLoading = false;
      if (err || !data || !this.node.isValid) {
        console.warn('[spine] free-spins bg load failed; wash fallback', err);
        return;
      }
      const n = this.mkNode('fsBg', 10, 10, this.node);
      n.setPosition(0, VIEW_CONFIG.layout.reelCenterY, 0);
      n.setScale(1, 1, 1);
      const sk = n.addComponent(sp.Skeleton);
      sk.skeletonData = data;
      sk.premultipliedAlpha = true;
      this.fsBgOp = n.addComponent(UIOpacity);
      this.fsBgOp.opacity = 0;
      n.active = false;

      if (this.bonusWash) n.setSiblingIndex(this.bonusWash.getSiblingIndex() + 1);
      this.fsBg = sk;
      cb();
    });
  }

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
      this.glassCounterChrome(hud, 540, 76);
      this.mkLabel('FREE SPINS', -120, 14, 13, MUTED, hud);
      this.bonusHudSpins = this.mkLabel('1 / 8', -120, -14, 22, ACID, hud, true);
      this.mkLabel('TOTAL WIN', 130, 14, 13, MUTED, hud);
      this.bonusHudWin = this.mkLabel('0.00', 130, -14, 22, ACID, hud, true);
      const op = hud.addComponent(UIOpacity);
      op.opacity = 0;
      tween(op).to(0.3, { opacity: 255 }, { easing: 'sineOut' }).start();
      this.bonusHud = hud;
    }

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

  showError(title: string, body: string, buttonLabel: string, onAction: () => void): void {
    this.closeOverlays();
    const root = this.node.parent ?? this.node;
    root.getChildByName('errorModal')?.destroy();
    const w = 460;
    const h = 220;

    const layer = this.mkNode('errorModal', 2600, 2200, root);
    layer.setSiblingIndex(root.children.length - 1);
    const scrim = layer.addComponent(Graphics);
    scrim.fillColor = new Color(0, 0, 0, 200);
    scrim.rect(-1300, -1100, 2600, 2200);
    scrim.fill();

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

    const layer = this.mkNode('rcModal', 2600, 2200, root);
    layer.setSiblingIndex(root.children.length - 1);
    const scrim = layer.addComponent(Graphics);
    scrim.fillColor = new Color(10, 10, 14, 200);
    scrim.rect(-1300, -1100, 2600, 2200);
    scrim.fill();
    layer.on(Node.EventType.TOUCH_END, () => undefined);
    const card = this.mkNode('rcCard', w, h, layer);
    card.setPosition(0, this.bottomInset / 2, 0);
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

  private glassCounterChrome(parent: Node, w: number, h: number): Graphics {
    const g = parent.addComponent(Graphics);

    g.fillColor = new Color(22, 13, 46, 120);
    g.roundRect(-w / 2, -h / 2, w, h, 16);
    g.fill();

    g.fillColor = new Color(255, 255, 255, 16);
    g.roundRect(-w / 2 + 3, h / 2 - h * 0.42, w - 6, h * 0.36, 13);
    g.fill();

    g.lineWidth = 6;
    g.strokeColor = new Color(255, 0, 127, 42);
    g.roundRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2, 17);
    g.stroke();
    g.lineWidth = 2;
    g.strokeColor = new Color(255, 90, 156, 210);
    g.roundRect(-w / 2, -h / 2, w, h, 16);
    g.stroke();
    g.lineWidth = 1;
    g.strokeColor = new Color(191, 232, 255, 40);
    g.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 13);
    g.stroke();
    return g;
  }

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

  private build(): void {
    const { cell, gap } = VIEW_CONFIG.layout;
    this.gw = GRID.reels * cell + (GRID.reels - 1) * gap;
    this.gh = GRID.rows * cell + (GRID.rows - 1) * gap;
    this.pitch = cell + gap;

    this.buildBackground();
    this.buildTitle();
    this.buildFrame();

    this.buildReels();

    this.winLift = this.mkNode('winLift', 10, 10, this.node);

    const tap = this.mkNode('paylineTap', this.gw, this.gh, this.node);
    tap.setPosition(0, VIEW_CONFIG.layout.reelCenterY, 0);
    tap.on(Node.EventType.TOUCH_END, () => this.showAllPaylines());
    this.buildCinematicBloom();
    this.buildCinematicWipe();

    this.winLineG = this.mkNode('winLines', 10, 10, this.node).addComponent(Graphics);

    const spark = this.mkNode('winSpark', 26, 26, this.node);
    const sg = spark.addComponent(Graphics);
    sg.fillColor = new Color(255, 220, 245, 120);
    sg.circle(0, 0, 13);
    sg.fill();
    sg.fillColor = new Color(255, 255, 255, 235);
    sg.circle(0, 0, 7);
    sg.fill();
    spark.active = false;
    this.winSpark = spark;

    this.buildWinLineGlow();
    this.buildPlasmaCore();

    this.buildReelPortal();
    this.buildGridMerge();

    this.buildFlankCrystals();

    this.buildWinFlames();

    this.buildWinBeams();
    SymbolView.fxBurstMat = this.getEffectMaterial('soft-burst');
    SymbolView.fxWhiteFrame = this.getWhiteFrame();

    const haloBase = this.getEffectMaterial('svarka-additive');
    if (haloBase?.effectAsset) {
      const hm = new Material();
      hm.initialize({ effectAsset: haloBase.effectAsset, defines: { USE_TEXTURE: true } });
      SymbolView.fxHaloMat = hm;
    } else {
      SymbolView.fxHaloMat = null;
    }

    ParticlePool.glowMat = this.getEffectMaterial('particle-glow');
    ParticlePool.glowFrame = this.getWhiteFrame();

    const fx = VIEW_CONFIG.win.symbolFx;
    this.getEffectMaterial('symbol-win')?.setProperty('u_intensity', fx.intensity);
    this.getEffectMaterial('symbol-win')?.setProperty('u_rimWidth', fx.rimWidth);
    this.getEffectMaterial('symbol-win')?.setProperty('u_sweepSpeed', fx.sweepSpeed);
    this.getEffectMaterial('soft-burst')?.setProperty(
      'u_intensity',
      VIEW_CONFIG.win.burst.intensity,
    );

    const beam = VIEW_CONFIG.win.beams;
    this.getEffectMaterial('win-beam')?.setProperty('u_intensity', beam.intensity);
    this.getEffectMaterial('win-beam')?.setProperty('u_flowSpeed', beam.flowSpeed);

    this.anticipation = this.mkNode('anticipation', 10, 10, this.node).addComponent(
      AnticipationLayer,
    );
    this.particles = this.mkNode('particles', 10, 10, this.node).addComponent(ParticleLayer);

    this.schedule(this.tickUTime, 0);

    if (!this.externalControls) {
      this.buildHud();
      this.buildControlDeck();
    }
    this.bannerLabel = this.mkLabel('', 0, 250, 36, ACID, this.node, true);

    this.ceremony = this.mkNode('ceremonyLayer', 10, 10, this.node).addComponent(CeremonyView);
    this.ceremony.build(this.node);

    this.buildBuyFab();

    this.fit();
  }

  private buildBuyFab(): void {
    const sf = this.brandFrames.buyArt ?? null;
    const fab = this.mkNode('buyFab', 96, 96, this.node);
    const fabAnim = this.mkNode('buyFabAnim', 96, 96, fab);

    const fabPress = this.mkNode('buyFabPress', 96, 96, fabAnim);
    let targetW = 100;
    if (sf) {
      const os = sf.originalSize;
      const aw = Math.max(1, os.width);
      const ah = Math.max(1, os.height);
      [fab, fabAnim, fabPress].forEach((n) => n.getComponent(UITransform)!.setContentSize(aw, ah));

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
      this.buyFabBaseScale = targetW / aw;
      fab.setScale(this.buyFabBaseScale, this.buyFabBaseScale, 1);
    } else {
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

    fab.setPosition(-(this.gw / 2 + 14 + targetW / 2), VIEW_CONFIG.layout.reelCenterY, 0);

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

    this.addBuyAmbient(fabPress, targetW);
  }

  private addBuyAmbient(fabPress: Node, fabW: number): void {
    if (this.reducedFx) return;
    const cfg = VIEW_CONFIG.buy.ambient;

    const plasmaNode = this.mkNode('buyPlasma', fabW, fabW, fabPress);
    plasmaNode.setSiblingIndex(0);
    const psp = plasmaNode.addComponent(Sprite);
    psp.sizeMode = Sprite.SizeMode.CUSTOM;
    psp.color = new Color(255, 90, 156, Math.round(cfg.plasmaAlpha * 255));
    const plasmaMat = this.getEffectMaterial('buy-plasma');
    if (plasmaMat) psp.customMaterial = plasmaMat;
    this.buyPlasma = plasmaNode;
  }

  setBuyFabVisible(on: boolean): void {
    if (this.buyFab) this.buyFab.active = on;
  }

  private mkScrim(parent: Node, onTap: () => void): Node {
    const scrim = this.mkNode('scrim', 2600, 2200, parent);
    scrim.setSiblingIndex(0);
    const g = scrim.addComponent(Graphics);
    const sc = new Color().fromHEX(PAL.scrim);
    g.fillColor = new Color(sc.r, sc.g, sc.b, Math.round(VIEW_CONFIG.modal.scrimAlpha * 255));
    g.rect(-1300, -1100, 2600, 2200);
    g.fill();
    scrim.on(Node.EventType.TOUCH_END, () => onTap());
    return scrim;
  }

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

  private addPanelDismiss(panel: Node, panelW: number, panelH: number, onClose: () => void): void {
    this.mkScrim(panel, () => {
      if (VIEW_CONFIG.modal.dismissOnScrim) onClose();
    });
    this.mkCloseX(panel, panelW, panelH, onClose);
  }

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

  private buildPlasmaCore(): void {
    const cfg = VIEW_CONFIG.win.svarka;
    const root = this.mkNode('plasmaCore', 40, 40, this.node);
    root.active = false;
    this.plasmaCore = root;
    for (let i = 0; i < cfg.coreDiscs; i++) {
      const disc = this.mkNode(`disc${i}`, 40, 40, root);
      const g = disc.addComponent(Graphics);

      const r = 18 - i * 4;
      const alpha = 60 + i * 50;
      g.fillColor = new Color(127, 231, 255, alpha);
      g.circle(0, 0, r);
      g.fill();
      this.plasmaDiscs.push(disc);
    }

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

  private getWhiteFrame(): SpriteFrame {
    if (this.whiteFrame) return this.whiteFrame;
    const w = 8;
    const data = new Uint8Array(w * w * 4).fill(255);

    const tex = new Texture2D();
    tex.reset({ width: w, height: w, format: Texture2D.PixelFormat.RGBA8888 });
    tex.uploadData(data);
    const sf = new SpriteFrame();
    sf.texture = tex;
    sf.packable = false;
    this.whiteFrame = sf;
    return sf;
  }

  private buildWinFlames(): void {
    if (!VIEW_CONFIG.vfx.materialsEnabled) return;
    if (!VIEW_CONFIG.win.fireFlames.enabled) return;
    const mat = this.getEffectMaterial('win-fire');
    if (!mat) return;
    const { cell } = VIEW_CONFIG.layout;
    const count = GRID.reels * GRID.rows;
    const root = this.mkNode('winFlames', 10, 10, this.node);

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

  private showWinFlames(centers: Vec3[]): void {
    if (this.reducedFx || !this.winFlames.length) return;
    centers.forEach((c, i) => {
      const n = this.winFlames[i];
      if (!n) return;

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

  private hideWinFlames(): void {
    this.winFlames.forEach((n) => {
      if (!n) return;
      Tween.stopAllByTarget(n);
      const op = n.getComponent(UIOpacity);
      if (op) Tween.stopAllByTarget(op);
      n.active = false;
    });
  }

  private buildWinBeams(): void {
    if (!VIEW_CONFIG.win.beams.enabled) return;
    const cfg = VIEW_CONFIG.win.beams;
    const root = this.mkNode('winBeams', 10, 10, this.node);
    const mat = VIEW_CONFIG.vfx.materialsEnabled ? this.getEffectMaterial('win-beam') : null;
    if (mat) {
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

    const core = this.mkNode('winCore', 10, 10, root);
    this.winCoreG = core.addComponent(Graphics);
  }

  private showWinBeams(lineWins: { lineIndex: number; count: number }[]): void {
    if (this.reducedFx) return;
    const cfg = VIEW_CONFIG.win.beams;
    const staggerS = (cfg.revealStaggerMs ?? 0) / 1000;

    if (this.winCoreG) this.winCoreG.clear();
    if (!this.winBeams.length) return;
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
        const idx = b;
        const n = this.winBeams[b++];

        n.getComponent(UITransform)!.setContentSize(len * 1.22, cfg.heightPx);
        n.setPosition((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, 0);
        n.angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        n.active = true;
        const op = n.getComponent(UIOpacity)!;
        Tween.stopAllByTarget(op);
        Tween.stopAllByTarget(n);
        op.opacity = 0;

        n.setScale(1, 0.7, 1);
        tween(op)
          .delay(idx * staggerS)
          .to(cfg.fadeInMs / 1000, { opacity: cfg.holdOpacity })
          .start();
        tween(n)
          .delay(idx * staggerS)
          .to(cfg.fadeInMs / 1000, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
          .start();
      }
    }
  }

  private hideWinBeams(): void {
    this.winCoreG?.clear();
    this.winBeams.forEach((n) => {
      const op = n.getComponent(UIOpacity);
      if (op) Tween.stopAllByTarget(op);
      Tween.stopAllByTarget(n);
      n.setScale(1, 1, 1);
      n.active = false;
    });
  }

  private buildFlankCrystals(): void {
    const cfg = VIEW_CONFIG.decor.flankCrystal;
    if (!cfg.enabled) return;
    const make = (name: string): Node => {
      const n = this.mkNode(name, cfg.sizePx, cfg.sizePx * 1.6, this.node);
      const g = n.addComponent(Graphics);
      const r = cfg.sizePx / 2;

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
      n.active = false;

      const mat = this.getEffectMaterial('crystal-idle');
      if (mat) {
        const overlay = this.mkNode('shimmer', cfg.sizePx, cfg.sizePx * 1.6, n);
        const sp = overlay.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.customMaterial = mat;
        sp.color = new Color(255, 200, 240, 80);
      }
      if (!this.reducedFx) {
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

  private buildReelPortal(): void {
    const cfg = VIEW_CONFIG.spin.portal;
    if (!cfg.enabled) return;
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

  private playReelPortalEntry(): void {
    if (this.reducedFx) return;
    const cfg = VIEW_CONFIG.spin.portal;
    if (!cfg.enabled) return;
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

  private playReelPortalExit(): void {
    if (this.reducedFx) return;
    const cfg = VIEW_CONFIG.spin.portal;
    if (!cfg.enabled) return;
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

  private playGridMergeWipe(): void {
    if (this.reducedFx) return;
    const cfg = VIEW_CONFIG.bonus.mergeWipe;
    const n = this.gridMergeNode;
    if (!n) return;
    n.active = true;
    const op = n.getComponent(UIOpacity);
    if (!op) return;
    Tween.stopAllByTarget(op);
    Tween.stopAllByTarget(n);
    const dur = cfg.ms / 1000;
    op.opacity = 0;
    n.setPosition(0, ((this.gh + 12) / 2) * cfg.dir, 0);
    // Start as a tight leading line that snaps open — a sharp sweep reads as
    // intent, a slow grow reads as a loading bar. expoOut launch + backOut settle.
    n.setScale(1, 0.06, 1);
    tween(op)
      .to(dur * 0.22, { opacity: 255 }, { easing: 'quadOut' }) // bright leading edge punches in
      .to(dur * 0.62, { opacity: 0 }, { easing: 'sineIn' }) // then blooms away as the board takes over
      .call(() => (n.active = false))
      .start();
    tween(n)
      .to(dur * 0.55, { scale: new Vec3(1, 1.06, 1) }, { easing: 'expoOut' }) // snap open past full
      .to(dur * 0.45, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' }) // settle back
      .start();
  }

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
          } catch {}
        }
      }
    }

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

    if (this.parallaxLayers.length) {
      const p = VIEW_CONFIG.world.parallax;
      if (this.reducedFx) {
        this.pxLean = 0;
        this.pxPulse = 0;
      } else {
        this.pxLean += (this.pxLeanTarget - this.pxLean) * Math.min(1, dt * p.leanLerp);
        this.pxPulse *= Math.max(0, 1 - dt * p.pulseDecay);
      }
      const offY = -this.pxLean * p.spinLeanPx + this.pxPulse * p.winPulsePx;
      for (const L of this.parallaxLayers) {
        L.node.setPosition(L.baseX, L.baseY + offY * L.depth, 0);
      }
    }
  };

  private buildBackground(): void {
    const overscan = VIEW_CONFIG.layout.bgCoverOverscan;
    const baseW = Math.round(2600 * overscan);
    const baseH = Math.round(2200 * overscan);
    const base = this.mkNode('bg', baseW, baseH, this.node);
    const bg = base.addComponent(Graphics);
    bg.fillColor = new Color(10, 6, 16, 255);
    bg.rect(-baseW / 2, -baseH / 2, baseW, baseH);
    bg.fill();
    if (this.brandFrames.bg) {
      const ratio = 2752 / 1536;
      const w = Math.max(baseW, baseH * ratio);
      const photo = this.mkNode('bg_art', w, w / ratio, this.node);
      const sp = photo.addComponent(Sprite);
      sp.sizeMode = Sprite.SizeMode.CUSTOM;
      sp.spriteFrame = this.brandFrames.bg;
      photo.getComponent(UITransform)!.setContentSize(w, w / ratio);
      const op = photo.addComponent(UIOpacity);
      op.opacity = 235;
      this.bgArt = photo;
    } else {
      bg.fillColor = new Color(40, 22, 78, 70);
      bg.rect(-1300, -120, 2600, 620);
      bg.fill();
      bg.fillColor = new Color(25, 17, 64, 90);
      bg.rect(-1300, -560, 2600, 440);
      bg.fill();
      bg.fillColor = new Color(4, 2, 8, 130);
      bg.rect(-1300, -1100, 2600, 460);
      bg.fill();
    }

    const dots = this.mkNode('bg_bokeh', 10, 10, this.node);
    const dg = dots.addComponent(Graphics);
    const rng = createRng(20260610).next;
    for (let i = 0; i < 30; i++) {
      const x = (rng() - 0.5) * 1500;
      const y = (rng() - 0.5) * 1100;
      const r = 4 + rng() * 14;
      const warm = rng() > 0.55;
      dg.fillColor = warm
        ? new Color(255, 90, 156, Math.round(10 + rng() * 22))
        : new Color(120, 200, 255, Math.round(8 + rng() * 16));
      dg.circle(x, y, r);
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

    const DIAMONDS = 6;
    for (let i = DIAMONDS; i > 0; i--) {
      const t = i / DIAMONDS;
      const w = 620 * t;
      const h = 470 * t;
      gg.fillColor = new Color(255, 90, 156, Math.round(2 + (1 - t) * 7));
      gg.ellipse(0, 0, w, h);
      gg.fill();
    }
    tween(glow)
      .to(2.6, { scale: new Vec3(1.05, 1.05, 1) }, { easing: 'sineInOut' })
      .to(2.6, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
      .union()
      .repeatForever()
      .start();

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

    (
      [
        ['bg_art', 1.0],
        ['bg_bokeh', 0.55],
        ['bg_glow', 0.35],
      ] as [string, number][]
    ).forEach(([name, depth]) => {
      const node = this.node.getChildByName(name);
      if (node)
        this.parallaxLayers.push({ node, depth, baseX: node.position.x, baseY: node.position.y });
    });
  }

  private buildTitle(): void {
    const logo = this.mkNode('logo', 300, 150, this.node);
    logo.setPosition(0, 312, 0);
    this.logoNode = logo;
    const art = this.mkNode('logoArt', 300, 150, logo);
    if (this.brandFrames.logo) {
      const sp = art.addComponent(Sprite);
      sp.sizeMode = Sprite.SizeMode.CUSTOM;
      sp.spriteFrame = this.brandFrames.logo;
      art.getComponent(UITransform)!.setContentSize(232, 145);
    } else {
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

    const w = this.gw + 14;
    const h = this.gh + 14;
    const frame = this.mkNode('frame', w, h, this.node);
    frame.setPosition(0, reelCenterY, 0);

    const halo = this.mkNode('portalGlow', w + 120, h + 120, this.node);
    halo.setPosition(0, reelCenterY, 0);
    const hg = halo.addComponent(Graphics);
    for (let i = 9; i >= 0; i--) {
      const t = i / 9;
      const sp = i * 6;
      hg.lineWidth = 9 - t * 6;

      hg.strokeColor = new Color(
        255,
        Math.round(60 + (1 - t) * 110),
        Math.round(150 + (1 - t) * 60),
        Math.round((1 - t) * (1 - t) * 90),
      );
      hg.roundRect(-w / 2 - sp, -h / 2 - sp, w + sp * 2, h + sp * 2, 16 + sp);
      hg.stroke();
    }
    const haloOp = halo.addComponent(UIOpacity);
    haloOp.opacity = 170;
    tween(haloOp)
      .to(1.7, { opacity: 255 }, { easing: 'sineInOut' })
      .to(1.7, { opacity: 140 }, { easing: 'sineInOut' })
      .union()
      .repeatForever()
      .start();

    const g = frame.addComponent(Graphics);

    g.fillColor = new Color(0, 0, 0, 160);
    g.roundRect(-w / 2 - 6, -h / 2 - 12, w + 12, h + 8, 18);
    g.fill();

    g.fillColor = new Color(14, 7, 26, 158);
    g.roundRect(-w / 2, -h / 2, w, h, 14);
    g.fill();
    for (let i = 1; i <= 3; i++) {
      const inset = i * 5;
      g.fillColor = new Color(7, 3, 16, 14);
      g.roundRect(
        -w / 2 + inset,
        -h / 2 + inset,
        w - inset * 2,
        h - inset * 2,
        Math.max(2, 12 - i * 2),
      );
      g.fill();
    }

    g.lineWidth = 3;
    g.strokeColor = new Color(255, 150, 205, 205);
    g.roundRect(-w / 2, -h / 2, w, h, 14);
    g.stroke();

    g.fillColor = new Color(245, 247, 250, 20);
    g.roundRect(-w / 2 + 8, h / 2 - 16, w - 16, 9, 6);
    g.fill();

    const sep = this.mkNode('reelSeps', this.gw, this.gh, this.node);
    sep.setPosition(0, reelCenterY, 0);
    const sg = sep.addComponent(Graphics);

    const { cell, gap } = VIEW_CONFIG.layout;
    for (let r = 0; r < GRID.reels; r++) {
      const x = -this.gw / 2 + r * this.pitch;
      const y = -this.gh / 2;
      sg.fillColor = new Color(255, 255, 255, 6);
      sg.roundRect(x, y, cell, this.gh, 10);
      sg.fill();
    }
    void gap;
  }

  private buildCosmicShimmer(): void {
    const { reelCenterY } = VIEW_CONFIG.layout;
    const root = this.mkNode('cosmicShimmer', this.gw, this.gh, this.node);
    root.setPosition(0, reelCenterY, 0);
    const halfW = this.gw / 2 - 6;
    const halfH = this.gh / 2 - 6;
    const rng = createRng(20260615).next;
    const star = (g: Graphics, x: number, y: number, r: number, c: Color): void => {
      g.fillColor = c;
      g.moveTo(x, y - r);
      g.lineTo(x + r, y);
      g.lineTo(x, y + r);
      g.lineTo(x - r, y);
      g.close();
      g.fill();
    };

    const neb = this.mkNode('cosmicNebula', this.gw, this.gh, root);
    const ng = neb.addComponent(Graphics);
    (
      [
        [-halfW * 0.45, halfH * 0.3, 360, 260, 120, 170, 255, 13],
        [halfW * 0.5, -halfH * 0.35, 320, 230, 190, 130, 220, 12],
        [halfW * 0.1, halfH * 0.55, 300, 200, 120, 210, 255, 10],
      ] as number[][]
    ).forEach(([cx, cy, w, h, cr, cg, cb, ca]) => {
      ng.fillColor = new Color(cr, cg, cb, ca);
      ng.moveTo(cx, cy - h);
      ng.lineTo(cx + w, cy);
      ng.lineTo(cx, cy + h);
      ng.lineTo(cx - w, cy);
      ng.close();
      ng.fill();
    });
    if (!this.reducedFx) {
      tween(neb)
        .to(7.5, { position: new Vec3(14, -8, 0) }, { easing: 'sineInOut' })
        .to(7.5, { position: new Vec3(-12, 6, 0) }, { easing: 'sineInOut' })
        .union()
        .repeatForever()
        .start();
    }

    const layerCfg: [number, number, number, number][] = [
      [10, 26, 150, 2.3],
      [9, 20, 120, 3.1],
      [8, 30, 170, 1.7],
    ];
    layerCfg.forEach(([n, dim, bright, period], li) => {
      const layer = this.mkNode(`cosmicStars${li}`, this.gw, this.gh, root);
      const sg = layer.addComponent(Graphics);
      for (let i = 0; i < n; i++) {
        const x = (rng() - 0.5) * 2 * halfW;
        const y = (rng() - 0.5) * 2 * halfH;
        const r = 2.2 + rng() * 2.6;
        const pink = rng() > 0.78;
        const c = pink ? new Color(255, 158, 208, 255) : new Color(232, 240, 255, 255);
        star(sg, x, y, r, c);

        if (r > 4) star(sg, x, y, r * 1.9, new Color(c.r, c.g, c.b, 36));
      }
      const op = layer.addComponent(UIOpacity);
      if (this.reducedFx) {
        op.opacity = Math.round((dim + bright) / 2);
      } else {
        op.opacity = bright;
        tween(op)
          .to(period, { opacity: dim }, { easing: 'sineInOut' })
          .to(period, { opacity: bright }, { easing: 'sineInOut' })
          .union()
          .repeatForever()
          .start();
      }
    });
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

    this.buildWindowFeather();
  }

  private buildWindowFeather(): void {
    const { reelCenterY, windowFeatherPx } = VIEW_CONFIG.layout;
    const make = (sign: 1 | -1, name: string): Node => {
      const n = this.mkNode(name, this.gw + 4, windowFeatherPx, this.node);
      const g = n.addComponent(Graphics);
      const steps = 5;

      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const stripH = windowFeatherPx / steps;
        const yTop =
          sign === 1 ? windowFeatherPx / 2 - i * stripH : -windowFeatherPx / 2 + i * stripH;
        const alpha = Math.round(180 * (1 - t));
        g.fillColor = new Color(10, 6, 16, alpha);
        g.rect(-(this.gw + 4) / 2, yTop - (sign === 1 ? stripH : 0), this.gw + 4, stripH);
        g.fill();
      }

      n.setPosition(0, reelCenterY + sign * (this.gh / 2 - windowFeatherPx / 2), 0);
      return n;
    };
    this.windowFeatherTop = make(1, 'windowFeatherTop');
    this.windowFeatherBottom = make(-1, 'windowFeatherBottom');
  }

  private buildCinematicBloom(): void {
    const W = 2600;
    const H = 2200;
    const bloom = this.mkNode('cineBloom', W, H, this.node);
    const bg = bloom.addComponent(Graphics);
    bg.fillColor = new Color(255, 238, 205, 255);
    bg.rect(-W / 2, -H / 2, W, H);
    bg.fill();
    this.cineBloomOp = bloom.addComponent(UIOpacity);
    this.cineBloomOp.opacity = 0;
  }

  cinematicBloom(intensity = 1): void {
    if (!this.cineBloomOp || this.reducedFx) return;
    const peak = Math.round(34 + 60 * Math.min(1, Math.max(0, intensity)));
    Tween.stopAllByTarget(this.cineBloomOp);
    this.cineBloomOp.opacity = 0;
    tween(this.cineBloomOp)
      .to(0.08, { opacity: peak }, { easing: 'quadOut' })
      .to(0.5, { opacity: 0 }, { easing: 'quadIn' })
      .start();
  }

  private buildCinematicWipe(): void {
    const wipe = this.mkNode('cineWipe', 2600, 2200, this.node);
    this.cineWipe = wipe;
    this.cineWipeOp = wipe.addComponent(UIOpacity);
    this.cineWipeOp.opacity = 0;
    wipe.active = false;

    const band = this.mkNode('cineWipeBand', 1200, 2800, wipe);
    band.eulerAngles = new Vec3(0, 0, 16);
    this.cineWipeBand = band;
    this.cineWipeG = band.addComponent(Graphics);
  }

  // Candy-wipe + soft-bloom — one reusable cinematic transition fired on
  // every major state change (intro->game, base<->bonus, free-spins, round end).
  cinematicWipe(core: Color, halo: Color, dir = 1, intensity = 1): void {
    // No full-screen bloom here — it washed the board out; the translucent band carries the sweep.
    const wipe = this.cineWipe;
    const op = this.cineWipeOp;
    const band = this.cineWipeBand;
    const g = this.cineWipeG;
    if (!wipe || !op || !band || !g) return;

    if (this.reducedFx) {
      // Accessible fallback: a brief candy luminance pulse, no sweep.
      wipe.active = true;
      wipe.setSiblingIndex(this.node.children.length - 1);
      band.setPosition(0, 0, 0);
      this.paintWipeBand(g, core, halo, 1);
      Tween.stopAllByTarget(op);
      op.opacity = 0;
      tween(op)
        .to(0.12, { opacity: 150 }, { easing: 'quadOut' })
        .to(0.26, { opacity: 0 }, { easing: 'quadIn' })
        .call(() => (wipe.active = false))
        .start();
      return;
    }

    this.paintWipeBand(g, core, halo, intensity);
    const span = 2200;
    wipe.active = true;
    wipe.setSiblingIndex(this.node.children.length - 1);
    Tween.stopAllByTarget(op);
    Tween.stopAllByTarget(band);
    op.opacity = 0;
    band.setPosition(-dir * span, 0, 0);
    tween(band)
      .to(0.46, { position: new Vec3(dir * span, 0, 0) }, { easing: 'quartOut' })
      .start();
    tween(op)
      .to(0.1, { opacity: 255 }, { easing: 'quadOut' })
      .delay(0.12)
      .to(0.22, { opacity: 0 }, { easing: 'cubicIn' })
      .call(() => (wipe.active = false))
      .start();
  }

  private paintWipeBand(g: Graphics, core: Color, halo: Color, intensity: number): void {
    const H = 2800;
    const a = Math.min(1, Math.max(0.4, intensity));
    g.clear();
    // Feathered candy band: wide soft halo -> brighter core, centred on x=0.
    // Kept TRANSLUCENT on purpose — the board must read through the sweep so a
    // transition never washes the reels/symbols out. Max core alpha ~110/255.
    const layers: [number, Color, number][] = [
      [560, halo, 16 * a],
      [320, halo, 42 * a],
      [180, core, 78 * a],
      [80, core, 110 * a],
    ];
    for (const [w, col, alpha] of layers) {
      g.fillColor = new Color(col.r, col.g, col.b, Math.round(alpha));
      g.rect(-w / 2, -H / 2, w, H);
      g.fill();
    }
    // Two thin peppermint glints riding the core for the candy read.
    g.fillColor = new Color(255, 255, 255, Math.round(120 * a));
    g.rect(-128, -H / 2, 8, H);
    g.fill();
    g.rect(104, -H / 2, 8, H);
    g.fill();
  }

  /** Named candy tones so callers stay declarative. */
  wipeTones = {
    fs: { core: new Color(255, 150, 205, 255), halo: new Color(255, 92, 158, 255) },
    bonus: { core: new Color(255, 120, 235, 255), halo: new Color(196, 70, 230, 255) },
    win: { core: new Color(255, 238, 205, 255), halo: new Color(255, 184, 90, 255) },
    intro: { core: new Color(255, 244, 222, 255), halo: new Color(255, 170, 120, 255) },
  } as const;

  wipe(tone: keyof SlotView['wipeTones'], dir = 1, intensity = 1): void {
    const t = this.wipeTones[tone];
    this.cinematicWipe(t.core, t.halo, dir, intensity);
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

  private bottomInset = 0;

  private fabDockX(sign: 1 | -1, scale: number, screenW: number): number | null {
    const fab = VIEW_CONFIG.layout.fab;
    const frameHalfW = this.gw / 2 + 24;

    const fabHalfW = (fab.sizePx * fab.landscapeScale) / 2;
    const ideal = sign * (frameHalfW + fab.gapPx + fabHalfW);
    const screenHalfWLocal = screenW / 2 / scale;
    const outerLimit = screenHalfWLocal - fab.edgePadPx - fabHalfW;
    const innerLimit = frameHalfW + fab.minClearancePx + fabHalfW;
    if (outerLimit < innerLimit) return null;
    const idealAbs = Math.abs(ideal);
    const clampedAbs = Math.max(innerLimit, Math.min(outerLimit, idealAbs));
    return sign * clampedAbs;
  }

  private fit(): void {
    const vis = view.getVisibleSize();
    const L = VIEW_CONFIG.layout;
    const { designWidth, designHeight, reelCenterY } = L;
    const availH = Math.max(160, vis.height - this.bottomInset);

    const isLandscape = vis.width > vis.height * 1.05;

    const contentTop = isLandscape
      ? reelCenterY + this.gh / 2 + L.landscapeTopPadPx
      : L.contentTopPx;
    const contentBottom = this.externalControls
      ? reelCenterY - this.gh / 2 - L.boardBottomGapPx
      : -designHeight / 2;
    const contentH = contentTop - contentBottom;
    const contentCenter = (contentTop + contentBottom) / 2;

    const sWidth = isLandscape
      ? (vis.width * L.landscapeWidthFill) / designWidth
      : (vis.width * L.portraitWidthFill) / this.gw;
    const s = Math.min(sWidth, availH / contentH);
    this.node.setScale(s, s, 1);

    this.node.setPosition(0, this.bottomInset / 2 - contentCenter * s, 0);

    this.fitBackgroundCover(s, vis);

    if (this.logoNode) {
      if (isLandscape) {
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
      this.titleCaption.active = !isLandscape;
    }
    if (this.buyFab) {
      const fab = L.fab;
      const base = this.buyFabBaseScale;

      const fabRoot = this.node.parent;
      if (fabRoot && this.buyFab.parent !== fabRoot) {
        this.buyFab.setParent(fabRoot);
      }

      if (fabRoot) this.buyFab.setSiblingIndex(fabRoot.children.length - 1);
      if (isLandscape) {
        const lsc = base * s * fab.landscapeScale;
        this.buyFab.setScale(lsc, lsc, 1);
        const x = this.fabDockX(fab.landscapeDockSign as 1 | -1, s, vis.width);
        if (x === null) {
          this.buyFab.active = false;
        } else {
          this.buyFab.active = true;
          this.buyFab.setPosition(
            x * s + this.node.position.x,
            reelCenterY * s + this.node.position.y,
            0,
          );
        }
      } else {
        this.buyFab.active = true;

        const ut = this.buyFab.getComponent(UITransform);
        const sc = fab.portraitWidthPx / Math.max(1, ut?.width ?? 96);
        this.buyFab.setScale(sc, sc, 1);
        const canvasX = (fab.portraitScreenX - 0.5) * vis.width;

        const fabScreenH = (ut?.height ?? 96) * sc;
        const fromBottom =
          this.bottomInset > 0
            ? this.bottomInset * fab.portraitBandFrac
            : Math.max(fab.portraitScreenY * vis.height, fabScreenH / 2 + 12);
        this.buyFab.setPosition(canvasX, fromBottom - vis.height / 2, 0);
      }
    }

    if (this.windowFeatherTop) {
      this.windowFeatherTop.setPosition(0, reelCenterY + this.gh / 2 - L.windowFeatherPx / 2, 0);
    }
    if (this.windowFeatherBottom) {
      this.windowFeatherBottom.setPosition(0, reelCenterY - this.gh / 2 + L.windowFeatherPx / 2, 0);
    }

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

    if (this.reelPortalTop) this.reelPortalTop.setPosition(0, reelCenterY + this.gh / 2 + 6, 0);
    if (this.reelPortalBottom)
      this.reelPortalBottom.setPosition(0, reelCenterY - this.gh / 2 - 6, 0);
    if (this.gridMergeNode) this.gridMergeNode.setPosition(0, reelCenterY, 0);

    if (this.buyModal?.isOpen()) this.fitBuyModal();
  }

  private static BUY_PRESENT: Record<string, { accent: string; special: string }> = {
    wilds: { accent: '#ff5ab0', special: 'Wilds stick & bounce every spin' },
    crowns: { accent: '#ffcf5a', special: 'Crowns lock in for the feature' },
    reels: { accent: '#b86fda', special: 'Full wild reels strike in' },
  };

  configureBuyMenu(options: BuyOption[]): void {
    if (!this.buyModal) {
      const root = this.node.parent ?? this.node;
      const host = this.mkNode('buyModal', 10, 10, root);
      host.setPosition(0, 0, 0);
      host.setSiblingIndex(root.children.length - 1);
      this.buyModal = host.addComponent(BuyBonusModal);
      this.buyModal.on('buy', (mode) => {
        this.buyMenuOpen = false;
        this.buyModal?.close();
        this.buyCb?.(mode as string);
      });
      this.buyModal.on('bet:inc', () => this.buyBetStepCb?.(1));
      this.buyModal.on('bet:dec', () => this.buyBetStepCb?.(-1));
      this.buyModal.on('ui:click', () => this.audio.click());
      // Scrim tap / cancel / close-X all emit 'cancel' and self-close the modal;
      // route through closeBuyMenu so the buy FAB + betting bar are restored.
      this.buyModal.on('cancel', () => this.closeBuyMenu());
      this.buyModal.on('buy:blocked', () => this.audio.click());
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

  setBuyBet(betText: string): void {
    this.buyBetText = betText;
    this.buyModal?.setBet(betText);
  }

  refreshBuyCosts(costTexts: string[]): void {
    this.buyModal?.setCosts(costTexts);
  }

  setBuyAffordable(flags: boolean[]): void {
    this.buyModal?.setAffordable(flags);
  }

  onBuyBetStep(cb: (dir: number) => void): void {
    this.buyBetStepCb = cb;
  }

  private toggleBuyMenu(): void {
    if (this.buyModal?.isOpen()) this.closeBuyMenu();
    else this.openBuyMenu();
  }

  closeBuyMenu(): void {
    this.buyMenuOpen = false;
    // Restore the bar + FAB FIRST (synchronous), so even if the modal close below
    // ever throws, the UI can never be stranded hidden — this is the root of the
    // "betting panel stays hidden after exiting buy bonus" report. Also re-synced
    // next frame to cover any tail state.
    this.setBuyFabVisible(true);
    this.onOverlay?.(this.anyOverlayOpen());
    this.scheduleOverlaySync();
    this.buyModal?.close();
  }

  openBuyMenu(): void {
    this.closeOverlays();
    this.buyMenuOpen = true;
    this.fitBuyModal();
    this.buyModal?.open();
    this.audio.buyOpen();
    this.setBuyFabVisible(false);
    this.onOverlay?.(this.anyOverlayOpen());
    this.scheduleOverlaySync();
  }

  private fitBuyModal(): void {
    if (!this.buyModal) return;
    const vis = view.getVisibleSize();
    this.buyModal.fit(vis.width, vis.height, this.bottomInset);
  }

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

  private buildInfoPanel(tab: 'rules' | 'paytable' | 'info'): void {
    const wasOpen = this.infoPanel?.active ?? true;
    this.infoPanel?.destroy();
    this.infoTab = tab;

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

    const contentWidth = w - info.leftMargin * 2;
    const wrapLine = (
      text: string,
      y: number,
      size: number = info.bodySize,
      col: Color = MUTED,
    ): number => {
      const n = this.mkNode('infoLine', contentWidth, size + 8, panel);
      n.setPosition(-w / 2 + info.leftMargin, y, 0);

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

      y -= 30;
      for (const line of SCATTER_LINES) {
        const ht = wrapLine(line, y, info.captionSize, line.startsWith('   ') ? MUTED : ACID);
        y -= ht + info.lineGap;
      }
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
      y -= 6;

      y -= wrapLine('FEATURES', y, info.headerSize, ACID) + info.lineGap;
      for (const line of FEATURES_LINES) {
        y -= wrapLine(line, y, info.captionSize) + 3;
      }
      y -= 8;
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

  openMenuHub(): void {
    if (!this.menuHub) this.menuHub = this.buildMenuHub();
    this.closeOverlays();
    this.popOpen(this.menuHub);
  }

  private static MENU_PRESENT: Record<string, { accent: string; caption: string }> = {
    'BUY FEATURE': { accent: '#ff5ab0', caption: 'Skip the wait — buy any feature' },
    'QUICK BET': { accent: '#ffcf5a', caption: 'Preset stake grid' },
    'GAME INFO': { accent: '#7fe7ff', caption: 'Rules, paytable, RTP' },
    SETTINGS: { accent: '#c566ff', caption: 'Sound, turbo, reduced FX' },
    AUTOPLAY: { accent: '#b86fda', caption: 'Run a planned series of spins' },
  };

  private buildMenuHub(): Node {
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

      const tile = row.addComponent(Graphics);
      tile.fillColor = new Color().fromHEX(PAL.tileBg);
      tile.roundRect(-rowW / 2, -cfg.rowH / 2, rowW, cfg.rowH, 14);
      tile.fill();
      tile.lineWidth = 1.2;
      tile.strokeColor = new Color(127, 231, 255, 110);
      tile.roundRect(-rowW / 2, -cfg.rowH / 2, rowW, cfg.rowH, 14);
      tile.stroke();

      const gemNode = this.mkNode('gem', cfg.gemSize * 2, cfg.gemSize * 2, row);
      gemNode.setPosition(-rowW / 2 + 22, 0, 0);
      const gg = gemNode.addComponent(Graphics);
      const accent = new Color().fromHEX(present.accent);
      accent.a = Math.round(cfg.accentAlpha * 255);
      gg.fillColor = accent;
      gg.circle(0, 0, cfg.gemSize);
      gg.fill();
      gg.fillColor = new Color(255, 255, 255, 180);
      gg.circle(0, 0, cfg.gemSize * 0.42);
      gg.fill();

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

      const chevNode = this.mkNode('chev', 14, 14, row);
      chevNode.setPosition(rowW / 2 - 22, 0, 0);
      const cg = chevNode.addComponent(Graphics);
      cg.lineWidth = 2.4;
      cg.strokeColor = new Color(255, 200, 240, 200);
      cg.moveTo(-3, 6);
      cg.lineTo(4, 0);
      cg.lineTo(-3, -6);
      cg.stroke();

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

    this.addPanelDismiss(hub, w, h, () => (hub.active = false));
    return hub;
  }

  private panelFitScale(node: Node): number {
    const ui = node.getComponent(UITransform);
    if (!ui || ui.height <= 0 || ui.width <= 0) return 1;
    const vis = view.getVisibleSize();
    const sy = Math.abs(this.node.scale.y) || 1;
    const sx = Math.abs(this.node.scale.x) || 1;
    const kH = (vis.height * 0.92) / (ui.height * sy);
    const kW = (vis.width * 0.94) / (ui.width * sx);
    return Math.min(1, kH, kW);
  }

  private popOpen(node: Node | null): void {
    if (!node) return;
    const op = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
    Tween.stopAllByTarget(node);
    Tween.stopAllByTarget(op);
    node.active = true;

    const k = this.panelFitScale(node);
    const sy = this.node.scale.y || 1;
    node.setPosition(node.position.x, -this.node.position.y / sy, 0);
    node.setScale(0.86 * k, 0.86 * k, 1);
    op.opacity = 0;
    tween(node)
      .to(0.2, { scale: new Vec3(k, k, 1) }, { easing: 'backOut' })
      .start();
    tween(op).to(0.16, { opacity: 255 }).start();
  }

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
        this.onOverlay?.(this.anyOverlayOpen());
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
    this.scheduleOverlaySync();
  }

  private anyOverlayOpen(): boolean {
    const on = (n: Node | null): boolean => !!(n && n.isValid && n.active);
    if (
      on(this.autoplayPanel) ||
      on(this.settingsPanel) ||
      on(this.menuHub) ||
      on(this.infoPanel) ||
      on(this.quickBetPanel)
    )
      return true;
    if (this.buyMenuOpen) return true;
    if (this.node.parent?.getChildByName('rcModal')) return true;
    return false;
  }

  private scheduleOverlaySync(): void {
    this.scheduleOnce(() => this.onOverlay?.(this.anyOverlayOpen()), 0);
  }

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

  buildIntro(onDismiss: () => void): void {
    const root = this.node.parent ?? this.node;

    const ov = this.mkNode('intro', 4000, 3200, root);
    const g = ov.addComponent(Graphics);

    g.fillColor = new Color(8, 4, 16, 150);
    g.rect(-2000, -1600, 4000, 3200);
    g.fill();

    g.fillColor = new Color(6, 3, 12, 90);
    g.rect(-900, -520, 1800, 1040);
    g.fill();

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

    const glow = this.mkNode('introGlow', 10, 10, ov);
    glow.setPosition(0, 70, 0);
    const gg = glow.addComponent(Graphics);
    for (let k = 6; k > 0; k--) {
      const t = k / 6;
      const w = 520 * t;
      const h = 360 * t;
      gg.fillColor = new Color(255, 90, 156, Math.round(3 + (1 - t) * 9));
      gg.ellipse(0, 0, w, h);
      gg.fill();
    }
    tween(glow)
      .to(2.4, { scale: new Vec3(1.06, 1.06, 1) }, { easing: 'sineInOut' })
      .to(2.4, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
      .union()
      .repeatForever()
      .start();

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

    const ctaGroup = this.mkNode('introCta', 320, 72, ov);
    ctaGroup.setPosition(0, -288, 0);
    const cg = ctaGroup.addComponent(Graphics);
    const drawCta = (glowA: number) => {
      if (!cg.isValid) return;
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

    const glowProxy = { v: 0 };
    tween(glowProxy)
      .delay(0.5)
      .to(0.9, { v: 1 }, { onUpdate: () => drawCta(glowProxy.v) })
      .to(0.9, { v: 0 }, { onUpdate: () => drawCta(glowProxy.v) })
      .union()
      .repeatForever()
      .start();

    const peek = this.mkNode('introPeek', 460, 170, ov);
    peek.setPosition(0, -150, 0);
    const peekOp = peek.addComponent(UIOpacity);
    peekOp.opacity = 0;
    const top = paytableRows().slice(0, 4);
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

    const vis = view.getVisibleSize();

    const introS = Math.min(vis.width / 480, vis.height / 880, 1.3);
    ov.setScale(introS, introS, 1);
    ov.setPosition(0, 0, 0);
    const raise = (): void => {
      if (ov.isValid && ov.parent) ov.setSiblingIndex(ov.parent.children.length - 1);
    };
    raise();
    this.scheduleOnce(raise, 0);

    ov.once(Node.EventType.TOUCH_END, () => {
      this.audio.click();

      Tween.stopAllByTarget(glowProxy);
      Tween.stopAllByTarget(logoNode);
      tween(logoNode)
        .to(0.12, { scale: new Vec3(1.12, 1.12, 1) }, { easing: 'quadOut' })
        .to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'quadIn' })
        .start();

      const op = ov.getComponent(UIOpacity) ?? ov.addComponent(UIOpacity);
      tween(op)
        .to(0.32, { opacity: 0 }, { easing: 'quadOut' })
        .call(() => ov.destroy())
        .start();

      const intro = VIEW_CONFIG.intro.fade;
      if (intro.ms > 0) {
        const fadeParent = this.node.parent ?? this.node;
        const fade = this.mkNode('introFade', 4000, 3200, fadeParent);
        fade.setSiblingIndex(fadeParent.children.length - 1);
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

  setReducedFx(on: boolean): void {
    this.reducedFx = on;
    this.reels.forEach((r) => r.setReducedMotion(on));
  }

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

  quickStopReels(): void {
    this.anticipation.clear();
    this.reels.forEach((r) => r.quickStop());
  }

  async playSpin(grid: number[][], speedMul = 1): Promise<void> {
    const { minSpinMs, reelStopStaggerMs } = VIEW_CONFIG.spin;
    const { minEarlyWilds, minEarlyScatters, extraSeconds } = VIEW_CONFIG.anticipation;

    // Tension on the last reels when the early reels (0-2) already tease a feature:
    // enough wilds for a WILD STRIKE, or enough scatters for the free-spins trigger
    // (scatters pay from anywhere, so a 3rd is live). Koster — vary anticipation by
    // trigger type; the bonus tease is the highest-tension moment in the game.
    let earlyWilds = 0;
    let earlyScatters = 0;
    for (let r = 0; r < 3; r++) {
      for (const id of grid[r]) {
        if (id === SYMBOLS.WILD) earlyWilds++;
        else if (id === SCATTER) earlyScatters++;
      }
    }
    const antic =
      (earlyWilds >= minEarlyWilds || earlyScatters >= minEarlyScatters) && !this.reducedFx;
    const turbo = speedMul <= VIEW_CONFIG.turbo.turbo;

    const cadence = this.reducedFx ? [0, 1, 2, 3, 4] : VIEW_CONFIG.spin.stopCadence;
    const minGapMs =
      VIEW_CONFIG.spin.stopMinGapMs[
        speedMul <= VIEW_CONFIG.turbo.max ? 'max' : turbo ? 'turbo' : 'off'
      ];

    this.audio.spinStart();
    this.audio.startRush();
    this.pxLeanTarget = 1;
    if (antic) this.audio.anticipation();

    this.playReelPortalEntry();
    await Promise.all(
      this.reels.map((reel, i) => {
        let cumGapMs = 0;
        for (let k = 1; k <= i; k++) {
          const dUnits = (cadence[k] ?? k) - (cadence[k - 1] ?? k - 1);
          cumGapMs += Math.max(dUnits * reelStopStaggerMs * speedMul, minGapMs);
        }
        let dur = minSpinMs / 1000 + cumGapMs / 1000 / speedMul;
        if (antic && i >= 3) {
          dur += extraSeconds;

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

          if (i === this.reels.length - 1) this.playReelPortalExit();
          const wildRows: number[] = [];
          grid[i].forEach((id, row) => {
            if (id === SYMBOLS.WILD) wildRows.push(row);
          });
          if (wildRows.length) {
            reel.flashWilds(wildRows);

            reel.recoil(VIEW_CONFIG.spin.bounce.wildRecoilScale);
            this.audio.wildLand();
          }
          if (i >= 3) this.anticipation.clear();
        });
      }),
    );
    this.audio.stopRush();
    this.pxLeanTarget = 0;
    this.anticipation.clear();
  }

  showWins(result: SpinResult): void {
    this.clearWins();
    const byReel = winningCellsByReel(result, GRID.reels);

    const totalCells = byReel.reduce((sum, rows) => sum + (rows ? rows.length : 0), 0);
    const rich = totalCells <= 8;

    const winMat = this.reducedFx ? null : this.getEffectMaterial('symbol-win');
    const waveStagger = VIEW_CONFIG.win.highlightWaveStagger;
    this.reels.forEach((reel, i) =>
      reel.highlight(byReel[i] ?? [], i * waveStagger, rich, winMat, this.winLift, (row) =>
        this.cellCenter(i, row),
      ),
    );

    if (!this.reducedFx && totalCells > 0) {
      const winningReels = this.reels.map((_, i) => i).filter((i) => (byReel[i]?.length ?? 0) > 0);
      winningReels.forEach((reelIdx, order) => {
        const progress = winningReels.length > 1 ? order / (winningReels.length - 1) : 0;
        this.scheduleOnce(() => this.audio.countTick(progress), reelIdx * waveStagger);
      });
      this.pxPulse = 1;
    }

    const anyWinFx =
      winMat ?? this.getEffectMaterial('soft-burst') ?? this.getEffectMaterial('win-beam');
    if (anyWinFx && !this.reducedFx && totalCells > 0) {
      this.symWinT = 0;
      this.unschedule(this.tickSymbolWin);
      this.schedule(this.tickSymbolWin, 0);
    }

    this.winLines = result.lineWins.map((w) => ({ lineIndex: w.lineIndex, count: w.count }));
    if (this.winLines.length === 0) return;

    if (!VIEW_CONFIG.win.showLines) {
      const centers: Vec3[] = [];
      byReel.forEach((rows, reel) => {
        (rows ?? []).forEach((row) => centers.push(this.cellCenter(reel, row)));
      });
      if (centers.length && !this.reducedFx) {
        this.particles.fireEmbers(centers);

        if (VIEW_CONFIG.win.fireFlames.enabled) this.showWinFlames(centers);

        if (VIEW_CONFIG.win.beams.enabled) this.showWinBeams(this.winLines);
      }

      this.showLineWinPops(result);

      this.drawCandyWinLines(this.winLines);
      return;
    }

    this.startWinLinePulse();
    if (this.reducedFx) {
      this.winCycle = 0;
      this.cycleWinLine();
      this.schedule(this.cycleWinLine, VIEW_CONFIG.win.lineCycleSeconds);
      return;
    }

    this.revealDur = Math.max(0.1, 0.26 - this.winLines.length * 0.016);
    this.revealIdx = 0;
    this.revealP = 0;
    this.schedule(this.tickReveal, 0);
  }

  private candySpark: Node | null = null;
  private ensureCandySpark(): Node {
    if (this.candySpark) return this.candySpark;
    const n = this.mkNode('candySpark', 18, 18, this.winLineG!.node);
    const g = n.addComponent(Graphics);

    (
      [
        [11, 255, 70, 96, 90],
        [6, 255, 255, 255, 245],
      ] as number[][]
    ).forEach(([r, cr, cg, cb, a]) => {
      g.fillColor = new Color(cr, cg, cb, a);
      g.circle(0, 0, r);
      g.fill();
    });
    n.addComponent(UIOpacity);
    this.candySpark = n;
    return n;
  }

  private candyLinePts: Vec3[][] = [];
  private tickCandyLine = (): void => this.paintCandyLines();

  private showAllPaylines(): void {
    if (this.winLines.length > 0) return;
    const all = PAYLINES.map((_, i) => ({ lineIndex: i, count: GRID.reels }));
    if (VIEW_CONFIG.win.beams.enabled) this.showWinBeams(all);
    this.drawCandyWinLines(all);
    this.unschedule(this.hidePaylines);
    this.scheduleOnce(this.hidePaylines, 1.0);
  }

  private hidePaylines = (): void => {
    if (this.winLines.length > 0) return;
    this.unschedule(this.tickCandyLine);
    this.candyLinePts = [];
    this.winLineG?.clear();
    this.hideWinBeams();
    if (this.candySpark) {
      Tween.stopAllByTarget(this.candySpark);
      this.candySpark.active = false;
    }
  };

  private drawCandyWinLines(lines: { lineIndex: number; count: number }[]): void {
    const g = this.winLineG;
    if (!g) return;
    this.candyLinePts = [];
    let longest: Vec3[] = [];
    for (const { lineIndex, count } of lines) {
      const rows = PAYLINES[lineIndex];
      if (!rows) continue;
      const pts: Vec3[] = [];
      for (let reel = 0; reel < count; reel++) pts.push(this.cellCenter(reel, rows[reel]));
      if (pts.length < 2) continue;
      this.candyLinePts.push(pts);
      if (pts.length > longest.length) longest = pts;
    }
    this.paintCandyLines();
    if (!this.reducedFx) {
      this.unschedule(this.tickCandyLine);
      this.schedule(this.tickCandyLine, 0);
    }

    const op = g.node.getComponent(UIOpacity) ?? g.node.addComponent(UIOpacity);
    Tween.stopAllByTarget(op);
    op.opacity = 0;
    tween(op).to(0.18, { opacity: 255 }, { easing: 'quadOut' }).start();

    if (longest.length >= 2 && !this.reducedFx) {
      const spark = this.ensureCandySpark();
      spark.active = true;
      spark.setPosition(longest[0]);
      const sop = spark.getComponent(UIOpacity)!;
      Tween.stopAllByTarget(spark);
      Tween.stopAllByTarget(sop);
      sop.opacity = 255;
      let chain = tween(spark);
      for (let i = 1; i < longest.length; i++) {
        chain = chain.to(0.085, { position: longest[i] }, { easing: 'sineInOut' });
      }
      chain.call(() => tween(sop).to(0.2, { opacity: 0 }, { easing: 'quadIn' }).start()).start();
    }
  }

  private paintCandyLines(): void {
    const g = this.winLineG;
    if (!g) return;
    g.clear();
    const RED = new Color(255, 58, 74, 242);
    const SMOKE = new Color(247, 247, 250, 250);
    const DASH = 12;
    const t = this.reducedFx ? 0 : this.uTime;
    const phase = (t * 46) % (DASH * 2);

    const pulse = this.reducedFx ? 1 : 1 + 0.16 * Math.sin(t * 3.0);
    const stroke = (
      pts: Vec3[],
      cr: number,
      cg: number,
      cb: number,
      ca: number,
      w: number,
    ): void => {
      g.lineWidth = w;
      g.strokeColor = new Color(cr, cg, cb, Math.max(0, Math.min(255, Math.round(ca))));
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.stroke();
    };
    for (const pts of this.candyLinePts) {
      stroke(pts, 255, 56, 92, 16 * pulse, 32 * pulse);
      stroke(pts, 255, 76, 110, 28 * pulse, 22 * pulse);
      stroke(pts, 255, 112, 142, 52, 14);
      stroke(pts, 255, 172, 198, 94, 8);

      let accum = 0;
      for (let i = 1; i < pts.length; i++) {
        const ax = pts[i - 1].x,
          ay = pts[i - 1].y;
        const dx = pts[i].x - ax,
          dy = pts[i].y - ay;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len,
          uy = dy / len;
        let d = 0;
        while (d < len) {
          const s1 = Math.min(len, d + DASH);
          g.lineWidth = 5.5;
          g.strokeColor = Math.floor((accum + d + phase) / DASH) % 2 === 0 ? RED : SMOKE;
          g.moveTo(ax + ux * d, ay + uy * d);
          g.lineTo(ax + ux * s1, ay + uy * s1);
          g.stroke();
          d += DASH;
        }
        accum += len;
      }

      stroke(pts, 255, 252, 250, 170 + 50 * (pulse - 1) * 6, 1.9);
    }
  }

  clearWins(): void {
    this.unschedule(this.cycleWinLine);
    this.unschedule(this.tickReveal);
    this.unschedule(this.tickSymbolWin);
    if (this.winSpark) this.winSpark.active = false;

    if (this.plasmaCore) this.plasmaCore.active = false;
    if (this.winLineGlow) this.winLineGlowSegs.forEach((s) => (s.active = false));
    this.lastSparkPtIdx = -1;
    this.hideWinFlames();
    this.hideWinBeams();
    this.stopWinLinePulse();

    this.lineWinPops.forEach((n) => {
      if (!n.isValid) return;
      Tween.stopAllByTarget(n);
      const op = n.getComponent(UIOpacity);
      if (op) Tween.stopAllByTarget(op);
      n.destroy();
    });
    this.lineWinPops.length = 0;
    this.winLines = [];
    this.unschedule(this.tickCandyLine);
    this.candyLinePts = [];
    this.winLineG?.clear();

    if (this.candySpark) {
      Tween.stopAllByTarget(this.candySpark);
      this.candySpark.active = false;
    }
    if (this.winLineG) {
      const op = this.winLineG.node.getComponent(UIOpacity);
      if (op) {
        Tween.stopAllByTarget(op);
        op.opacity = 255;
      }
    }
    this.reels.forEach((reel) => reel.clearHighlight());
  }

  private showLineWinPops(result: SpinResult): void {
    for (const w of result.lineWins) {
      if (w.payout <= 0) continue;
      const rows = PAYLINES[w.lineIndex];
      const lastReel = Math.min(w.count - 1, rows.length - 1);
      if (lastReel < 0) continue;
      const at = this.cellCenter(lastReel, rows[lastReel]);
      const hue = LINE_HUES[w.lineIndex % LINE_HUES.length];
      const node = this.mkLabel(`×${w.payout}`, at.x, at.y + 6, 26, hue, this.node, true).node;
      this.lineWinPops.push(node);
      const op = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
      const done = () => {
        const i = this.lineWinPops.indexOf(node);
        if (i >= 0) this.lineWinPops.splice(i, 1);
        if (node.isValid) node.destroy();
      };
      if (this.reducedFx) {
        op.opacity = 255;
        tween(op).delay(0.7).to(0.3, { opacity: 0 }).call(done).start();
      } else {
        op.opacity = 0;
        node.setScale(0.6, 0.6, 1);
        tween(node)
          .to(
            0.16,
            { scale: new Vec3(1.12, 1.12, 1), position: new Vec3(at.x, at.y + 26, 0) },
            { easing: 'backOut' },
          )
          .to(
            0.74,
            { scale: new Vec3(1, 1, 1), position: new Vec3(at.x, at.y + 72, 0) },
            { easing: 'quadOut' },
          )
          .start();
        tween(op).to(0.16, { opacity: 255 }).delay(0.5).to(0.4, { opacity: 0 }).call(done).start();
      }
    }
  }

  private symWinT = 0;
  private tickSymbolWin = (dt: number): void => {
    this.symWinT += dt;
    for (const key of ['symbol-win', 'soft-burst', 'win-beam']) {
      const m = this.effectMaterials[key];
      if (m) m.setProperty('u_time', this.symWinT);
    }
  };

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
      this.lastSparkPtIdx = -1;
      this.audio.countTick(0.5);
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

    if (this.winLineGlow) this.winLineGlowSegs.forEach((s) => (s.active = false));
    const cur = this.winLines[this.revealIdx];
    if (cur) {
      const pts = this.linePts(cur);
      const drawn: Vec3[] = [];
      const head = this.polyAt(pts, this.revealP, drawn);
      this.strokeLine(drawn, true, LINE_HUES[cur.lineIndex % LINE_HUES.length]);

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

      if (this.plasmaCore) {
        this.plasmaCore.active = true;
        this.plasmaCore.setPosition(head.x, head.y, 0);
        if (this.winSpark) this.winSpark.active = false;
      } else if (this.winSpark) {
        this.winSpark.active = true;
        this.winSpark.setPosition(head.x, head.y, 0);
      }

      const newIdx = drawn.length - 1;
      if (newIdx > this.lastSparkPtIdx) {
        const pt = drawn[newIdx];
        if (pt && this.particles && !this.reducedFx) {
          this.particles.sparkCascade(pt.x, pt.y);
        }

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
      this.lastSparkPtIdx = -1;
    }
  }

  pulseSticky(
    positions: Array<[number, number]>,
    mode: 'idle' | 'wilds' | 'crowns' | 'reels' = this.lastBonusMode,
  ): void {
    if (!positions || positions.length === 0) return;

    const lock =
      mode === 'crowns'
        ? { peak: 1.1, glowPeak: 210 }
        : mode === 'reels'
          ? { peak: 1.24, glowPeak: 150 }
          : { peak: 1.16, glowPeak: 175 };
    const byReel: number[][] = this.reels.map(() => []);
    for (const [reel, row] of positions) if (byReel[reel]) byReel[reel].push(row);
    this.reels.forEach((reel, i) => {
      if (byReel[i].length) reel.bounceSticky(byReel[i], lock);
    });
  }

  private winCountTo = 0;
  private winCountDur = 1;
  private winCountElapsed = 0;
  private winCountLastTick = 0;

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

  playCeremony(winCents: number, betCents: number, multiplier: number): boolean {
    this.ceremony.onDetonate = () => {
      if (!this.reducedFx) {
        this.audio.impact();

        const mult = betCents > 0 ? winCents / betCents : 0;
        this.cinematicBloom(Math.min(1, mult / 100));
      }
    };
    this.ceremony.onCountPip = () => this.audio.countTick(0.6);

    this.ceremony.onCoinGeyser = () => {
      if (!this.reducedFx) this.particles.coinGeyser();
    };
    // Candy wipe as the big-win ceremony settles back to the base game.
    this.ceremony.onDismiss = () => this.wipe('win', -1, 0.8);
    return this.ceremony.show(winCents, betCents, multiplier, this.reducedFx);
  }

  showFeatureUnlocked(name: string, mode?: 'wilds' | 'crowns' | 'reels'): void {
    this.ceremony.showFeatureUnlocked(name, mode);
  }

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

  // ?debug HUD line for the adaptive VFX governor (approval #41): "58fps vfx 92% 37/96".
  vfxHud(): string {
    return formatVfxHud(this.particles.vfxStats());
  }

  private cellCenter(reel: number, row: number): Vec3 {
    const { cell, reelCenterY } = VIEW_CONFIG.layout;
    return new Vec3(
      -this.gw / 2 + cell / 2 + reel * this.pitch,
      reelCenterY + (1 - row) * this.pitch,
      0,
    );
  }

  private linePts(w: { lineIndex: number; count: number }): Vec3[] {
    const rows = PAYLINES[w.lineIndex];
    const pts: Vec3[] = [];
    for (let reel = 0; reel < w.count; reel++) pts.push(this.cellCenter(reel, rows[reel]));
    return pts;
  }

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

  private strokeLine(pts: Vec3[], bright: boolean, color: Color): void {
    const g = this.winLineG;
    if (!g || pts.length < 2) return;
    const path = () => {
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    };

    g.lineWidth = bright ? 5 : 3;
    g.strokeColor = new Color(0, 0, 0, bright ? 90 : 50);
    path();
    g.stroke();

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
