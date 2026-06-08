import type { Rng } from './rng.js';
import type {
  Grid,
  LineWin,
  Paytable,
  ReelWeights,
  SlotMathConfig,
  SpinResult,
  SymbolId,
} from './types.js';

/**
 * Expand a reel's weight map into a concrete strip, spreading each symbol's
 * copies EVENLY around the strip (not in contiguous blocks). The visible window
 * is a few consecutive cells, so an even spread keeps per-line odds identical
 * while letting small wins land on more spins (higher hit frequency). Fully
 * deterministic: copy k of a symbol sits at (k + 0.5) / count, ties broken by id.
 */
export function buildStrip(weights: ReelWeights): SymbolId[] {
  const slots: { pos: number; symbol: SymbolId }[] = [];
  for (const key of Object.keys(weights)) {
    const symbol = Number(key);
    const count = weights[symbol];
    for (let i = 0; i < count; i++) slots.push({ pos: (i + 0.5) / count, symbol });
  }
  slots.sort((a, b) => a.pos - b.pos || a.symbol - b.symbol);
  return slots.map((s) => s.symbol);
}

export function buildStrips(config: SlotMathConfig): SymbolId[][] {
  return config.reelWeights.map(buildStrip);
}

/** Spin all reels: pick a random stop per reel and read a `rows`-tall window. */
export function spinGrid(rng: Rng, config: SlotMathConfig, strips = buildStrips(config)): Grid {
  const grid: Grid = [];
  for (let reel = 0; reel < config.reels; reel++) {
    const strip = strips[reel];
    const stop = rng.int(strip.length);
    const column: SymbolId[] = [];
    for (let row = 0; row < config.rows; row++) column.push(strip[(stop + row) % strip.length]);
    grid.push(column);
  }
  return grid;
}

function payoutFor(paytable: Paytable, symbol: SymbolId, count: number): number {
  return paytable[symbol]?.[count] ?? 0;
}

export interface LineEval {
  symbol: SymbolId;
  count: number;
  payout: number;
}

/**
 * Evaluate one payline (its `reels` left-to-right symbols). Wild substitutes for
 * any symbol; the better of the first-non-wild run and the pure-Wild run pays.
 */
export function evaluateLine(
  lineSymbols: SymbolId[],
  paytable: Paytable,
  wildId: SymbolId,
): LineEval | null {
  const runOf = (target: SymbolId): number => {
    let c = 0;
    for (const s of lineSymbols) {
      if (s === target || s === wildId) c++;
      else break;
    }
    return c;
  };

  const candidates: LineEval[] = [];
  const base = lineSymbols.find((s) => s !== wildId);
  if (base !== undefined) {
    const count = runOf(base);
    candidates.push({ symbol: base, count, payout: payoutFor(paytable, base, count) });
  }
  const wildRun = runOf(wildId);
  candidates.push({ symbol: wildId, count: wildRun, payout: payoutFor(paytable, wildId, wildRun) });

  let best: LineEval | null = null;
  for (const c of candidates) if (c.payout > 0 && (!best || c.payout > best.payout)) best = c;
  return best;
}

/** Evaluate all paylines on a grid. */
export function evaluateSpin(grid: Grid, config: SlotMathConfig): SpinResult {
  const lineWins: LineWin[] = [];
  let totalPayout = 0;
  for (let i = 0; i < config.paylines.length; i++) {
    const line = config.paylines[i];
    const symbols = line.map((row, reel) => grid[reel][row]);
    const win = evaluateLine(symbols, config.paytable, config.wildId);
    if (win) {
      lineWins.push({ lineIndex: i, symbol: win.symbol, count: win.count, payout: win.payout });
      totalPayout += win.payout;
    }
  }
  return { grid, lineWins, totalPayout };
}

/** Spin + evaluate in one call. */
export function spin(rng: Rng, config: SlotMathConfig, strips = buildStrips(config)): SpinResult {
  return evaluateSpin(spinGrid(rng, config, strips), config);
}

/** Rows-per-reel that take part in any win: out[reel] = [row, ...]. For highlighting. */
export function winningCellsByReel(result: SpinResult, config: SlotMathConfig): number[][] {
  const byReel: number[][] = Array.from({ length: config.reels }, () => []);
  for (const win of result.lineWins) {
    const line = config.paylines[win.lineIndex];
    for (let reel = 0; reel < win.count; reel++) {
      const row = line[reel];
      if (!byReel[reel].includes(row)) byReel[reel].push(row);
    }
  }
  return byReel;
}
