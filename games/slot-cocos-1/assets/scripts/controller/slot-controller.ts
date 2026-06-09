// MVC — CONTROLLER (+ composition root). The ONE component on the Canvas. Owns the
// Model, builds the View, and runs the spin lifecycle as an explicit state machine:
//
//   idle → spinning → resolving → idle        (re-click while spinning = quick-stop)
//   idle → bonus (free-spin playback) → idle
//
// The Model decides every outcome; the View only renders it.

import { _decorator, Component, EventKeyboard, Input, input, KeyCode, Node, view } from 'cc';
import { SlotModel } from '../model/slot-model';
import { SlotView } from '../view/slot-view';
import { BettingBarMobile } from '../ui/betting-bar';
import { BONUS_MODES, BonusMode } from '../logic/game-config';
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
  private bar!: BettingBarMobile;

  private state: FlowState = 'idle';
  private canStop = false;
  private turbo = false;
  private auto = false;
  private muted = false;

  onLoad(): void {
    this.model = new SlotModel({ balanceCents: this.startBalanceCents, betCents: this.betCents });
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

    // Shared betting bar = the only on-screen controls; buy-bonus is game state.
    const barNode = new Node('BettingBar');
    this.node.addChild(barNode);
    this.bar = barNode.addComponent(BettingBarMobile);
    this.bar.on('spin', () => this.onSpinPressed());
    this.bar.on('bet:inc', () => this.changeBet(1));
    this.bar.on('bet:dec', () => this.changeBet(-1));
    this.bar.on('turbo', () => this.toggleTurbo());
    this.bar.on('autoplay', () => this.toggleAuto());
    this.bar.on('sound', () => this.toggleSound());
    this.bar.on('menu', () => this.view.openBuyMenu());

    // Defer HUD writes one frame so the bar's onLoad has built its labels.
    this.scheduleOnce(() => {
      const vs = view.getVisibleSize();
      this.bar.fit(vs.width, vs.height);
      this.syncHud();
      this.bar.setLastWin(0);
    }, 0);

    this.view.setInteractable(true);
    input.on(Input.EventType.KEY_DOWN, this.onKey, this);
  }

  /** Push model balance + bet into the betting bar (cents → display units). */
  private syncHud(): void {
    this.bar.setBalance(this.model.balance / 100);
    this.bar.setBet(this.model.bet / 100);
    // live bar state: dim the stepper at the bet bounds, dim spin if unaffordable.
    this.bar.setSteppers(this.model.bet > 100, this.model.bet < 1000);
    this.bar.setAffordable(this.model.canSpin());
  }

  /** Bet stepper from the bar (± one currency unit). */
  private changeBet(dir: number): void {
    if (this.state !== 'idle') return;
    this.model.setBet(Math.max(100, Math.min(1000, this.model.bet + dir * 100)));
    this.syncHud();
  }

  onDestroy(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKey, this);
  }

  private onKey(e: EventKeyboard): void {
    if (e.keyCode === KeyCode.SPACE) this.onSpinPressed();
  }

  private fmt(cents: number): string {
    return (cents / 100).toFixed(2);
  }

  private toggleTurbo(): void {
    this.turbo = !this.turbo;
    this.view.setTurboVisual(this.turbo);
    this.bar.setTurbo(this.turbo ? 1 : 0);
  }

  private toggleSound(): void {
    this.muted = !this.muted;
    this.view.setMuted(this.muted);
    this.view.setSoundVisual(this.muted);
    this.bar.setSoundOn(!this.muted);
  }

  private toggleAuto(): void {
    this.auto = !this.auto;
    this.view.setAutoVisual(this.auto);
    this.bar.setAutoplay(this.auto ? Infinity : null);
    if (this.auto && this.state === 'idle') this.onSpinPressed();
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
    this.bar.setSpinning(true); // swap the spin arrow → stop square
    this.view.setInteractable(true); // keep enabled so a re-click can quick-stop
    this.view.clearWins();
    this.view.setWin(0);
    this.view.setBanner('');
    this.view.closeBuyMenu();

    this.canStop = false;
    this.scheduleOnce(() => (this.canStop = true), 0.18);

    const outcome = this.model.play();
    this.view.setBalance(outcome.balanceCents);
    this.bar.setBalance(outcome.balanceCents / 100);

    await this.view.playSpin(outcome.result.grid, this.turbo ? VIEW_CONFIG.bonus.speedMul : 1);

    this.state = 'resolving';
    if (outcome.wildStrike > 1) this.view.setBanner(`WILD ×${outcome.wildStrike}`);
    if (outcome.winCents > 0) {
      this.view.showWins(outcome.result);
      this.view.burstParticles(outcome.result, outcome.winCents / this.model.bet);
      this.view.countUp(outcome.winCents);
      this.view.playCeremony(outcome.winCents, outcome.betCents, outcome.wildStrike);
      this.bar.setLastWin(outcome.winCents / 100);
    }

    this.scheduleOnce(() => {
      this.state = 'idle';
      this.bar.setSpinning(false); // stop square → spin arrow
      this.bar.setAffordable(this.model.canSpin());
      this.bar.setSteppers(this.model.bet > 100, this.model.bet < 1000);
      this.view.setInteractable(true);
      if (this.auto && this.model.canSpin()) this.scheduleOnce(() => this.onSpinPressed(), 0.4);
      else if (this.auto) this.toggleAuto();
    }, 0.3);
  }

  /** Buy a feature: play each free spin back, then credit + celebrate. */
  private async onBuy(mode: BonusMode): Promise<void> {
    if (this.state !== 'idle' || this.model.balance < this.model.bonusCost(mode)) return;
    this.state = 'bonus';
    this.bar.setSpinning(true);
    this.view.setInteractable(false);
    this.view.clearWins();
    this.view.setWin(0);
    this.view.setBanner(BONUS_MODES[mode].name);
    this.view.showFeatureUnlocked(BONUS_MODES[mode].name);

    const outcome = this.model.buyBonus(mode);
    this.view.setBalance(outcome.balanceCents);
    this.bar.setBalance(outcome.balanceCents / 100);

    for (const step of outcome.bonus.steps) {
      this.view.clearWins();
      await this.view.playSpin(step.grid, VIEW_CONFIG.bonus.speedMul);
      // Sticky wilds / crowns persist in the grid — bounce them so they read as
      // locked + alive each spin (not respun). [reel,row][] from the bonus engine.
      this.view.pulseSticky(step.sticky);
      if (step.payout > 0) this.view.showWins(evaluateSpin(step.grid));
      await this.wait(VIEW_CONFIG.bonus.stepPauseMs);
    }

    this.view.countUp(outcome.winCents);
    this.view.playCeremony(outcome.winCents, outcome.betCents, 1);
    this.bar.setLastWin(outcome.winCents / 100);
    this.view.setBanner('FEATURE WON');
    this.scheduleOnce(() => {
      this.state = 'idle';
      this.bar.setSpinning(false);
      this.view.setInteractable(true);
    }, 0.4);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((res) => this.scheduleOnce(() => res(), ms / 1000));
  }
}
