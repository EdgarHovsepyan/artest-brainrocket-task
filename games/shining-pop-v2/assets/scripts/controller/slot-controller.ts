// MVC — CONTROLLER (+ composition root). The ONE component on the Canvas. Owns the
// Model, builds the View, and runs the spin lifecycle as an explicit state machine:
//
//   idle → spinning → resolving → idle        (re-click while spinning = quick-stop)
//   idle → bonus (free-spin playback) → idle
//
// The Model decides every outcome; the View only renders it.

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
import { BONUS_MODES, BonusMode, SETTINGS } from '../logic/game-config';
import { evaluateSpin } from '../logic/spin-engine';
import { VIEW_CONFIG } from '../view/view-config';

const { ccclass, property } = _decorator;

type FlowState = 'idle' | 'spinning' | 'resolving' | 'bonus';

@ccclass('SlotController')
export class SlotController extends Component {
  @property
  startBalanceCents = 100_00;

  @property
  betCents = 1_00;

  private model!: SlotModel;
  private view!: SlotView;
  private bar!: BettingBarMobile | BettingBarWeb;
  private barNode: Node | null = null;
  private barIsWeb: boolean | null = null;
  private lifecycle: LifecycleHandle | null = null;
  private comply: ComplyRules = getComply();
  private session: SessionStats = newSession(0);

  private state: FlowState = 'idle';
  private canStop = false;
  private turboMode: 0 | 1 | 2 = 0;
  private reducedFx = false;
  private autoplay: AutoplayState = idleAutoplay();
  private muted = false;

  onLoad(): void {
    // Uncap the frame rate: Cocos web defaults to 60 — 120 lets the game run at the
    // display's native refresh (120/144Hz ProMotion) for buttery spins. Visual/perf only.
    game.frameRate = 120;
    this.model = new SlotModel({ balanceCents: this.startBalanceCents, betCents: this.betCents });
    this.session = newSession(this.nowMs());
    const viewNode = new Node('SlotView');
    this.node.addChild(viewNode);
    this.view = viewNode.addComponent(SlotView);
    void this.boot();
  }

  private async boot(): Promise<void> {
    // externalControls: the shared BettingBar provides the controls + HUD.
    await this.view.init(true);
    this.view.showGrid(this.model.idleGrid());
    this.view.onBuyClicked((mode) => void this.onBuy(mode as BonusMode));
    this.view.configureBuyMenu(
      (Object.keys(BONUS_MODES) as BonusMode[]).map((mode) => ({
        mode,
        name: BONUS_MODES[mode].name,
        costText: this.fmt(this.model.bonusCost(mode)),
      })),
    );
    this.view.setBuyBet(this.fmt(this.model.bet));
    // The modal's inline bet stepper walks the same ladder as the bar.
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

    // INTRO GATE + first-gesture audio bootstrap (master learning: ANY first
    // gesture must unlock the bank, not only the intro tap).
    this.view.buildIntro(() => {
      this.view.audio.unlock();
      this.view.audio.playMusic('main_base_loop');
    });
    const unlockOnce = () => {
      this.view.audio.unlock();
      this.view.audio.playMusic('main_base_loop');
      window.removeEventListener('pointerdown', unlockOnce, true);
      window.removeEventListener('keydown', unlockOnce, true);
    };
    try {
      window.addEventListener('pointerdown', unlockOnce, { capture: true, once: true });
      window.addEventListener('keydown', unlockOnce, { capture: true, once: true });
    } catch {
      /* non-browser runtime */
    }

    // Shared betting bar — WEB strip on landscape, the portrait overlay on
    // mobile aspect (master parity: two bar layouts, one controller surface).
    this.buildBar();
    // Boot-time relayer for the whole built tree (view + intro + panels).
    this.scheduleOnce(() => this.relayerUI(this.node), 0);
    // ONE resize owner: cc.view holds a SINGLE callback, so the controller fans
    // out to the view AND the bar (setting it in both places clobbered the view's).
    const handleResize = (): void => {
      this.view.refit();
      this.buildBar();
      this.fitBar();
    };
    view.setResizeCallback(handleResize);
    // Lifecycle hooks: tab visibility + minimize freeze the tick and suspend
    // audio (browsers throttle hidden tabs anyway; this is explicit + clean);
    // online/offline shows a network modal; resize is debounced beyond cc.view.
    this.lifecycle = installLifecycle({
      onSuspend: () => this.view.audio.suspend(),
      onResume: () => this.view.audio.resume(),
      onResize: handleResize,
      onNetwork: (online) => this.onNetworkChange(online),
    });

    this.view.setInteractable(true);
    input.on(Input.EventType.KEY_DOWN, this.onKey, this);

    // DEV-ONLY remote control (?debug) — master parity with window.__dbg: lets
    // headless QA force ceremonies/panels without playing for the trigger.
    try {
      if (typeof location !== 'undefined' && /[?&]debug/.test(location.search)) {
        (window as unknown as Record<string, unknown>).__v2 = {
          view: this.view,
          spin: () => this.onSpinPressed(),
          ceremony: (mult = 25, wild = 1) =>
            this.view.playCeremony(this.model.bet * mult, this.model.bet, wild),
          feature: (name = 'STICKY WILDS') => this.view.showFeatureUnlocked(name),
          buy: (mode: BonusMode = 'reels') => void this.onBuy(mode),
        };
      }
    } catch {
      /* non-browser runtime */
    }
  }

  /** (Re)create the bar variant for the current orientation and wire it. */
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
    this.bar.on('menu', () => this.view.openMenuHub());
    this.bar.on('ui:click', () => this.view.audio.click());
    // Defer state writes one frame so the bar's onLoad has built its labels.
    this.scheduleOnce(() => {
      // Code-created nodes default to the DEFAULT layer, which the 2D UI renderer
      // skips (-> black screen). Force the built tree onto UI_2D so it draws.
      this.relayerUI(barNode);
      this.fitBar();
      this.syncHud();
      this.bar.setLastWin(0);
      this.bar.setTurbo(this.turboMode);
      this.bar.setSoundOn(!this.muted);
      this.bar.setAutoplay(this.autoplay.active ? this.autoplay.remaining : null);
      if (this.barIsWeb) {
        (this.bar as BettingBarWeb).setSpinArt(this.view.getBrandFrame('spinArt'));
        this.relayerUI(barNode);
      }
    }, 0);
  }

  /** Fit the bar to the viewport. The web bar returns its solid-band height and
   *  the board contain-fits ABOVE it (master fitBottom contract); the portrait
   *  mobile overlay centres and the board keeps the full viewport. */
  private fitBar(): void {
    const vs = view.getVisibleSize();
    if (this.barIsWeb) {
      const inset = (this.bar as BettingBarWeb).fit(vs.width, vs.height);
      this.view.setBottomInset(inset);
      return;
    }
    this.view.setBottomInset(0);
    const { designWidth, designHeight, reelCenterY, cell, gap } = VIEW_CONFIG.layout;
    const boardScale = Math.min(vs.width / designWidth, vs.height / designHeight);
    const gh = 3 * cell + 2 * gap;
    const boardBottomY = (reelCenterY - gh / 2 - 28) * boardScale;
    (this.bar as BettingBarMobile).fit(vs.width, vs.height, boardBottomY);
  }

  /** Recursively move a node subtree onto the UI_2D layer so the UI renderer draws it. */
  private relayerUI(n: Node): void {
    n.layer = Layers.Enum.UI_2D;
    const kids = n.children;
    for (let i = 0; i < kids.length; i++) this.relayerUI(kids[i]);
  }

  /** Push model balance + bet into the betting bar (cents → display units). */
  private syncHud(): void {
    this.bar.setBalance(this.model.balance / 100);
    this.bar.setBet(this.model.bet / 100);
    // live bar state: dim the stepper at the ladder ends, dim spin if unaffordable.
    this.bar.setSteppers(this.model.bet > minBet(), this.model.bet < maxBet());
    this.bar.setAffordable(this.model.canSpin());
    if (this.barIsWeb) {
      (this.bar as BettingBarWeb).setBetLevels(
        BET_LEVELS_CENTS.slice(),
        BET_LEVELS_CENTS.indexOf(snapBet(this.model.bet)),
        (cents) => (cents / 100).toFixed(2),
      );
    }
  }

  /** Absolute bet set (carousel / x2 / quick-bet panel) — same guards as stepping. */
  private setBetTo(cents: number): void {
    if (this.state !== 'idle' || this.autoplay.active) return;
    this.model.setBet(snapBet(cents));
    this.view.audio.bet();
    this.view.configureQuickBetPanel(BET_LEVELS_CENTS, this.model.bet);
    this.syncHud();
    this.refreshBuyMenu();
  }

  /** Keep the buy modal's tier costs + bet readout in sync after a bet change. */
  private refreshBuyMenu(): void {
    const costs = (Object.keys(BONUS_MODES) as BonusMode[]).map((m) =>
      this.fmt(this.model.bonusCost(m)),
    );
    this.view.refreshBuyCosts(costs);
    this.view.setBuyBet(this.fmt(this.model.bet));
  }

  /** Wall-clock for the session timer (Date.now is fine at game runtime). */
  private nowMs(): number {
    return typeof Date !== 'undefined' ? Date.now() : 0;
  }

  /** Show the Reality Check; CONTINUE resets the counters + resumes autoplay,
   *  STOP ends any autoplay and leaves the player on an idle board. */
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

  /** Bet stepper from the bar — walks the BET_LEVELS ladder (master parity).
   *  Locked during autoplay. */
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

  /** Network state changed: offline -> blocking modal; online -> dismiss it.
   *  The modal blocks input to the background (master compliance: clear failure
   *  state, dismissible "Retry" surface). */
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

  /** Master keyboard map: Space spin · A autoplay · T turbo · M mute · B buy · S settings. */
  private onKey(e: EventKeyboard): void {
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

  /** Bar turbo control cycles OFF -> TURBO -> MEGA -> OFF (master tri-state). */
  private toggleTurbo(): void {
    this.setTurboMode(((this.turboMode + 1) % 3) as 0 | 1 | 2);
  }

  private setTurboMode(mode: 0 | 1 | 2): void {
    this.turboMode = mode;
    this.view.setTurboVisual(mode > 0);
    this.bar.setTurbo(mode);
    this.refreshSettingsPanel();
  }

  /** Reel-duration scalar per turbo mode (view-config table). */
  private turboScalar(): number {
    const t = VIEW_CONFIG.turbo;
    return [t.off, t.turbo, t.max][this.turboMode];
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

  /** AUTO control (bar / keyboard A): running -> stop the run; idle -> open the panel. */
  private toggleAuto(): void {
    if (this.autoplay.active) this.stopAuto();
    else this.view.openAutoplayPanel();
  }

  private startAuto(spins: number): void {
    if (this.state !== 'idle') return;
    this.autoplay = startAutoplay(spins, this.autoplay);
    this.view.setAutoVisual(true);
    this.bar.setAutoplay(this.autoplay.remaining);
    this.onSpinPressed();
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

  /** Spin button / Space: start a spin, or quick-stop one already running. */
  private onSpinPressed(): void {
    if (this.state === 'spinning') {
      if (this.canStop) this.view.quickStopReels();
      return;
    }
    if (this.state !== 'idle' || !this.model.canSpin()) return;
    void this.runSpin();
  }

  private async runSpin(): Promise<void> {
    this.state = 'spinning';
    if (this.autoplay.active) {
      // Master parity: the spin counter decrements at spin START, not settle.
      this.autoplay = spinStarted(this.autoplay);
      this.bar.setAutoplay(this.autoplay.remaining);
    }
    this.bar.setSpinning(true); // swap the spin arrow → stop square
    this.view.setInteractable(true); // keep enabled so a re-click can quick-stop
    this.view.clearWins();
    this.view.setWin(0);
    this.view.setBanner('');
    this.view.closeBuyMenu();
    this.view.closeAutoplayPanel();

    this.canStop = false;
    this.scheduleOnce(() => (this.canStop = true), 0.18);

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
      // UKGC LDW rule: a return <= 1x total bet must NOT play triumphant audio.
      if (outcome.winCents > outcome.betCents) {
        const mult = outcome.winCents / outcome.betCents;
        const tier = mult >= 50 ? 5 : mult >= 20 ? 4 : mult >= 8 ? 3 : mult >= 2 ? 2 : 1;
        this.view.audio.win(tier);
      }
    }

    this.session = recordSpin(this.session, outcome.betCents, outcome.winCents);

    this.scheduleOnce(() => {
      this.state = 'idle';
      this.bar.setSpinning(false); // stop square → spin arrow
      this.bar.setAffordable(this.model.canSpin());
      this.bar.setSteppers(this.model.bet > 100, this.model.bet < 1000);
      this.view.setInteractable(true);
      // Responsible-gaming Reality Check interrupts before the next spin/autoplay.
      if (realityCheckDue(this.session, this.comply, this.nowMs())) {
        this.presentRealityCheck();
        return;
      }
      if (this.autoplay.active) {
        // Master-parity continuation: feature -> bigWin -> exhausted -> balance.
        // Base game has no natural free-spin trigger (buy-only), so isFeature
        // stays false until scatter wiring lands.
        const verdict = evaluateContinuation(this.autoplay, {
          isFeature: false,
          winCents: outcome.winCents,
          betCents: outcome.betCents,
          balanceCents: this.model.balance,
        });
        if (verdict.stop) this.stopAuto();
        else {
          const d = interSpinDelayMs(this.turboMode);
          this.scheduleOnce(() => {
            if (this.autoplay.active && this.state === 'idle') this.onSpinPressed();
          }, d / 1000);
        }
      }
    }, 0.3);
  }

  /** Buy a feature: play each free spin back, then credit + celebrate. */
  private async onBuy(mode: BonusMode): Promise<void> {
    if (this.state !== 'idle' || this.autoplay.active) return;
    if (this.model.balance < this.model.bonusCost(mode)) return;
    this.state = 'bonus';
    this.bar.setSpinning(true);
    this.view.setInteractable(false);
    this.view.setBuyFabVisible(false); // no buying mid-feature
    this.view.clearWins();
    this.view.setWin(0);
    this.view.setBanner(BONUS_MODES[mode].name);
    this.view.showFeatureUnlocked(BONUS_MODES[mode].name);

    const outcome = this.model.buyBonus(mode);
    this.view.audio.buyConfirm();
    this.view.audio.bonusIntro();
    this.view.setBonusAtmosphere(mode);
    this.view.setBalance(outcome.balanceCents);
    this.bar.setBalance(outcome.balanceCents / 100);

    const lineBetCents = this.model.bet / SETTINGS.activeLines;
    // Accumulate RAW payout and round ONCE per display (sum-then-round), the same
    // way the model credits the total -> the HUD running total ends EXACTLY on the
    // credited win (no round-then-sum drift) and is always clean integer cents.
    let runningPayout = 0;
    const totalSpins = outcome.bonus.steps.length;
    this.view.setBonusHud(0, totalSpins, 0);
    const { deadPauseMs, winPauseMs, bigStepMultiple } = VIEW_CONFIG.bonus;
    for (let i = 0; i < outcome.bonus.steps.length; i++) {
      const step = outcome.bonus.steps[i];
      this.view.clearWins();
      await this.view.playSpin(step.grid, VIEW_CONFIG.bonus.speedMul);
      // Sticky wilds / crowns persist in the grid — bounce them so they read as
      // locked + alive each spin (not respun). [reel,row][] from the bonus engine.
      this.view.pulseSticky(step.sticky);
      if (step.sticky.length > 0) this.view.audio.stickyLock();
      runningPayout += step.payout;
      this.view.setBonusHud(i, totalSpins, Math.round(runningPayout * lineBetCents));
      // Per-spin MONEY MOMENT: a winning free spin gets its win lines, a tiered
      // sting and a savour dwell so a 40x spin no longer reads like a 0x dead one
      // (owner: "every free spin ceremony effects all need busting").
      if (step.payout > 0) {
        this.view.showWins(evaluateSpin(step.grid));
        const stepCents = Math.round(step.payout * lineBetCents);
        const stepMult = this.model.bet > 0 ? stepCents / this.model.bet : 0; // total-bet multiple
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
    this.view.setBonusAtmosphere('idle');
    this.view.countUp(outcome.winCents);
    // FS finale: floor the ceremony tier so completing a feature with a genuine
    // win always feels rewarding (flagship parity), and label it as a free-spins
    // win — LDW-safe wording when the feature returned <= 1x the buy/bet.
    const fsLdw = outcome.winCents <= this.model.bet;
    // BonusOutcome has no betCents — passing it was undefined at runtime and
    // corrupted the ceremony's win-vs-bet tier scaling. Tier against the live bet,
    // floored so a real feature win lands at least at the BIG band.
    const fsTierBet = Math.min(this.model.bet, Math.max(1, Math.round(outcome.winCents / 9)));
    this.view.playCeremony(outcome.winCents, fsLdw ? this.model.bet : fsTierBet, 1);
    this.bar.setLastWin(outcome.winCents / 100);
    this.view.setBanner(fsLdw ? 'FREE SPINS COMPLETE' : 'FREE SPINS WIN');
    this.scheduleOnce(() => {
      this.state = 'idle';
      this.bar.setSpinning(false);
      this.view.setInteractable(true);
      this.view.setBuyFabVisible(true); // feature over — buying allowed again
    }, 0.4);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((res) => this.scheduleOnce(() => res(), ms / 1000));
  }
}
