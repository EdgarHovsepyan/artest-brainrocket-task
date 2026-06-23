import {
  FREE_SPINS_AWARD,
  GRID,
  PAYLINES,
  PAYTABLE,
  REEL_WEIGHTS,
  SCATTER,
  SCATTER_MIN,
  SCATTER_PAY,
  SETTINGS,
  SYMBOLS,
  WILD_STRIKE,
} from './game-config';
import { Rng } from './rng';
import { Grid, LineWin, SpinResult, SymbolId } from './types';

const WILD = SYMBOLS.WILD;
const SCAT = SCATTER;

export function buildStrip(weights: Record<SymbolId, number>): SymbolId[] {
  const slots: { pos: number; symbol: SymbolId }[] = [];
  for (const key of Object.keys(weights)) {
    const symbol = Number(key);
    const count = weights[symbol];
    for (let i = 0; i < count; i++) slots.push({ pos: (i + 0.5) / count, symbol });
  }
  slots.sort((a, b) => a.pos - b.pos || a.symbol - b.symbol);
  return slots.map((s) => s.symbol);
}

export const REEL_STRIPS: SymbolId[][] = REEL_WEIGHTS.map(buildStrip);

export function spinGrid(rng: Rng, strips: SymbolId[][] = REEL_STRIPS): Grid {
  const grid: Grid = [];
  for (let reel = 0; reel < GRID.reels; reel++) {
    const strip = strips[reel];
    const stop = rng.int(strip.length);
    const column: SymbolId[] = [];
    for (let row = 0; row < GRID.rows; row++) {
      column.push(strip[(stop + row) % strip.length]);
    }
    grid.push(column);
  }
  return grid;
}

function payoutFor(symbol: SymbolId, count: number): number {
  const row = PAYTABLE[symbol];
  if (!row) return 0;
  return row[count] ?? 0;
}

export interface LineEval {
  symbol: SymbolId;
  count: number;
  payout: number;
}

export function evaluateLine(lineSymbols: SymbolId[]): LineEval | null {
  const runOf = (target: SymbolId): number => {
    let c = 0;
    for (const s of lineSymbols) {
      if (s === target || s === WILD) c++;
      else break;
    }
    return c;
  };

  const candidates: LineEval[] = [];

  let base: SymbolId = -1;
  for (const s of lineSymbols) {
    if (s !== WILD && s !== SCAT) {
      base = s;
      break;
    }
  }
  if (base >= 0) {
    const count = runOf(base);
    candidates.push({ symbol: base, count, payout: payoutFor(base, count) });
  }
  const wildRun = runOf(WILD);
  candidates.push({ symbol: WILD, count: wildRun, payout: payoutFor(WILD, wildRun) });

  let best: LineEval | null = null;
  for (const cand of candidates) {
    if (cand.payout > 0 && (best === null || cand.payout > best.payout)) best = cand;
  }
  return best;
}

export function countScatters(grid: Grid): number {
  let n = 0;
  for (let reel = 0; reel < grid.length; reel++) {
    for (let row = 0; row < grid[reel].length; row++) {
      if (grid[reel][row] === SCAT) n++;
    }
  }
  return n;
}

export function evaluateSpin(grid: Grid): SpinResult {
  const lineWins: LineWin[] = [];
  let totalPayout = 0;
  for (let i = 0; i < PAYLINES.length; i++) {
    const line = PAYLINES[i];
    const symbols = line.map((row, reel) => grid[reel][row]);
    const win = evaluateLine(symbols);
    if (win) {
      lineWins.push({ lineIndex: i, symbol: win.symbol, count: win.count, payout: win.payout });
      totalPayout += win.payout;
    }
  }

  const scatters = countScatters(grid);
  const tier = Math.min(scatters, 5);
  const scatterPay = scatters >= SCATTER_MIN ? (SCATTER_PAY[tier] ?? 0) * SETTINGS.activeLines : 0;
  const freeSpins = scatters >= SCATTER_MIN ? (FREE_SPINS_AWARD[tier] ?? 0) : 0;
  return { grid, lineWins, totalPayout, scatters, scatterPay, freeSpins };
}

export function spin(rng: Rng, strips: SymbolId[][] = REEL_STRIPS): SpinResult {
  return evaluateSpin(spinGrid(rng, strips));
}

export function countWilds(grid: Grid): number {
  let n = 0;
  for (let reel = 0; reel < grid.length; reel++) {
    for (let row = 0; row < grid[reel].length; row++) {
      if (grid[reel][row] === WILD) n++;
    }
  }
  return n;
}

export function wildStrikeMultiplier(grid: Grid): number {
  const wilds = countWilds(grid);
  if (wilds < WILD_STRIKE.minWilds) return 1;
  return Math.min(wilds, WILD_STRIKE.maxMultiplier);
}
