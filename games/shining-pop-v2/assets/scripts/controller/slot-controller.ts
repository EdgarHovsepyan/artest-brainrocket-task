import {
  _decorator,
  Component,
  EventKeyboard,
  game,
  Input,
  input,
  KeyCode,
  Layers,
  Node,
  view,
} from 'cc';
import { SlotModel } from '../model/slot-model';
import { SlotView } from '../view/slot-view';
import { BettingBarMobile } from '../ui/betting-bar';
import { BettingBarWeb } from '../ui/betting-bar-web';
import {
  AUTOPLAY_COUNTS,
  AutoplayState,
  evaluateContinuation,
  idleAutoplay,
  interSpinDelayMs,
  spinStarted,
  startAutoplay,
  stopAutoplay,
} from '../logic/autoplay';
import { BET_LEVELS_CENTS, maxBet, minBet, snapBet, stepBet } from '../logic/bet-levels';
import {
  ackRealityCheck,
  ComplyRules,
  getComply,
  newSession,
  realityCheckDue,
  recordSpin,
  SessionStats,
  sessionNetCents,
} from '../logic/compliance';
import { formatMoney } from '../logic/money';
import { installLifecycle, LifecycleHandle } from './lifecycle';
import {
  BONUS_MODES,
  BONUS_MODES_BY_VALUE,
  BonusMode,
  SCATTER,
  SCATTER_FS_MODE,
  SETTINGS,
} from '../logic/game-config';
import { evaluateSpin } from '../logic/spin-engine';
import { VIEW_CONFIG } from '../view/view-config';

const { ccclass, property } = _decorator;

type FlowState = 'idle' | 'spinning' | 'resolving' | 'bonus';

@ccclass('SlotController')
export class SlotController extends Component {
  @property
  startBalanceCents = 1000_00;

  @property
  betCents = 1_00;

  private model!: SlotModel;
  private view!: SlotView;
  private bar!: BettingBarMobile | BettingBarWeb;
  private barNode: Node | null = null;
  private barIsWeb: boolean | null = null;

  private introActive = true;
  private lifecycle: LifecycleHandle | null = null;
  private comply: ComplyRules = getComply();
  private session: SessionStats = newSession(0);

  private state: FlowState = 'idle';
  private canStop = false;

  private turboMode: 0 | 1 | 2 = 1;
  private reducedFx = false;
  private autoplay: AutoplayState = idleAutoplay();
  private muted = false;

  onLoad(): void {
    // 60fps locked — 120 doubled GPU/thermal load on high-refresh panels for no
    // perceptible gain on a 60Hz-feel slot (SOP §1 thermal gate).
    game.frameRate = 60;
    this.model = new SlotModel({ balanceCents: this.startBalanceCents, betCents: this.betCents });
    this.session = newSession(this.nowMs());
    const viewNode = new Node('SlotView');
    this.node.addChild(viewNode);
    this.view = viewNode.addComponent(SlotView);

    this.view.onOverlay = (open: boolean): void => {
      if (this.barNode && this.barNode.isValid) this.barNode.active = !open;
    };
    void this.boot();
  }

  private async boot(): Promise<void> {
    await this.view.init(true);
    this.view.showGrid(this.model.idleGrid());
    this.view.onBuyClicked((mode) => void this.onBuy(mode as BonusMode));
    this.view.configureBuyMenu(
      BONUS_MODES_BY_VALUE.map((mode) => ({
        mode,
        name: BONUS_MODES[mode].name,
        costText: this.fmt(this.model.bonusCost(mode)),
      })),
    );
    this.view.setBuyBet(this.fmt(this.model.bet));
    this.refreshBuyAffordability();

    this.view.onBuyBetStep((dir) => this.changeBet(dir));
    this.refreshAutoplayPanel();
    this.view.onAutoplayStart((spins) => this.startAuto(spins));
    this.view.onAutoplayOption((key, value) => {
      this.autoplay = { ...this.autoplay, [key]: value };
      this.refreshAutoplayPanel();
      this.view.openAutoplayPanel();
    });
    this.refreshSettingsPanel();
    this.view.onSettingsChange((key, value) => this.applySetting(key, value));
    this.view.configureQuickBetPanel(BET_LEVELS_CENTS, this.model.bet);
    this.view.onBetSelect((cents) => {
      if (this.state !== 'idle' || this.autoplay.active) return;
      this.model.setBet(snapBet(cents));
      this.view.audio.bet();
      this.view.configureQuickBetPanel(BET_LEVELS_CENTS, this.model.bet);
      this.syncHud();
      this.refreshBuyMenu();
    });

    // Honour the OS reduced-motion preference on first load (accessibility / WCAG 2.3.3).
    try {
      if (
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        this.applySetting('reducedFx', true);
      }
    } catch {
      // matchMedia unavailable — ignore.
    }

    this.view.buildIntro(() => {
      this.introActive = false;
      this.view.wipe('intro', 1, 1.15);
      this.view.cinematicBloom(0.72);
      if (this.barNode && this.barNode.isValid) this.barNode.active = true;
      this.view.audio.unlock();
      this.view.audio.playMusic('main_base_loop');
    });

    try {
      (window as unknown as Record<string, boolean>).__shiningPopReady = true;
    } catch {}
    const unlockOnce = () => {
      this.view.audio.unlock();
      this.view.audio.playMusic('main_base_loop');
      window.removeEventListener('pointerdown', unlockOnce, true);
      window.removeEventListener('keydown', unlockOnce, true);
    };
    try {
      window.addEventListener('pointerdown', unlockOnce, { capture: true, once: true });
      window.addEventListener('keydown', unlockOnce, { capture: true, once: true });
    } catch {}

    this.buildBar();

    this.scheduleOnce(() => this.relayerUI(this.node), 0);

    const handleResize = (): void => {
      this.view.refit();
      this.buildBar();
      this.fitBar();
    };
    view.setResizeCallback(handleResize);

    this.lifecycle = installLifecycle({
      onSuspend: () => this.view.audio.suspend(),
      onResume: () => this.view.audio.resume(),
      onResize: handleResize,
      onNetwork: (online) => this.onNetworkChange(online),
    });

    this.view.setInteractable(true);
    input.on(Input.EventType.KEY_DOWN, this.onKey, this);

    try {
      if (typeof location !== 'undefined' && /[?&]debug/.test(location.search)) {
        (window as unknown as Record<string, unknown>).__v2 = {
          view: this.view,
          spin: () => this.onSpinPressed(),
          ceremony: (mult = 25, wild = 1) =>
            this.view.playCeremony(this.model.bet * mult, this.model.bet, wild),
          feature: (name = 'STICKY WILDS') => this.view.showFeatureUnlocked(name),
          buy: (mode: BonusMode = 'reels') => void this.onBuy(mode),
          vfx: () => this.view.vfxHud(),
          auto: (n = 5) => this.startAuto(n), // debug/QA: start autoplay for n spins
          autoStop: () => this.stopAuto(),
          // Force a wild win on the given paylines — debug/QA only (?debug).
          win: (lines: number[] = [0, 1, 2]) => {
            const grid: number[][] = Array.from({ length: 5 }, () => [0, 0, 0]);
            this.view.showGrid(grid);
            this.view.showWins({
              grid,
              lineWins: lines.map((lineIndex) => ({
                lineIndex,
                symbol: 0,
                count: 5,
                payout: this.model.bet,
              })),
              totalPayout: this.model.bet * lines.length,
              scatters: 0,
              scatterPay: 0,
              freeSpins: 0,
            });
          },
        };
      }
    } catch {}
  }

  private buildBar(): void {
    const vs = view.getVisibleSize();
    const wantWeb = vs.width > vs.height * 1.05;
    if (this.barNode && this.barIsWeb === wantWeb) return;
    this.barNode?.destroy();
    const barNode = new Node('BettingBar');
    this.node.addChild(barNode);
    this.bar = wantWeb
      ? barNode.addComponent(BettingBarWeb)
      : barNode.addComponent(BettingBarMobile);
    this.barNode = barNode;
    this.barIsWeb = wantWeb;
    if (this.introActive) barNode.active = false;
    this.bar.on('spin', () => this.onSpinPressed());
    this.bar.on('bet:inc', () => this.changeBet(1));
    this.bar.on('bet:dec', () => this.changeBet(-1));
    this.bar.on('bet:set', (idx: number) => this.setBetTo(BET_LEVELS_CENTS[idx] ?? minBet()));
    this.bar.on('bet:double', () => this.setBetTo(snapBet(this.model.bet * 2)));
    this.bar.on('betmenu', () => this.view.openQuickBetPanel());
    this.bar.on('turbo', () => this.toggleTurbo());
    this.bar.on('autoplay', () => this.toggleAuto());
    this.bar.on('sound', () => this.toggleSound());
    this.bar.on('volume', (v: number) => this.view.setVolume(v));

    this.bar.on('menu', () => {
      if (this.state === 'idle') this.view.openMenuHub();
    });
    this.bar.on('ui:click', () => this.view.audio.click());

    this.bar.on('buy', () => this.view.openBuyMenu());

    this.scheduleOnce(() => {
      this.relayerUI(barNode);
      this.fitBar();

      this.bar.setCurrency('USD');
      this.syncHud();
      this.bar.setLastWin(0);

      this.setTurboMode(this.turboMode);
      this.bar.setSoundOn(!this.muted);
      this.bar.setReducedFx(this.reducedFx);
      this.bar.setAutoplay(this.autoplay.active ? this.autoplay.remaining : null);
      if (this.barIsWeb) {
        (this.bar as BettingBarWeb).setSpinArt(this.view.getBrandFrame('spinArt'));
        this.relayerUI(barNode);
      }
    }, 0);
  }

  private fitBar(): void {
    const vs = view.getVisibleSize();
    const inset = this.barIsWeb
      ? (this.bar as BettingBarWeb).fit(vs.width, vs.height)
      : (this.bar as BettingBarMobile).fit(vs.width, vs.height);
    this.view.setBottomInset(inset);
  }

  private relayerUI(n: Node): void {
    n.layer = Layers.Enum.UI_2D;
    const kids = n.children;
    for (let i = 0; i < kids.length; i++) this.relayerUI(kids[i]);
  }

  private syncHud(): void {
    this.bar.setBalance(this.model.balance / 100);
    this.bar.setBet(this.model.bet / 100);

    this.bar.setSteppers(this.model.bet > minBet(), this.model.bet < maxBet());
    this.bar.setAffordable(this.model.canSpin());
    if (this.barIsWeb) {
      (this.bar as BettingBarWeb).setBetLevels(
        BET_LEVELS_CENTS.slice(),
        BET_LEVELS_CENTS.indexOf(snapBet(this.model.bet)),
        (cents) => formatMoney(cents / 100, 'USD'),
      );
    }
  }

  private setBetTo(cents: number): void {
    if (this.state !== 'idle' || this.autoplay.active) return;
    this.model.setBet(snapBet(cents));
    this.view.audio.bet();
    this.view.configureQuickBetPanel(BET_LEVELS_CENTS, this.model.bet);
    this.syncHud();
    this.refreshBuyMenu();
  }

  private refreshBuyMenu(): void {
    const costs = BONUS_MODES_BY_VALUE.map((m) => this.fmt(this.model.bonusCost(m)));
    this.view.refreshBuyCosts(costs);
    this.view.setBuyBet(this.fmt(this.model.bet));
    this.refreshBuyAffordability();
  }

  private refreshBuyAffordability(): void {
    this.view.setBuyAffordable(
      BONUS_MODES_BY_VALUE.map((m) => this.model.balance >= this.model.bonusCost(m)),
    );
  }

  private nowMs(): number {
    return typeof Date !== 'undefined' ? Date.now() : 0;
  }

  private presentRealityCheck(): void {
    const wasAuto = this.autoplay.active;
    if (wasAuto) this.stopAuto();
    const minutes = Math.floor((this.nowMs() - this.session.startedAtMs) / 60000);
    const net = sessionNetCents(this.session);
    this.view.showRealityCheck(
      {
        minutes,
        spins: this.session.spinsSinceCheck,
        betText: formatMoney(this.session.totalBetCents / 100, 'USD'),
        netText: (net >= 0 ? '+' : '') + formatMoney(net / 100, 'USD'),
      },
      () => {
        this.session = ackRealityCheck(this.session, this.nowMs());
        if (wasAuto && this.state === 'idle' && this.model.canSpin()) {
          this.startAuto(this.autoplay.total || Infinity);
        }
      },
      () => {
        this.session = ackRealityCheck(this.session, this.nowMs());
      },
    );
  }

  private changeBet(dir: number): void {
    if (this.state !== 'idle' || this.autoplay.active) return;
    this.model.setBet(stepBet(this.model.bet, dir > 0 ? 1 : -1));
    this.view.audio.bet();
    this.view.configureQuickBetPanel(BET_LEVELS_CENTS, this.model.bet);
    this.syncHud();
    this.refreshBuyMenu();
  }

  onDestroy(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKey, this);
    this.lifecycle?.dispose();
    this.lifecycle = null;
  }

  private onNetworkChange(online: boolean): void {
    if (online) {
      this.view.dismissError();
      return;
    }
    this.view.showError(
      'Connection lost',
      'Please check your network. The game will resume\nwhen the connection is restored.',
      'RETRY',
      () => {
        if (typeof navigator !== 'undefined' && navigator.onLine) this.view.dismissError();
      },
    );
  }

  private onKey(e: EventKeyboard): void {
    // Ignore shortcuts during the intro splash and while any modal/overlay is open.
    if (this.introActive || this.view.anyOverlayOpen()) return;
    if (e.keyCode === KeyCode.SPACE) this.onSpinPressed();
    else if (e.keyCode === KeyCode.KEY_A) this.toggleAuto();
    else if (e.keyCode === KeyCode.KEY_T) this.toggleTurbo();
    else if (e.keyCode === KeyCode.KEY_M) this.toggleSound();
    else if (e.keyCode === KeyCode.KEY_B) this.view.openBuyMenu();
    else if (e.keyCode === KeyCode.KEY_S) this.view.openSettingsPanel();
    else if (e.keyCode === KeyCode.KEY_I) this.view.openInfoPanel();
  }

  private fmt(cents: number): string {
    return (cents / 100).toFixed(2);
  }

  private toggleTurbo(): void {
    this.setTurboMode(((this.turboMode + 1) % 3) as 0 | 1 | 2);
  }

  private setTurboMode(mode: 0 | 1 | 2): void {
    this.turboMode = mode;
    this.view.setTurboVisual(mode > 0);
    this.bar.setTurbo(mode);
    this.refreshSettingsPanel();
  }

  private turboScalar(): number {
    const t = VIEW_CONFIG.turbo;
    return [t.off, t.turbo, t.max][this.turboMode];
  }

  private turboKey(): 'off' | 'turbo' | 'max' {
    return (['off', 'turbo', 'max'] as const)[this.turboMode];
  }

  private applySetting(key: 'sound' | 'turboMode' | 'reducedFx', value: number | boolean): void {
    if (key === 'sound') {
      this.muted = !value;
      this.view.setMuted(this.muted);
      this.view.setSoundVisual(this.muted);
      this.bar.setSoundOn(!this.muted);
    } else if (key === 'turboMode') {
      this.setTurboMode(value as 0 | 1 | 2);
    } else {
      this.reducedFx = value as boolean;
      this.view.setReducedFx(this.reducedFx);
      this.bar.setReducedFx(this.reducedFx);
    }
    this.refreshSettingsPanel();
    this.view.openSettingsPanel();
  }

  private refreshSettingsPanel(): void {
    this.view.configureSettingsPanel({
      soundOn: !this.muted,
      turboMode: this.turboMode,
      reducedFx: this.reducedFx,
    });
  }

  private toggleSound(): void {
    this.muted = !this.muted;
    this.view.setMuted(this.muted);
    this.view.setSoundVisual(this.muted);
    this.bar.setSoundOn(!this.muted);
  }

  private toggleAuto(): void {
    if (this.autoplay.active) this.stopAuto();
    else this.view.openAutoplayPanel();
  }

  private startAuto(spins: number): void {
    if (this.state !== 'idle') return;
    this.autoplay = startAutoplay(spins, this.autoplay);
    this.view.setAutoVisual(true);
    this.bar.setAutoplay(this.autoplay.remaining);
    this.onSpinPressed(true); // autoplay's first spin (fromAuto bypasses the manual guard)
  }

  private stopAuto(): void {
    this.autoplay = stopAutoplay(this.autoplay);
    this.view.setAutoVisual(false);
    this.bar.setAutoplay(null);
  }

  private refreshAutoplayPanel(): void {
    this.view.configureAutoplayPanel({
      counts: AUTOPLAY_COUNTS,
      allowInfinity: true,
      stopOnFeature: this.autoplay.stopOnFeature,
      stopOnBigWin: this.autoplay.stopOnBigWin,
    });
  }

  private onSpinPressed(fromAuto = false): void {
    if (this.state === 'spinning') {
      if (this.canStop) this.view.quickStopReels();
      return;
    }
    // AUTOPLAY FIX: block a MANUAL press while autoplay is running, but let
    // autoplay's OWN spins through (startAuto + the continuation loop call this
    // with fromAuto=true). Without the exception they hit `autoplay.active` and
    // autoplay never spins at all.
    if (this.state !== 'idle' || (this.autoplay.active && !fromAuto)) return;
    if (!this.model.canSpin()) {
      this.view.showError(
        'Insufficient balance',
        'You don’t have enough balance to spin at this bet.\nLower your bet to keep playing.',
        'OK',
        () => this.view.dismissError(),
      );
      return;
    }
    void this.runSpin();
  }

  private async runSpin(): Promise<void> {
    this.state = 'spinning';
    if (this.autoplay.active) {
      this.autoplay = spinStarted(this.autoplay);
      this.bar.setAutoplay(this.autoplay.remaining);
    }
    this.bar.setSpinning(true);
    this.view.setInteractable(true);
    this.view.clearWins();
    this.view.setWin(0);
    this.view.setBanner('');
    this.view.closeBuyMenu();
    this.view.closeAutoplayPanel();

    this.canStop = false;
    this.scheduleOnce(
      () => (this.canStop = true),
      VIEW_CONFIG.spin.quickStopArmMs[this.turboKey()] / 1000,
    );

    const outcome = this.model.play();
    this.view.setBalance(outcome.balanceCents);
    this.bar.setBalance(outcome.balanceCents / 100);

    await this.view.playSpin(outcome.result.grid, this.turboScalar());

    this.state = 'resolving';
    if (outcome.wildStrike > 1) this.view.setBanner(`WILD ×${outcome.wildStrike}`);

    if (outcome.winCents > 0) {
      this.view.showWins(outcome.result);
      this.view.burstParticles(outcome.result, outcome.winCents / this.model.bet);
      this.view.countUp(outcome.winCents);
      this.view.playCeremony(outcome.winCents, outcome.betCents, outcome.wildStrike);
      this.bar.setLastWin(outcome.winCents / 100);

      if (outcome.winCents > outcome.betCents) {
        const mult = outcome.winCents / outcome.betCents;

        const tier = mult >= 50 ? 5 : mult >= 30 ? 4 : mult >= 10 ? 3 : mult >= 2 ? 2 : 1;
        this.view.audio.win(tier);
      }
    }

    if (outcome.freeSpins) {
      const grid = outcome.result.grid;
      const sc = outcome.result.scatters;
      const cells: Array<{ reel: number; row: number }> = [];
      for (let r = 0; r < grid.length; r++)
        for (let w = 0; w < grid[r]!.length; w++)
          if (grid[r]![w] === SCATTER) cells.push({ reel: r, row: w });
      this.view.presentScatterTrigger(cells, sc);
      await this.wait(1150);
      this.view.wipe('fs', 1, 1.1);
      this.view.clearWins();
      this.view.showFeatureUnlocked('FREE SPINS', SCATTER_FS_MODE, sc);
      this.view.setBanner(`FREE SPINS ×${outcome.result.freeSpins}`);
    }

    this.session = recordSpin(this.session, outcome.betCents, outcome.winCents);

    this.scheduleOnce(() => {
      this.state = 'idle';
      this.bar.setSpinning(false);
      this.bar.setAffordable(this.model.canSpin());
      this.bar.setSteppers(this.model.bet > 100, this.model.bet < 1000);
      this.view.setInteractable(true);

      if (this.barNode?.isValid) this.barNode.active = !this.view.anyOverlayOpen();
      this.refreshBuyAffordability();

      if (realityCheckDue(this.session, this.comply, this.nowMs())) {
        this.presentRealityCheck();
        return;
      }
      if (this.autoplay.active) {
        const verdict = evaluateContinuation(this.autoplay, {
          isFeature: outcome.freeSpins != null,
          winCents: outcome.winCents,
          betCents: outcome.betCents,
          balanceCents: this.model.balance,
        });
        if (verdict.stop) this.stopAuto();
        else {
          const d = interSpinDelayMs(this.turboMode);
          this.scheduleOnce(() => {
            if (this.autoplay.active && this.state === 'idle') this.onSpinPressed(true); // autoplay continuation
          }, d / 1000);
        }
      }
    }, VIEW_CONFIG.spin.settleMs[this.turboKey()] / 1000);
  }

  private async onBuy(mode: BonusMode): Promise<void> {
    if (this.state !== 'idle' || this.autoplay.active) return;
    if (this.model.balance < this.model.bonusCost(mode)) {
      this.view.showError(
        'Insufficient balance',
        'This bonus costs more than your current balance.\nLower your bet or pick a smaller bonus.',
        'OK',
        () => this.view.dismissError(),
      );
      return;
    }
    this.state = 'bonus';
    this.bar.setSpinning(true);
    this.view.setInteractable(false);
    this.view.setBuyFabVisible(false);
    this.view.clearWins();
    this.view.setWin(0);
    this.view.setBanner(BONUS_MODES[mode].name);

    this.view.wipe('bonus', 1, 1.1);
    this.view.showFeatureUnlocked(BONUS_MODES[mode].name, mode);
    this.view.setBonusAtmosphere(mode);

    const outcome = this.model.buyBonus(mode);
    this.view.audio.buyConfirm();
    this.view.audio.bonusIntro();
    this.view.setBalance(outcome.balanceCents);
    this.bar.setBalance(outcome.balanceCents / 100);

    const lineBetCents = this.model.bet / SETTINGS.activeLines;

    let runningPayout = 0;
    const totalSpins = outcome.bonus.steps.length;
    this.view.setBonusHud(0, totalSpins, 0);

    const tk = this.turboKey();
    const deadPauseMs = VIEW_CONFIG.bonus.deadPauseMs[tk];
    const winPauseMs = VIEW_CONFIG.bonus.winPauseMs[tk];
    const { bigStepMultiple } = VIEW_CONFIG.bonus;
    let prevLocked: number[] = [];
    for (let i = 0; i < outcome.bonus.steps.length; i++) {
      const step = outcome.bonus.steps[i];
      this.view.clearWins();

      await this.view.playSpin(step.grid, VIEW_CONFIG.bonus.speedMul, prevLocked);
      prevLocked = step.lockedReels;

      this.view.pulseSticky(step.sticky, mode);
      if (step.sticky.length > 0) this.view.audio.stickyLock();
      runningPayout += step.payout;
      const runCents = Math.round(runningPayout * lineBetCents);
      this.view.setBonusHud(i, totalSpins, runCents);

      if (runCents > 0) this.bar.setLastWin(runCents / 100);

      if (step.payout > 0) {
        this.view.showWins(evaluateSpin(step.grid));
        const stepCents = Math.round(step.payout * lineBetCents);
        const stepMult = this.model.bet > 0 ? stepCents / this.model.bet : 0;
        const big = stepMult >= bigStepMultiple;
        this.view.audio.win(big ? 3 : 1);
        if (big) this.view.setBanner(`FREE SPIN ×${Math.round(stepMult)}`);
        await this.wait(big ? winPauseMs + 280 : winPauseMs);
      } else {
        await this.wait(deadPauseMs);
      }
    }

    this.view.audio.bonusEnd();
    this.view.setBonusHud(null, 0, 0);
    this.view.wipe('bonus', -1, 1);
    this.view.setBonusAtmosphere('idle');
    this.view.countUp(outcome.winCents);

    const fsLdw = outcome.winCents <= this.model.bet;

    const fsTierBet = Math.min(this.model.bet, Math.max(1, Math.round(outcome.winCents / 9)));
    this.view.playCeremony(outcome.winCents, fsLdw ? this.model.bet : fsTierBet, 1);
    this.bar.setLastWin(outcome.winCents / 100);
    this.view.setBanner(fsLdw ? 'FREE SPINS COMPLETE' : 'FREE SPINS WIN');
    this.scheduleOnce(() => {
      this.state = 'idle';
      this.bar.setSpinning(false);
      this.view.setInteractable(true);
      this.view.setBuyFabVisible(true);
      if (this.barNode?.isValid) this.barNode.active = !this.view.anyOverlayOpen();
      this.refreshBuyAffordability();
    }, 0.4);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((res) => this.scheduleOnce(() => res(), ms / 1000));
  }
}
