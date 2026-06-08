import { Application, Container, Graphics, Text } from 'pixi.js';
import gsap from 'gsap';
import {
  createRng,
  spin as engineSpin,
  evaluateSpin,
  classifyWinTier,
  winningCellsByReel,
} from '@artest/math-core';
import type { Rng, GameEvent } from '@artest/math-core';
import { createLocalSource, HttpRgs } from '@artest/stake-adapter';
import type { OutcomeSource, RoundOutcome } from '@artest/stake-adapter';
import { SLOT_CONFIG as CFG, BUY, SYMBOL_STYLE, THEME } from './config';
import { I18n } from './i18n';

const TITLE = 'STAR STRIKE';
const DESIGN = { w: 1280, h: 720 };
const CELL = 96;
const GAP = 8;
const PITCH = CELL + GAP;
const GW = CFG.reels * CELL + (CFG.reels - 1) * GAP;
const GH = CFG.rows * CELL + (CFG.rows - 1) * GAP;
const REEL_CY = -20;
const SPIN_BUFFER = 12;
const SYM_COUNT = Object.keys(SYMBOL_STYLE).length;

/** Trapezoidal velocity reel ease (matches the Cocos game's curve). */
function reelEase(t: number): number {
  const a = 0.16;
  const b = 0.36;
  const area = 1 - a / 2 - b / 2;
  let d: number;
  if (t < a) d = (t * t) / (2 * a);
  else if (t <= 1 - b) d = a / 2 + (t - a);
  else {
    const td = t - (1 - b);
    d = a / 2 + (1 - b - a) + (td - (td * td) / (2 * b));
  }
  return d / area;
}

class SymbolCell {
  readonly view = new Container();
  private bg = new Graphics();
  private label: Text;

  constructor() {
    this.view.addChild(this.bg);
    this.label = new Text({
      text: '',
      style: {
        fontFamily: 'monospace',
        fontSize: 34,
        fontWeight: 'bold',
        fill: 0xffffff,
        align: 'center',
      },
    });
    this.label.anchor.set(0.5);
    this.view.addChild(this.label);
  }

  set(id: number): void {
    const s = SYMBOL_STYLE[id] ?? { glyph: String(id), color: 0xffffff };
    const r = CELL / 2 - 4;
    this.bg.clear();
    this.bg.roundRect(-r, -r, r * 2, r * 2, 12).fill({ color: THEME.ink });
    this.bg.roundRect(-r, -r, r * 2, r * 2, 12).stroke({ width: 3, color: s.color, alpha: 0.9 });
    this.bg
      .roundRect(-r + 8, -r + 8, r * 2 - 16, r * 2 - 16, 8)
      .fill({ color: s.color, alpha: 0.14 });
    this.label.text = s.glyph;
    this.label.style.fill = s.color;
    this.label.style.fontSize = s.glyph.length > 2 ? 22 : 34;
    this.view.scale.set(1);
  }

  pulse(): void {
    gsap.killTweensOf(this.view.scale);
    this.view.scale.set(1);
    gsap.to(this.view.scale, {
      x: 1.18,
      y: 1.18,
      duration: 0.18,
      yoyo: true,
      repeat: 3,
      ease: 'power2.out',
    });
  }

  land(): void {
    gsap.killTweensOf(this.view.scale);
    this.view.scale.set(1);
    gsap.fromTo(
      this.view.scale,
      { x: 1.12, y: 0.9 },
      { x: 1, y: 1, duration: 0.18, ease: 'back.out(2)' },
    );
  }

  clear(): void {
    gsap.killTweensOf(this.view.scale);
    this.view.scale.set(1);
  }
}

class Reel {
  readonly container = new Container();
  private strip = new Container();
  private cells: SymbolCell[] = [];
  private window: SymbolCell[] = [];
  private startY = SPIN_BUFFER * PITCH;
  private settle: (() => void) | null = null;

  constructor(parent: Container, x: number) {
    this.container.position.set(x, REEL_CY);
    parent.addChild(this.container);

    const mask = new Graphics();
    mask.rect(-CELL / 2, -GH / 2, CELL, GH).fill({ color: 0xffffff });
    this.container.addChild(mask);
    this.container.addChild(this.strip);
    this.strip.mask = mask;

    const len = CFG.rows + SPIN_BUFFER;
    for (let k = 0; k < len; k++) {
      const c = new SymbolCell();
      c.view.position.set(0, (k - 1) * PITCH); // k=0 top(-pitch), 1 mid(0), 2 bottom(+pitch)
      this.strip.addChild(c.view);
      this.cells.push(c);
    }
    this.window = [this.cells[0], this.cells[1], this.cells[2]];
  }

  show(column: number[]): void {
    this.window.forEach((c, row) => c.set(column[row]));
  }

  spinTo(final: number[], seconds: number, speedMul: number): Promise<void> {
    for (let k = 0; k < this.cells.length; k++) {
      this.cells[k].set(k < CFG.rows ? final[k] : Math.floor(Math.random() * SYM_COUNT));
    }
    return new Promise<void>((resolve) => {
      this.settle = () => {
        if (!this.settle) return;
        this.settle = null;
        gsap.killTweensOf(this.strip);
        this.strip.y = 0;
        this.window.forEach((c) => c.land());
        resolve();
      };
      this.strip.y = -this.startY;
      gsap.to(this.strip, {
        y: 0,
        duration: seconds * speedMul,
        ease: reelEase,
        onComplete: () => this.settle?.(),
      });
    });
  }

  quickStop(): void {
    this.settle?.();
  }

  get spinning(): boolean {
    return this.settle !== null;
  }

  highlight(rows: number[]): void {
    rows.forEach((row) => this.window[row]?.pulse());
  }

  clearHighlight(): void {
    this.window.forEach((c) => c.clear());
  }
}

export class Game {
  readonly app = new Application();
  private world = new Container();
  private rng!: Rng;
  private i18n!: I18n;
  private rgs!: OutcomeSource;
  private replay = false;

  private reels: Reel[] = [];
  private winLineG = new Graphics();
  private balanceText!: Text;
  private betText!: Text;
  private winText!: Text;
  private bannerText!: Text;
  private spinBtn!: Container;
  private spinLabel!: Text;

  private balance = 1000;
  private bet = 1;
  private state: 'idle' | 'spinning' | 'resolving' | 'bonus' = 'idle';
  private canStop = false;
  private turbo = false;
  private muted = false;
  private winCycle: ReturnType<typeof setInterval> | null = null;

  async boot(mount: HTMLElement): Promise<void> {
    const params = new URLSearchParams(location.search);
    this.i18n = new I18n(params);
    const seed =
      (params.get('seed')
        ? Number(params.get('seed'))
        : (Date.now() ^ (Math.random() * 1e9)) | 0) >>> 0;
    this.rng = createRng(seed);

    if (params.get('debug') !== 'true') {
      // Stake: production console must be silent.
      const noop = () => undefined;
      console.log = noop;
      console.info = noop;
      console.warn = noop;
    }

    await this.app.init({
      background: THEME.bg,
      antialias: true,
      resizeTo: window,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    mount.appendChild(this.app.canvas);
    this.app.stage.addChild(this.world);

    this.build();
    this.layout();
    window.addEventListener('resize', () => this.layout());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') this.onSpinPressed();
    });

    // Outcome source: a real RGS when the platform passes ?rgs_url, else an
    // in-memory book sampler for dev. The game only PLAYS BACK what it returns.
    const rgsUrl = params.get('rgs_url');
    if (rgsUrl) {
      const http = new HttpRgs(rgsUrl, 'star-strike', params.get('currency') ?? 'USD');
      await http.authenticate();
      this.rgs = http;
    } else {
      this.rgs = createLocalSource(CFG, [
        { mode: 'base', count: 4000, seed: seed ^ 0x55 },
        { mode: 'buy', count: 2500, seed: seed ^ 0xaa, forceFreeSpins: BUY.startSpins },
      ]);
    }

    this.renderGrid(engineSpin(createRng(7), CFG).grid);
    this.setBalance();
    this.setBet();

    if (params.get('debug') === 'true' || location.hostname === 'localhost') {
      (globalThis as unknown as { __game?: Game }).__game = this;
    }

    this.replay = params.get('replay') === 'true';
    if (this.replay) void this.runReplay(params);
  }

  // ---- build ----------------------------------------------------------------
  private build(): void {
    this.buildBackground();
    this.buildTitle();
    this.buildFrame();
    for (let r = 0; r < CFG.reels; r++) {
      this.reels[r] = new Reel(this.world, -GW / 2 + CELL / 2 + r * PITCH);
    }
    this.world.addChild(this.winLineG);
    this.buildHud();
    this.buildControls();
    this.bannerText = this.text('', 0, -250, 34, THEME.acid);
    this.world.addChild(this.bannerText);
  }

  private buildBackground(): void {
    const g = new Graphics();
    g.rect(-1300, -1100, 2600, 2200).fill({ color: THEME.bg });
    for (let i = 56; i > 0; i--) {
      const t = i / 56;
      g.ellipse(0, REEL_CY, 560 * t, 420 * t).fill({ color: THEME.acid, alpha: 0.004 });
    }
    this.world.addChild(g);
  }

  private buildTitle(): void {
    this.world.addChild(this.text(TITLE, 0, -300, 44, THEME.acid));
    this.world.addChild(this.text('5 REELS · 10 LINES · FREE SPINS', 0, -262, 14, THEME.muted));
  }

  private buildFrame(): void {
    const w = GW + 24;
    const h = GH + 24;
    const g = new Graphics();
    g.position.set(0, REEL_CY);
    g.roundRect(-w / 2, -h / 2, w, h, 12).fill({ color: THEME.ink });
    g.roundRect(-w / 2, -h / 2, w, h, 12).stroke({ width: 4, color: THEME.acid });
    for (let r = 1; r < CFG.reels; r++) {
      const x = -GW / 2 + r * PITCH - GAP / 2;
      g.moveTo(x, -GH / 2 + 6)
        .lineTo(x, GH / 2 - 6)
        .stroke({ width: 2, color: THEME.acid, alpha: 0.12 });
    }
    this.world.addChild(g);
  }

  private buildHud(): void {
    this.plate(0, 200, 660, 70);
    this.world.addChild(this.text(this.i18n.t('balance'), -220, 184, 13, THEME.muted));
    this.balanceText = this.text('', -220, 212, 26, THEME.white);
    this.world.addChild(this.balanceText);
    this.world.addChild(this.text(`${this.i18n.t('bet')} (10)`, 0, 184, 13, THEME.muted));
    this.betText = this.text('', 0, 212, 26, THEME.muted);
    this.world.addChild(this.betText);
    this.world.addChild(this.text(this.i18n.t('win'), 220, 184, 13, THEME.muted));
    this.winText = this.text('', 220, 212, 26, THEME.acid);
    this.world.addChild(this.winText);
  }

  private buildControls(): void {
    this.textButton(this.i18n.t('buy'), -250, 300, 110, 50, () => void this.onBuy());
    this.textButton(this.i18n.t('turbo'), -120, 300, 90, 44, () => this.toggleTurbo());
    this.textButton(this.i18n.t('auto'), 120, 300, 90, 44, () => undefined);
    this.textButton(this.i18n.t('sound'), 250, 300, 110, 50, () => this.toggleSound());

    const n = new Container();
    n.position.set(0, 300);
    const g = new Graphics();
    g.circle(0, 0, 56).fill({ color: THEME.acid });
    n.addChild(g);
    this.spinLabel = this.text(this.i18n.t('spin'), 0, 0, 24, THEME.ink);
    n.addChild(this.spinLabel);
    n.eventMode = 'static';
    n.cursor = 'pointer';
    n.on('pointertap', () => this.onSpinPressed());
    this.world.addChild(n);
    this.spinBtn = n;
  }

  // ---- helpers --------------------------------------------------------------
  private text(t: string, x: number, y: number, size: number, fill: number): Text {
    const txt = new Text({
      text: t,
      style: { fontFamily: 'monospace', fontSize: size, fontWeight: 'bold', fill, align: 'center' },
    });
    txt.anchor.set(0.5);
    txt.position.set(x, y);
    return txt;
  }

  private plate(x: number, y: number, w: number, h: number): void {
    const g = new Graphics();
    g.position.set(x, y);
    g.roundRect(-w / 2, -h / 2, w, h, 14).fill({ color: THEME.plate });
    g.roundRect(-w / 2, -h / 2, w, h, 14).stroke({ width: 2, color: THEME.plateEdge });
    this.world.addChild(g);
  }

  private textButton(
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    cb: () => void,
  ): Text {
    const n = new Container();
    n.position.set(x, y);
    const g = new Graphics();
    g.roundRect(-w / 2, -h / 2, w, h, 10).fill({ color: THEME.plate });
    g.roundRect(-w / 2, -h / 2, w, h, 10).stroke({ width: 2, color: THEME.acid });
    n.addChild(g);
    const t = this.text(label, 0, 0, Math.min(16, h * 0.32), THEME.white);
    n.addChild(t);
    n.eventMode = 'static';
    n.cursor = 'pointer';
    n.on('pointertap', cb);
    n.on('pointerdown', () => n.scale.set(0.94));
    n.on('pointerup', () => n.scale.set(1));
    n.on('pointerupoutside', () => n.scale.set(1));
    this.world.addChild(n);
    return t;
  }

  private layout(): void {
    const s = Math.min(window.innerWidth / DESIGN.w, window.innerHeight / DESIGN.h);
    this.world.scale.set(s);
    this.world.position.set(window.innerWidth / 2, window.innerHeight / 2);
  }

  // ---- HUD updates ----------------------------------------------------------
  private setBalance(): void {
    this.balanceText.text = this.i18n.money(this.balance);
  }
  private setBet(): void {
    this.betText.text = this.i18n.money(this.bet);
  }
  private setWin(units: number): void {
    this.winText.text = this.i18n.money(units);
  }
  private setBanner(t: string): void {
    this.bannerText.text = t;
    if (t) {
      gsap.killTweensOf(this.bannerText.scale);
      this.bannerText.scale.set(0.6);
      gsap.to(this.bannerText.scale, { x: 1, y: 1, duration: 0.25, ease: 'back.out(2)' });
    }
  }

  private renderGrid(grid: number[][]): void {
    this.reels.forEach((reel, i) => reel.show(grid[i]));
  }

  // ---- flow -----------------------------------------------------------------
  private onSpinPressed(): void {
    if (this.replay) return;
    if (this.state === 'spinning') {
      if (this.canStop) this.reels.forEach((r) => r.quickStop());
      return;
    }
    if (this.state !== 'idle' || this.balance < this.bet) return;
    void this.runSpin();
  }

  private async runSpin(): Promise<void> {
    this.state = 'spinning';
    this.clearWins();
    this.setWin(0);
    this.setBanner('');
    this.balance -= this.bet;
    this.setBalance();
    this.canStop = false;
    setTimeout(() => (this.canStop = true), 180);

    const round = await this.rgs.play('base'); // server decides; the client only plays it back
    await this.playRound(round);
    await this.rgs.endRound(); // after the celebration completes
    this.state = 'idle';
  }

  private async playSpin(grid: number[][], speedMul = 1): Promise<void> {
    const base = (this.turbo ? 0.4 : 1) * speedMul;
    await Promise.all(this.reels.map((reel, i) => reel.spinTo(grid[i], 0.65 + i * 0.15, base)));
  }

  /**
   * Play back a server-decided round's events. The credited total comes from the
   * book (setTotalWin) — the client never recomputes a payout. Returns win units.
   */
  private async playRound(round: RoundOutcome): Promise<number> {
    let total = 0;
    for (const ev of round.events) {
      if (ev.type === 'reveal') {
        await this.playSpin(ev.board);
        this.state = 'resolving';
      } else if (ev.type === 'winInfo') {
        this.presentBaseWin(ev);
      } else if (ev.type === 'freeSpins') {
        this.state = 'bonus';
        this.setBanner(`${this.i18n.t('freeSpins')} ×${ev.steps.length}`);
        for (const step of ev.steps) {
          this.clearWins();
          await this.playSpin(step.board, 0.5);
          const r = evaluateSpin(step.board, CFG); // display-only highlight, not payout
          if (r.lineWins.length) {
            const cells = winningCellsByReel(r, CFG);
            this.reels.forEach((reel, i) => reel.highlight(cells[i] ?? []));
            this.drawLinesFromList(r.lineWins);
          }
          await this.wait(160);
        }
      } else if (ev.type === 'setTotalWin') {
        total = (ev.amountX100 / 100) * this.bet;
        if (total > 0) {
          this.countUp(total);
          this.ceremony(total);
        }
      }
    }
    this.balance += total;
    this.setBalance();
    if (total > 0) this.setWin(total);
    return total;
  }

  private presentBaseWin(ev: Extract<GameEvent, { type: 'winInfo' }>): void {
    ev.cellsByReel.forEach((rows, i) => this.reels[i]?.highlight(rows));
    this.drawLinesFromList(ev.wins);
  }

  // ---- win presentation -----------------------------------------------------
  private countUp(toUnits: number): void {
    const proxy = { v: 0 };
    gsap.to(proxy, {
      v: toUnits,
      duration: Math.min(3, 0.6 + Math.log10(toUnits + 1) * 0.4),
      ease: 'power1.out',
      onUpdate: () => this.setWin(proxy.v),
    });
  }

  private ceremony(units: number): void {
    const multiple = units / this.bet;
    const tier = classifyWinTier(multiple);
    if (tier === 'big' || tier === 'mega' || tier === 'epic') {
      const label =
        tier === 'epic'
          ? this.i18n.t('epicWin')
          : tier === 'mega'
            ? this.i18n.t('megaWin')
            : this.i18n.t('bigWin');
      this.setBanner(label);
      this.shake(tier === 'epic' ? 16 : tier === 'mega' ? 11 : 7);
    }
  }

  private shake(amp: number): void {
    const base = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    gsap.killTweensOf(this.world);
    gsap.to(this.world, {
      x: base.x + amp,
      duration: 0.04,
      yoyo: true,
      repeat: 7,
      ease: 'none',
      onComplete: () => this.world.position.set(base.x, base.y),
    });
  }

  private drawLinesFromList(lines: { lineIndex: number; count: number }[]): void {
    const g = this.winLineG;
    let i = 0;
    const draw = () => {
      g.clear();
      for (const w of lines) this.strokeLine(w, false);
      if (lines.length) this.strokeLine(lines[i % lines.length], true);
      i++;
    };
    draw();
    if (this.winCycle) clearInterval(this.winCycle);
    this.winCycle = setInterval(draw, 850);
  }

  private strokeLine(w: { lineIndex: number; count: number }, bright: boolean): void {
    const rows = CFG.paylines[w.lineIndex];
    const g = this.winLineG;
    const pts: { x: number; y: number }[] = [];
    for (let reel = 0; reel < w.count; reel++) {
      pts.push({ x: -GW / 2 + CELL / 2 + reel * PITCH, y: REEL_CY + (rows[reel] - 1) * PITCH });
    }
    g.moveTo(pts[0].x, pts[0].y);
    for (let k = 1; k < pts.length; k++) g.lineTo(pts[k].x, pts[k].y);
    g.stroke({
      width: bright ? 6 : 4,
      color: THEME.acid,
      alpha: bright ? 1 : 0.4,
      cap: 'round',
      join: 'round',
    });
  }

  private clearWins(): void {
    if (this.winCycle) {
      clearInterval(this.winCycle);
      this.winCycle = null;
    }
    this.winLineG.clear();
    this.reels.forEach((r) => r.clearHighlight());
  }

  // ---- controls -------------------------------------------------------------
  private toggleTurbo(): void {
    if (this.replay) return;
    this.turbo = !this.turbo;
  }
  private toggleSound(): void {
    if (this.replay) return;
    this.muted = !this.muted;
  }

  private async onBuy(): Promise<void> {
    const cost = this.bet * BUY.costMultiple;
    if (this.replay || this.state !== 'idle' || this.balance < cost) return;
    this.state = 'bonus';
    this.balance -= cost;
    this.setBalance();
    this.clearWins();
    this.setWin(0);
    this.setBanner(this.i18n.t('buy'));
    const round = await this.rgs.play('buy'); // server-decided buy round
    await this.playRound(round);
    await this.rgs.endRound();
    this.state = 'idle';
  }

  // ---- bet replay (mandatory for approval) ----------------------------------
  /**
   * Plays one round back with ALL controls locked + a disclosure bar, and never
   * changes the balance. Dev uses the local source; production would fetch the
   * shareable /bet/replay book. ?replay=true[&mode=base|buy].
   */
  private async runReplay(params: URLSearchParams): Promise<void> {
    const mode = params.get('mode') ?? 'base';
    const round = await this.rgs.play(mode);
    this.showDisclosure(mode, round.payoutMultiplier / 100);
    const before = this.balance;
    await this.playRound(round);
    this.balance = before; // a replay must not affect balance
    this.setBalance();
    this.state = 'idle';
    this.textButton('PLAY AGAIN', 0, 300, 170, 50, () => void this.runReplay(params));
  }

  private showDisclosure(mode: string, payoutX: number): void {
    const cost = mode === 'buy' ? BUY.costMultiple : 1;
    this.plate(0, 340, 1100, 36);
    this.world.addChild(
      this.text(
        `REPLAY · ${this.i18n.t('bet')} ${this.i18n.money(this.bet)} · COST ×${cost} · ${this.i18n.money(
          this.bet * cost,
        )} · PAYOUT ×${payoutX.toFixed(2)} · ${this.i18n.t('win')} ${this.i18n.money(this.bet * payoutX)}`,
        0,
        340,
        13,
        THEME.acid,
      ),
    );
  }

  private wait(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
  }
}
