import { BONUS_MODES, BonusMode, SETTINGS } from '../logic/game-config';
import { BonusResult, runFreeSpins, runScatterFreeSpins } from '../logic/bonus-engine';
import { createRng, Rng } from '../logic/rng';
import { spin as engineSpin, wildStrikeMultiplier } from '../logic/spin-engine';
import { SpinResult } from '../logic/types';

export interface SpinOutcome {
  result: SpinResult;

  wildStrike: number;
  betCents: number;
  winCents: number;
  balanceCents: number;

  freeSpins: BonusResult | null;

  scatterCents: number;
}

export interface BonusOutcome {
  bonus: BonusResult;
  costCents: number;
  winCents: number;
  balanceCents: number;
}

export interface SlotModelParams {
  seed?: number;
  balanceCents?: number;
  betCents?: number;
}

export class SlotModel {
  private readonly rng: Rng;
  private balanceCents: number;
  private betCents: number;

  constructor(params: SlotModelParams = {}) {
    this.rng = createRng(params.seed ?? Math.floor(Math.random() * 0xffffffff));
    this.balanceCents = params.balanceCents ?? 100_00;
    this.betCents = params.betCents ?? 1_00;
  }

  get balance(): number {
    return this.balanceCents;
  }
  get bet(): number {
    return this.betCents;
  }
  get lines(): number {
    return SETTINGS.activeLines;
  }

  canSpin(): boolean {
    return this.balanceCents >= this.betCents;
  }

  setBet(cents: number): void {
    this.betCents = Math.max(SETTINGS.activeLines, cents);
  }

  play(): SpinOutcome {
    if (!this.canSpin()) throw new Error('SlotModel.play(): insufficient balance');
    this.balanceCents -= this.betCents;
    const result = engineSpin(this.rng);
    const wildStrike = wildStrikeMultiplier(result.grid);
    const lineBetCents = this.betCents / SETTINGS.activeLines;
    let winCents = Math.round(result.totalPayout * wildStrike * lineBetCents);

    const scatterCents = Math.round(result.scatterPay * lineBetCents);
    winCents += scatterCents;

    let freeSpins: BonusResult | null = null;
    if (result.freeSpins > 0) {
      freeSpins = runScatterFreeSpins(this.rng, result.freeSpins);
      winCents += Math.round(freeSpins.totalPayout * lineBetCents);
    }
    this.balanceCents += winCents;
    return {
      result,
      wildStrike,
      betCents: this.betCents,
      winCents,
      balanceCents: this.balanceCents,
      freeSpins,
      scatterCents,
    };
  }

  idleGrid() {
    return engineSpin(createRng(7)).grid;
  }

  bonusCost(mode: BonusMode): number {
    return Math.round(this.betCents * BONUS_MODES[mode].cost);
  }

  buyBonus(mode: BonusMode): BonusOutcome {
    const costCents = this.bonusCost(mode);
    if (this.balanceCents < costCents) {
      throw new Error('SlotModel.buyBonus(): insufficient balance');
    }
    this.balanceCents -= costCents;
    const bonus = runFreeSpins(this.rng, mode, BONUS_MODES[mode].spins);
    const lineBetCents = this.betCents / SETTINGS.activeLines;
    const winCents = Math.round(bonus.totalPayout * lineBetCents);
    this.balanceCents += winCents;
    return { bonus, costCents, winCents, balanceCents: this.balanceCents };
  }
}
