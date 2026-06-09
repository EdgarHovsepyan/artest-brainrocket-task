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
  UIOpacity,
  UITransform,
  Vec3,
  view,
} from 'cc';
import { GRID, PAYLINES, SYMBOLS } from '../logic/game-config';
import { SpinResult } from '../logic/types';
import { winningCellsByReel } from '../logic/win-cells';
import { VIEW_CONFIG } from './view-config';
import { ReelView } from './reel-view';
import { CeremonyView } from './ceremony-view';
import { AnticipationLayer } from './anticipation-layer';
import { ParticleLayer } from './particle-layer';
import { AudioManager } from './audio-manager';

const { ccclass } = _decorator;

// ---- Palette: SHINING-POP crystal-violet — magenta on deep violet (was acid/black) ----
// Names kept for minimal churn; values repointed to the shining-pop identity (palette.ts).
const ACID = new Color(255, 0, 127, 255); // primary magenta accent (#ff007f)
const INK = new Color(20, 10, 32, 255); // deep violet glass fill (#140a20)
const PLATE = new Color(25, 17, 64, 255); // HUD panel violet (#191140)
const PLATE_EDGE = new Color(184, 111, 218, 255); // orchid rim (#b86fda)
const SHADOW = new Color(5, 2, 12, 170); // obsidian shadow
const MUTED = new Color(201, 206, 216, 255); // white-smoke caption (kill purple text)

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

@ccclass('SlotView')
export class SlotView extends Component {
  private frames: SpriteFrame[] = [];
  private spinFrames: Record<string, SpriteFrame> = {};

  private reels: ReelView[] = [];
  private spinButton: Button | null = null;
  private spinSprite: Sprite | null = null;
  private balanceLabel: Label | null = null;
  private betLabel: Label | null = null;
  private winLabel: Label | null = null;
  private bannerLabel: Label | null = null;
  private winLineG: Graphics | null = null;

  private ceremony!: CeremonyView;
  private anticipation!: AnticipationLayer;
  private particles!: ParticleLayer;
  readonly audio = new AudioManager();

  private turboBtn: DeckButton | null = null;
  private autoBtn: DeckButton | null = null;
  private soundBtn: DeckButton | null = null;
  private buyMenu: Node | null = null;

  private spinCb: (() => void) | null = null;
  private buyCb: ((mode: string) => void) | null = null;
  private turboCb: (() => void) | null = null;
  private autoCb: (() => void) | null = null;
  private soundCb: (() => void) | null = null;

  private gw = 0;
  private gh = 0;
  private pitch = 0;

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
    const jobs: Promise<void>[] = [];
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
    return Promise.all(jobs).then(() => undefined);
  }

  // ---- small node helpers ---------------------------------------------------
  private mkNode(name: string, w: number, h: number, parent: Node): Node {
    const n = new Node(name);
    n.addComponent(UITransform).setContentSize(w, h);
    parent.addChild(n);
    return n;
  }

  private mkLabel(
    text: string,
    x: number,
    y: number,
    size: number,
    col: Color,
    parent = this.node,
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

    // VFX layers above the reels/win-lines
    this.anticipation = this.mkNode('anticipation', 10, 10, this.node).addComponent(
      AnticipationLayer,
    );
    this.particles = this.mkNode('particles', 10, 10, this.node).addComponent(ParticleLayer);

    if (!this.externalControls) {
      this.buildHud();
      this.buildControlDeck();
    }
    this.bannerLabel = this.mkLabel('', 0, 250, 36, ACID);

    // ceremony on top of everything; shakes the whole view node
    this.ceremony = this.mkNode('ceremonyLayer', 10, 10, this.node).addComponent(CeremonyView);
    this.ceremony.build(this.node);

    this.fit();
    view.setResizeCallback(() => this.fit());
  }

  private buildBackground(): void {
    const base = this.mkNode('bg', 2600, 2200, this.node);
    const bg = base.addComponent(Graphics);
    bg.fillColor = new Color(10, 6, 16, 255); // deep violet base (#0a0610)
    bg.rect(-1300, -1100, 2600, 2200);
    bg.fill();

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
  }

  private buildTitle(): void {
    this.mkLabel('SLOT', 0, 332, 40, ACID);
    this.mkLabel('5 REELS · 3 ROWS · 10 LINES · WILD STRIKE', 0, 300, 13, MUTED);
  }

  private buildFrame(): void {
    const { reelCenterY } = VIEW_CONFIG.layout;
    const w = this.gw + 24;
    const h = this.gh + 24;
    const frame = this.mkNode('frame', w, h, this.node);
    frame.setPosition(0, reelCenterY, 0);
    const g = frame.addComponent(Graphics);
    g.lineWidth = 4;
    g.strokeColor = ACID;
    g.fillColor = INK;
    g.roundRect(-w / 2, -h / 2, w, h, 10);
    g.fill();
    g.stroke();

    const sep = this.mkNode('reelSeps', this.gw, this.gh, this.node);
    sep.setPosition(0, reelCenterY, 0);
    const sg = sep.addComponent(Graphics);
    sg.lineWidth = 2;
    sg.strokeColor = new Color(184, 111, 218, 30); // orchid hairline
    for (let r = 1; r < GRID.reels; r++) {
      const x = -this.gw / 2 + r * this.pitch - VIEW_CONFIG.layout.gap / 2;
      sg.moveTo(x, -this.gh / 2 + 6);
      sg.lineTo(x, this.gh / 2 - 6);
    }
    sg.stroke();
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
  private fit(): void {
    const vis = view.getVisibleSize();
    const { designWidth, designHeight } = VIEW_CONFIG.layout;
    const s = Math.min(vis.width / designWidth, vis.height / designHeight);
    this.node.setScale(s, s, 1);
  }

  // ---- buy menu -------------------------------------------------------------
  /** (Re)build the buy-feature menu from the model's modes + costs (hidden until BUY). */
  configureBuyMenu(options: BuyOption[]): void {
    this.buyMenu?.destroy();
    const menu = this.mkNode('buyMenu', 360, 60 + options.length * 64, this.node);
    menu.setPosition(0, VIEW_CONFIG.layout.reelCenterY, 0);
    menu.active = false;
    const bg = menu.addComponent(Graphics);
    const h = 60 + options.length * 64;
    bg.fillColor = new Color(8, 8, 10, 245);
    bg.roundRect(-180, -h / 2, 360, h, 14);
    bg.fill();
    bg.lineWidth = 4;
    bg.strokeColor = ACID;
    bg.roundRect(-180, -h / 2, 360, h, 14);
    bg.stroke();
    this.mkLabel('BUY FEATURE', 0, h / 2 - 28, 22, ACID, menu);
    options.forEach((o, i) => {
      const y = h / 2 - 72 - i * 64;
      const btn = this.mkTextButton(
        `${o.name}   ${o.costText}`,
        0,
        y,
        320,
        50,
        () => {
          menu.active = false;
          this.buyCb?.(o.mode);
        },
        menu,
      );
      void btn;
    });
    this.buyMenu = menu;
  }

  private toggleBuyMenu(): void {
    if (this.buyMenu) this.buyMenu.active = !this.buyMenu.active;
  }

  closeBuyMenu(): void {
    if (this.buyMenu) this.buyMenu.active = false;
  }

  openBuyMenu(): void {
    if (this.buyMenu) this.buyMenu.active = true;
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
    const antic = earlyWilds >= minEarlyWilds;

    this.audio.reelTick();
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
          this.audio.reelStop(i);
          if (i >= 3) this.anticipation.clear();
        });
      }),
    );
    this.anticipation.clear();
  }

  showWins(result: SpinResult): void {
    this.clearWins();
    const byReel = winningCellsByReel(result, GRID.reels);
    this.reels.forEach((reel, i) => reel.highlight(byReel[i] ?? []));

    this.winLines = result.lineWins.map((w) => ({ lineIndex: w.lineIndex, count: w.count }));
    if (this.winLines.length === 0) return;
    this.winCycle = 0;
    this.cycleWinLine();
    this.schedule(this.cycleWinLine, VIEW_CONFIG.win.lineCycleSeconds);
  }

  clearWins(): void {
    this.unschedule(this.cycleWinLine);
    this.winLines = [];
    this.winLineG?.clear();
    this.reels.forEach((reel) => reel.clearHighlight());
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

  /** Kinetic count-up of the win amount, with audio ticks. */
  countUp(toCents: number): void {
    const { baseMs, logScaleMs, maxMs } = VIEW_CONFIG.counter;
    const dur = Math.min(maxMs, baseMs + Math.log10(toCents + 1) * logScaleMs) / 1000;
    const proxy = { v: 0 };
    let lastTick = 0;
    tween(proxy)
      .to(
        dur,
        { v: toCents },
        {
          onUpdate: () => {
            this.setWin(Math.round(proxy.v));
            const p = proxy.v / Math.max(1, toCents);
            if (p - lastTick > 0.12) {
              lastTick = p;
              this.audio.countTick(p);
            }
          },
        },
      )
      .start();
  }

  /** Big-win ceremony (tiered). Returns false for small wins (HUD count-up only). */
  playCeremony(winCents: number, betCents: number, multiplier: number): boolean {
    const shown = this.ceremony.show(winCents, betCents, multiplier);
    if (shown) {
      const tier =
        winCents / Math.max(1, betCents) >= 50 ? 3 : winCents / Math.max(1, betCents) >= 20 ? 2 : 1;
      this.audio.win(tier);
    }
    return shown;
  }

  showFeatureUnlocked(name: string): void {
    this.ceremony.showFeatureUnlocked(name);
    this.audio.win(2);
  }

  /** Shard burst from the winning cells, scaled by win/total-bet multiple. */
  burstParticles(result: SpinResult, multiple: number): void {
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

  private drawWinLine(w: { lineIndex: number; count: number }, bright: boolean): void {
    const g = this.winLineG;
    if (!g) return;
    const rows = PAYLINES[w.lineIndex];
    const pts: Vec3[] = [];
    for (let reel = 0; reel < w.count; reel++) pts.push(this.cellCenter(reel, rows[reel]));
    const stroke = (width: number, c: Color) => {
      g.lineWidth = width;
      g.strokeColor = c;
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.stroke();
    };
    stroke(bright ? 12 : 8, new Color(0, 0, 0, bright ? 210 : 120));
    stroke(bright ? 6 : 4, bright ? ACID : new Color(255, 90, 156, 130)); // magenta win-line
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
