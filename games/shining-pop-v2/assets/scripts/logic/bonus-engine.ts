import { BonusMode, GRID, SYMBOLS } from './game-config';
import { Rng } from './rng';
import { evaluateSpin, spinGrid } from './spin-engine';
import { Grid } from './types';

const WILD = SYMBOLS.WILD;
const CROWN = SYMBOLS.H1;

export interface FreeSpinStep {
  grid: Grid;

  payout: number;

  sticky: Array<[number, number]>;

  lockedReels: number[];
}

export interface BonusResult {
  mode: BonusMode;
  steps: FreeSpinStep[];

  totalPayout: number;
}

function applyMechanic(grid: Grid, mode: BonusMode, rng: Rng, sticky: Set<string>): void {
  if (mode === 'reels') {
    if (sticky.size === 0) sticky.add('reel:' + rng.int(GRID.reels));
    for (const key of sticky) {
      if (key.indexOf('reel:') !== 0) continue;
      const reel = Number(key.slice(5));
      for (let row = 0; row < GRID.rows; row++) grid[reel][row] = WILD;
    }
  } else if (mode === 'wilds') {
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

export function runScatterFreeSpins(rng: Rng, spins: number): BonusResult {
  const steps: FreeSpinStep[] = [];
  let totalPayout = 0;
  for (let i = 0; i < spins; i++) {
    const grid = spinGrid(rng);
    const result = evaluateSpin(grid);
    totalPayout += result.totalPayout;
    steps.push({ grid, payout: result.totalPayout, sticky: [], lockedReels: [] });
  }
  return { mode: 'wilds', steps, totalPayout };
}

export function runFreeSpins(rng: Rng, mode: BonusMode, spins: number): BonusResult {
  const steps: FreeSpinStep[] = [];
  const sticky = new Set<string>();
  let totalPayout = 0;
  for (let i = 0; i < spins; i++) {
    const grid = spinGrid(rng);
    applyMechanic(grid, mode, rng, sticky);
    const result = evaluateSpin(grid);
    totalPayout += result.totalPayout;
    const lockedReels: number[] = [];
    for (let reel = 0; reel < GRID.reels; reel++) {
      if (sticky.has('reel:' + reel)) {
        lockedReels.push(reel);
        continue;
      }
      let allRows = true;
      for (let row = 0; row < GRID.rows; row++) {
        if (!sticky.has(reel + ',' + row)) {
          allRows = false;
          break;
        }
      }
      if (allRows) lockedReels.push(reel);
    }
    steps.push({
      grid,
      payout: result.totalPayout,

      sticky: Array.from(sticky)
        .filter((k) => k.indexOf('reel:') !== 0)
        .map((k) => k.split(',').map(Number) as [number, number]),
      lockedReels,
    });
  }
  return { mode, steps, totalPayout };
}
