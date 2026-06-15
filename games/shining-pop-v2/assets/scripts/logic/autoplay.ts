export const AUTOPLAY_COUNTS = [10, 25, 50, 100, 250] as const;

export const BIG_WIN_MULT = 25;

export interface AutoplayOptions {
  stopOnFeature: boolean;
  stopOnBigWin: boolean;
}

export interface AutoplayState {
  active: boolean;

  remaining: number;
  total: number;
  stopOnFeature: boolean;
  stopOnBigWin: boolean;
}

export interface SpinSummary {
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

export function spinStarted(state: AutoplayState): AutoplayState {
  if (!state.active || state.remaining === Infinity) return state;
  return { ...state, remaining: state.remaining - 1 };
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
  if (state.remaining <= 0) return { stop: true, reason: 'exhausted' };
  if (spin.balanceCents < spin.betCents) return { stop: true, reason: 'balance' };
  return { stop: false };
}

export function interSpinDelayMs(turboMode: 0 | 1 | 2, reducedMotion = false): number {
  if (turboMode === 2) return 140;
  if (turboMode === 1 || reducedMotion) return 280;
  return 720;
}
