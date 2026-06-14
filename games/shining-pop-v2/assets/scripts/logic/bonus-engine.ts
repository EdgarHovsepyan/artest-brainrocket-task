// Pure bonus (free-spins) engine — deterministic, NO Cocos imports.
// Produces a step sequence the Cocos view plays back. Three modes:
// spinning wilds, sticky crowns, wild reels.

import { BonusMode, GRID, SYMBOLS } from './game-config';
import { Rng } from './rng';
import { evaluateSpin, spinGrid } from './spin-engine';
import { Grid } from './types';

const WILD = SYMBOLS.WILD;
const CROWN = SYMBOLS.H1;

export interface FreeSpinStep {
  grid: Grid;
  /** Line payout for this step, in line-bet multiples. */
  payout: number;
  /** Cells locked as sticky (crowns) at this step: [reel, row][]. */
  sticky: Array<[number, number]>;
}

export interface BonusResult {
  mode: BonusMode;
  steps: FreeSpinStep[];
  /** Total payout across all free spins, in line-bet multiples. */
  totalPayout: number;
}

/** Inject a mode's mechanic into a fresh grid (mutates it). */
function applyMechanic(grid: Grid, mode: BonusMode, rng: Rng, sticky: Set<string>): void {
  if (mode === 'reels') {
    // WILD REELS — the wild reel STAYS for the whole feature (it does not jump to
    // a new random reel each spin). Chosen once on the first step, stored in the
    // sticky set, then re-applied every step so it reads as a locked full-wild
    // reel while the others spin. Same wild density per step -> RTP unchanged
    // (symmetric reels), so the cost anchor holds.
    if (sticky.size === 0) sticky.add('reel:' + rng.int(GRID.reels));
    for (const key of sticky) {
      if (key.indexOf('reel:') !== 0) continue;
      const reel = Number(key.slice(5));
      for (let row = 0; row < GRID.rows; row++) grid[reel][row] = WILD;
    }
  } else if (mode === 'wilds') {
    // STICKY WILDS (2026-06-09): every wild that lands PERSISTS for the rest of the
    // bonus (it bounces on wins instead of respinning). Seed 1 on the first step,
    // then add 0-1 per step; bounded by the 15-cell grid. Cost is re-anchored to
    // ~96% via tools/bonus-sim.ts (cost = mean_payout / 0.96), so a richer feature
    // is simply priced higher — RTP stays ~96%.
    const add = sticky.size === 0 ? 1 : rng.int(2);
    for (let k = 0; k < add; k++) {
      for (let tries = 0; tries < 8; tries++) {
        const r = rng.int(GRID.reels),
          row = rng.int(GRID.rows);
        const key = r + ',' + row;
        if (!sticky.has(key)) {
          sticky.add(key);
          break;
        }
      }
    }
    for (const key of sticky) {
      const [reel, row] = key.split(',').map(Number);
      grid[reel][row] = WILD;
    }
  } else if (mode === 'crowns') {
    for (const key of sticky) {
      const [reel, row] = key.split(',').map(Number);
      grid[reel][row] = CROWN;
    }
    for (let reel = 0; reel < GRID.reels; reel++) {
      for (let row = 0; row < GRID.rows; row++) {
        if (grid[reel][row] === CROWN) sticky.add(reel + ',' + row);
      }
    }
  }
}

/**
 * SCATTER-triggered free spins: N PLAIN base spins (no sticky mechanic). Kept plain
 * so it is cheap + RTP-controllable — the scatter feature returns the base-RTP budget
 * freed by making the lollipop a scatter, without the rich buy-feature value. Reuses
 * spinGrid + evaluateSpin so free-spin wins follow the exact base-game maths. `mode`
 * is tagged 'wilds' only to satisfy BonusResult; the View labels it "FREE SPINS".
 */
export function runScatterFreeSpins(rng: Rng, spins: number): BonusResult {
  const steps: FreeSpinStep[] = [];
  let totalPayout = 0;
  for (let i = 0; i < spins; i++) {
    const grid = spinGrid(rng);
    const result = evaluateSpin(grid);
    totalPayout += result.totalPayout;
    steps.push({ grid, payout: result.totalPayout, sticky: [] });
  }
  return { mode: 'wilds', steps, totalPayout };
}

/** Run a full free-spins sequence for a mode. Deterministic given the RNG. */
export function runFreeSpins(rng: Rng, mode: BonusMode, spins: number): BonusResult {
  const steps: FreeSpinStep[] = [];
  const sticky = new Set<string>();
  let totalPayout = 0;
  for (let i = 0; i < spins; i++) {
    const grid = spinGrid(rng);
    applyMechanic(grid, mode, rng, sticky);
    const result = evaluateSpin(grid);
    totalPayout += result.totalPayout;
    steps.push({
      grid,
      payout: result.totalPayout,
      // Only real [reel,row] cell keys reach the view; the 'reel:N' WILD-REELS
      // state key is internal and must not be parsed as a cell position.
      //
      // NB: `Array.from(sticky)` not `[...sticky]`. Cocos 3.8.8's Babel emit
      // compiles `[...iterable]` down to `[].concat(iterable)`, which DOES NOT
      // iterate Sets — it pushes the Set as a single array element. Downstream
      // `.filter(k => k.indexOf(...))` then sees `k = Set` and crashes with
      // "k.indexOf is not a function". `Array.from()` is the iterable-safe form
      // that compiles cleanly. (Reproduced 2026-06-11 on the WILD-REELS buy.)
      sticky: Array.from(sticky)
        .filter((k) => k.indexOf('reel:') !== 0)
        .map((k) => k.split(',').map(Number) as [number, number]),
    });
  }
  return { mode, steps, totalPayout };
}
