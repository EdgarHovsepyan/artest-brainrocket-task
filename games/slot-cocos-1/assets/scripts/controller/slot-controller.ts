// MVC — CONTROLLER (+ composition root). The ONE component on the Canvas. Owns the
// Model, builds the View, and runs the spin lifecycle as an explicit state machine:
//
//   idle → spinning → resolving → idle        (re-click while spinning = quick-stop)
//   idle → bonus (free-spin playback) → idle
//
// The Model decides every outcome; the View only renders it.

import { _decorator, Component, EventKeyboard, Input, input, KeyCode, Node } from 'cc';
import { SlotModel } from '../model/slot-model';
import { SlotView } from '../view/slot-view';
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
    await this.view.init();
    this.view.showGrid(this.model.idleGrid());

    this.view.onSpinClicked(() => this.onSpinPressed());
    this.view.onBuyClicked((mode) => void this.onBuy(mode as BonusMode));
    this.view.onTurboClicked(() => this.toggleTurbo());
    this.view.onAutoClicked(() => this.toggleAuto());
    this.view.onSoundClicked(() => this.toggleSound());
    this.view.configureBuyMenu(
      (Object.keys(BONUS_MODES) as BonusMode[]).map((mode) => ({
        mode,
        name: BONUS_MODES[mode].name,
        costText: this.fmt(this.model.bonusCost(mode)),
      })),
    );

    this.view.setBalance(this.model.balance);
    this.view.setBet(this.model.bet);
    this.view.setWin(0);
    this.view.setInteractable(true);

    input.on(Input.EventType.KEY_DOWN, this.onKey, this);
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
  }

  private toggleSound(): void {
    this.muted = !this.muted;
    this.view.setMuted(this.muted);
    this.view.setSoundVisual(this.muted);
  }

  private toggleAuto(): void {
    this.auto = !this.auto;
    this.view.setAutoVisual(this.auto);
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
    this.view.setInteractable(true); // keep enabled so a re-click can quick-stop
    this.view.clearWins();
    this.view.setWin(0);
    this.view.setBanner('');
    this.view.closeBuyMenu();

    this.canStop = false;
    this.scheduleOnce(() => (this.canStop = true), 0.18);

    const outcome = this.model.play();
    this.view.setBalance(outcome.balanceCents);

    await this.view.playSpin(outcome.result.grid, this.turbo ? VIEW_CONFIG.bonus.speedMul : 1);

    this.state = 'resolving';
    if (outcome.wildStrike > 1) this.view.setBanner(`WILD ×${outcome.wildStrike}`);
    if (outcome.winCents > 0) {
      this.view.showWins(outcome.result);
      this.view.burstParticles(outcome.result, outcome.winCents / this.model.bet);
      this.view.countUp(outcome.winCents);
      this.view.playCeremony(outcome.winCents, outcome.betCents, outcome.wildStrike);
    }

    this.scheduleOnce(() => {
      this.state = 'idle';
      this.view.setInteractable(true);
      if (this.auto && this.model.canSpin()) this.scheduleOnce(() => this.onSpinPressed(), 0.4);
      else if (this.auto) this.toggleAuto();
    }, 0.3);
  }

  /** Buy a feature: play each free spin back, then credit + celebrate. */
  private async onBuy(mode: BonusMode): Promise<void> {
    if (this.state !== 'idle' || this.model.balance < this.model.bonusCost(mode)) return;
    this.state = 'bonus';
    this.view.setInteractable(false);
    this.view.clearWins();
    this.view.setWin(0);
    this.view.setBanner(BONUS_MODES[mode].name);
    this.view.showFeatureUnlocked(BONUS_MODES[mode].name);

    const outcome = this.model.buyBonus(mode);
    this.view.setBalance(outcome.balanceCents);

    for (const step of outcome.bonus.steps) {
      this.view.clearWins();
      await this.view.playSpin(step.grid, VIEW_CONFIG.bonus.speedMul);
      if (step.payout > 0) this.view.showWins(evaluateSpin(step.grid));
      await this.wait(VIEW_CONFIG.bonus.stepPauseMs);
    }

    this.view.countUp(outcome.winCents);
    this.view.playCeremony(outcome.winCents, outcome.betCents, 1);
    this.view.setBanner('FEATURE WON');
    this.scheduleOnce(() => {
      this.state = 'idle';
      this.view.setInteractable(true);
    }, 0.4);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((res) => this.scheduleOnce(() => res(), ms / 1000));
  }
}
