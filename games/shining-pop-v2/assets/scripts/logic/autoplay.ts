// Autoplay state machine — pure TypeScript, NO Cocos. Strict parity port of the
// shining-pop (PixiJS) autoplay semantics: count selection, stop-on-feature
// (default ON), stop-on-big-win >= 25x total bet (default OFF), balance guard,
// decrement at spin start, turbo-scaled inter-spin delay.

export const AUTOPLAY_COUNTS = [10, 25, 50, 100, 250] as const;

/** Big-win threshold as a multiple of total bet (parity: Pixi `betX6*25`). */
export const BIG_WIN_MULT = 25;

export interface AutoplayOptions {
  stopOnFeature: boolean;
  stopOnBigWin: boolean;
}

export interface AutoplayState {
  active: boolean;
  /** Spins left. Infinity = unlimited (only when maxSpins allows). */
  remaining: number;
  total: number;
  stopOnFeature: boolean;
  stopOnBigWin: boolean;
}

export interface SpinSummary {
  /** A free-spin feature triggered this spin. */
  isFeature: boolean;
  winCents: number;
  betCents: number;
  balanceCents: number;
}

export type StopReason = 'feature' | 'bigWin' | 'exhausted' | 'balance';

export const DEFAULT_OPTIONS: AutoplayOptions = { stopOnFeature: true, stopOnBigWin: false };

export function idleAutoplay(): AutoplayState {
  return { active: false, remaining: 0, total: 0, ...DEFAULT_OPTIONS };
}

/** Jurisdiction cap hook (parity: COMPLY.autoplay_max). Infinity = no cap. */
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
  };
}

export function stopAutoplay(state: AutoplayState): AutoplayState {
  return { ...state, active: false, remaining: 0 };
}

/** Decrement at spin START (parity: Pixi decrements in startSpin). */
export function spinStarted(state: AutoplayState): AutoplayState {
  if (!state.active || state.remaining === Infinity) return state;
  return { ...state, remaining: state.remaining - 1 };
}

/**
 * Post-settle continuation check, evaluated in the same order as the master:
 * feature -> big win -> exhausted -> balance. Returns the reason when stopping.
 */
export function evaluateContinuation(
  state: AutoplayState,
  spin: SpinSummary,
): { stop: boolean; reason?: StopReason } {
  if (!state.active) return { stop: true, reason: 'exhausted' };
  if (spin.isFeature && state.stopOnFeature) return { stop: true, reason: 'feature' };
  if (spin.winCents >= spin.betCents * BIG_WIN_MULT && state.stopOnBigWin) {
    return { stop: true, reason: 'bigWin' };
  }
  if (state.remaining <= 0) return { stop: true, reason: 'exhausted' };
  if (spin.balanceCents < spin.betCents) return { stop: true, reason: 'balance' };
  return { stop: false };
}

/** Inter-spin pause (parity: max-turbo 140 / turbo or reduced-motion 280 / off 720). */
export function interSpinDelayMs(turboMode: 0 | 1 | 2, reducedMotion = false): number {
  if (turboMode === 2) return 140;
  if (turboMode === 1 || reducedMotion) return 280;
  return 720;
}
