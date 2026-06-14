// Pure spin engine: builds reel strips, spins, and evaluates line wins.
// NO Cocos imports — fully testable and RTP-simulatable outside the editor.

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

/**
 * Expand a reel's symbol-weight map into a concrete strip, spreading each
 * symbol's copies EVENLY around the strip instead of in one contiguous block.
 *
 * Why even spacing matters: the visible window is 3 consecutive strip cells, so
 * a blocked strip ([5,5,5,5,5,6,6,6,...]) shows the same symbol stacked on most
 * spins. That clusters every payout into rare "it all lines up" spins — low hit
 * frequency, streaky play. An even spread keeps the per-line odds (and therefore
 * base RTP) identical while letting small wins land on far more spins, which is
 * what lifts hit frequency. Each copy k of a symbol with `count` copies is
 * placed at fractional position (k + 0.5) / count; ties break by symbol id so
 * the layout is fully deterministic — runtime strips match the RTP simulations.
 */
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

/** Concrete reel strips, derived from the data-driven weights. */
export const REEL_STRIPS: SymbolId[][] = REEL_WEIGHTS.map(buildStrip);

/** Spin all reels: pick a random stop per reel and read a 3-symbol window. */
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

/**
 * Evaluate one payline given its 5 left-to-right symbols.
 * Wild substitutes for any symbol. We consider both the "first non-wild symbol"
 * interpretation (wilds extend that symbol's run) and the pure-Wild run, then
 * keep whichever pays more — the standard left-aligned slot rule.
 */
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

  // The SCATTER is NOT a line symbol: it never anchors a run and never substitutes,
  // so it can't be the line's base (and, being neither base nor WILD, it naturally
  // BREAKS any run it sits in — the left-aligned rule then kills lines it blocks).
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

/** Count SCATTER symbols anywhere on the grid. */
export function countScatters(grid: Grid): number {
  let n = 0;
  for (let reel = 0; reel < grid.length; reel++) {
    for (let row = 0; row < grid[reel].length; row++) {
      if (grid[reel][row] === SCAT) n++;
    }
  }
  return n;
}

/** Evaluate all paylines on a grid + the scatter pay / free-spins trigger. */
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
  // SCATTER pay (anywhere) — flat, NOT multiplied by WILD STRIKE or by paylines.
  // SCATTER_PAY is in total-bet multiples; convert to line-bet units (× active
  // lines) so it composes with the line `totalPayout`, which is in line-bet units.
  const scatters = countScatters(grid);
  const tier = Math.min(scatters, 5);
  const scatterPay = scatters >= SCATTER_MIN ? (SCATTER_PAY[tier] ?? 0) * SETTINGS.activeLines : 0;
  const freeSpins = scatters >= SCATTER_MIN ? (FREE_SPINS_AWARD[tier] ?? 0) : 0;
  return { grid, lineWins, totalPayout, scatters, scatterPay, freeSpins };
}

/** Spin + evaluate in one call. */
export function spin(rng: Rng, strips: SymbolId[][] = REEL_STRIPS): SpinResult {
  return evaluateSpin(spinGrid(rng, strips));
}

/** Count Wild symbols anywhere on the grid. */
export function countWilds(grid: Grid): number {
  let n = 0;
  for (let reel = 0; reel < grid.length; reel++) {
    for (let row = 0; row < grid[reel].length; row++) {
      if (grid[reel][row] === WILD) n++;
    }
  }
  return n;
}

/**
 * WILD STRIKE multiplier: when >= minWilds Wilds land, the spin's line wins are
 * multiplied by the wild count (capped). Returns 1 when untriggered.
 */
export function wildStrikeMultiplier(grid: Grid): number {
  const wilds = countWilds(grid);
  if (wilds < WILD_STRIKE.minWilds) return 1;
  return Math.min(wilds, WILD_STRIKE.maxMultiplier);
}
