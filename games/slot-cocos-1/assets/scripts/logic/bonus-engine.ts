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
    const reel = rng.int(GRID.reels);
    for (let row = 0; row < GRID.rows; row++) grid[reel][row] = WILD;
  } else if (mode === 'wilds') {
    const count = 1 + rng.int(2);
    for (let k = 0; k < count; k++) grid[rng.int(GRID.reels)][rng.int(GRID.rows)] = WILD;
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
      sticky: [...sticky].map((k) => k.split(',').map(Number) as [number, number]),
    });
  }
  return { mode, steps, totalPayout };
}
