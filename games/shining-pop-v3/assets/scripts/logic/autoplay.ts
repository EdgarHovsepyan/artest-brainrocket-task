export const AUTOPLAY_COUNTS = [10, 25, 50, 100, 250] as const;

export const BIG_WIN_MULT = 25;

export interface AutoplayOptions {
  stopOnFeature: boolean;
  stopOnBigWin: boolean;
  /** Stop when cumulative net loss (bet - won) reaches this many cents. 0 = off. */
  lossLimitCents: number;
  /** Stop when a single spin wins at least this many cents. 0 = off. */
  singleWinLimitCents: number;
}

export interface AutoplayState {
  active: boolean;

  remaining: number;
  total: number;
  stopOnFeature: boolean;
  stopOnBigWin: boolean;
  lossLimitCents: number;
  singleWinLimitCents: number;
  /** Running cumulative net loss in cents (bet - won), summed across spins; never negative-clamped. */
  netLossCents: number;
}

export interface SpinSummary {
  isFeature: boolean;
  winCents: number;
  betCents: number;
  balanceCents: number;
}

export type StopReason =
  | 'feature'
  | 'bigWin'
  | 'exhausted'
  | 'balance'
  | 'lossLimit'
  | 'singleWin';

export const DEFAULT_OPTIONS: AutoplayOptions = {
  stopOnFeature: true,
  stopOnBigWin: false,
  lossLimitCents: 0,
  singleWinLimitCents: 0,
};

export function idleAutoplay(): AutoplayState {
  return { active: false, remaining: 0, total: 0, netLossCents: 0, ...DEFAULT_OPTIONS };
}

export function startAutoplay(
  spins: number,
  opts: AutoplayOptions,
  maxSpins: number = Infinity,
): AutoplayState {
  const capped =
    spins === Infinity ? (maxSpins === Infinity ? Infinity : maxSpins) : Math.min(spins, maxSpins);
  return {
    active: true,
    remaining: capped,
    total: capped,
    stopOnFeature: opts.stopOnFeature,
    stopOnBigWin: opts.stopOnBigWin,
    lossLimitCents: opts.lossLimitCents,
    singleWinLimitCents: opts.singleWinLimitCents,
    netLossCents: 0,
  };
}

export function stopAutoplay(state: AutoplayState): AutoplayState {
  return { ...state, active: false, remaining: 0 };
}

export function spinStarted(state: AutoplayState): AutoplayState {
  if (!state.active || state.remaining === Infinity) return state;
  return { ...state, remaining: state.remaining - 1 };
}

/**
 * Fold a spin's net result (bet - won) into the running cumulative net-loss tally.
 * A winning spin can reduce the tally; it is NOT clamped at zero so a later loss
 * still measures true net exposure. UI safeguard only — never touches RNG/payout.
 */
export function recordSpin(state: AutoplayState, spin: SpinSummary): AutoplayState {
  return { ...state, netLossCents: state.netLossCents + (spin.betCents - spin.winCents) };
}

export function evaluateContinuation(
  state: AutoplayState,
  spin: SpinSummary,
): { stop: boolean; reason?: StopReason } {
  if (!state.active) return { stop: true, reason: 'exhausted' };
  if (spin.isFeature && state.stopOnFeature) return { stop: true, reason: 'feature' };
  if (spin.winCents >= spin.betCents * BIG_WIN_MULT && state.stopOnBigWin) {
    return { stop: true, reason: 'bigWin' };
  }
  if (state.singleWinLimitCents > 0 && spin.winCents >= state.singleWinLimitCents) {
    return { stop: true, reason: 'singleWin' };
  }
  // Cumulative net loss INCLUDING this spin's result.
  if (
    state.lossLimitCents > 0 &&
    state.netLossCents + (spin.betCents - spin.winCents) >= state.lossLimitCents
  ) {
    return { stop: true, reason: 'lossLimit' };
  }
  if (state.remaining <= 0) return { stop: true, reason: 'exhausted' };
  if (spin.balanceCents < spin.betCents) return { stop: true, reason: 'balance' };
  return { stop: false };
}

export function interSpinDelayMs(turboMode: 0 | 1 | 2, reducedMotion = false): number {
  if (turboMode === 2) return 140;
  if (turboMode === 1 || reducedMotion) return 280;
  return 720;
}
