import { createRng } from './rng.js';
import { buildStrips, evaluateSpin, spinGrid, winningCellsByReel } from './engine.js';
import { runFreeSpins, scatterCount, scatterWinX, wildStrikeMultiplier } from './features.js';
import type { Grid, SlotMathConfig } from './types.js';

/**
 * Stake-style outcome books. The math is generated offline and becomes the
 * source of truth: the RGS samples a lookup row by weight, returns the matching
 * book's events, and the frontend only plays them back (never recomputes pay).
 * Money convention: payoutMultiplier is a multiple of TOTAL bet, ×100 as an int.
 */

export interface RevealEvent {
  index: number;
  type: 'reveal';
  board: Grid;
}
export interface WinEvent {
  index: number;
  type: 'winInfo';
  wins: { lineIndex: number; symbol: number; count: number; amountX100: number }[];
  cellsByReel: number[][];
}
export interface TotalWinEvent {
  index: number;
  type: 'setTotalWin';
  amountX100: number;
}
export interface FreeSpinsEvent {
  index: number;
  type: 'freeSpins';
  /** Each free spin: its board + win as a multiple of TOTAL bet, ×100. */
  steps: { board: Grid; winX100: number }[];
}
export type GameEvent = RevealEvent | WinEvent | TotalWinEvent | FreeSpinsEvent;

export interface BookRow {
  id: number;
  /** Win as a multiple of total bet, ×100 (integer). 0 on a loss. */
  payoutMultiplier: number;
  events: GameEvent[];
}

export interface LookupRow {
  simIdx: number;
  weight: number;
  payoutMultiplierX100: number;
}

export interface ModeManifest {
  name: string;
  cost: number;
  events: string;
  weights: string;
  rtp: number;
}

export interface OutcomeBooks {
  mode: string;
  cost: number;
  books: BookRow[];
  lookup: LookupRow[];
  /** RTP recomputed from the generated artifacts (the figure that ships). */
  rtp: number;
}

export interface GenerateOptions {
  mode?: string;
  cost?: number;
  count: number;
  seed?: number;
  /** Buy-mode books: every round is a free-spins sequence of this many spins. */
  forceFreeSpins?: number;
}

/**
 * Simulate `count` ROUND-COMPLETE outcomes into a weighted outcome book + lookup
 * table. Each round = base lines × WILD STRIKE + scatter pay + any scatter-triggered
 * free spins, capped at maxWinX. The book's events are everything the frontend needs
 * to play the round back; payoutMultiplier (×100) is the locked total it credits.
 */
export function generateOutcomeBooks(config: SlotMathConfig, opts: GenerateOptions): OutcomeBooks {
  const { mode = 'base', cost = 1, count, seed = 0x12345, forceFreeSpins } = opts;
  const lines = config.paylines.length;
  const strips = buildStrips(config);
  const rng = createRng(seed);

  const books: BookRow[] = [];
  const lookup: LookupRow[] = [];
  let weighted = 0;

  for (let i = 0; i < count; i++) {
    const id = i + 1;

    if (forceFreeSpins) {
      const fs = runFreeSpins(rng, config, forceFreeSpins, strips);
      let roundX = fs.totalX;
      if (config.maxWinX !== undefined) roundX = Math.min(roundX, config.maxWinX);
      const pm = Math.round(roundX * 100);
      const evs: GameEvent[] = [
        {
          index: 0,
          type: 'freeSpins',
          steps: fs.steps.map((s) => ({ board: s.grid, winX100: Math.round(s.winX * 100) })),
        },
        { index: 1, type: 'setTotalWin', amountX100: pm },
      ];
      books.push({ id, payoutMultiplier: pm, events: evs });
      lookup.push({ simIdx: id, weight: 1, payoutMultiplierX100: pm });
      weighted += pm;
      continue;
    }

    const grid = spinGrid(rng, config, strips);
    const r = evaluateSpin(grid, config);
    const wsMult = wildStrikeMultiplier(grid, config);
    const scX = scatterWinX(grid, config);
    let roundX = (r.totalPayout * wsMult) / lines + scX;

    const events: GameEvent[] = [{ index: 0, type: 'reveal', board: grid }];
    if (r.lineWins.length) {
      events.push({
        index: events.length,
        type: 'winInfo',
        wins: r.lineWins.map((w) => ({
          lineIndex: w.lineIndex,
          symbol: w.symbol,
          count: w.count,
          amountX100: Math.round((w.payout * wsMult * 100) / lines),
        })),
        cellsByReel: winningCellsByReel(r, config),
      });
    }

    const award = config.scatter?.triggers?.[scatterCount(grid, config)];
    if (config.feature && award) {
      const fs = runFreeSpins(rng, config, award, strips);
      roundX += fs.totalX;
      events.push({
        index: events.length,
        type: 'freeSpins',
        steps: fs.steps.map((s) => ({ board: s.grid, winX100: Math.round(s.winX * 100) })),
      });
    }

    if (config.maxWinX !== undefined) roundX = Math.min(roundX, config.maxWinX);
    const payoutMultiplier = Math.round(roundX * 100);
    events.push({ index: events.length, type: 'setTotalWin', amountX100: payoutMultiplier });

    books.push({ id, payoutMultiplier, events });
    lookup.push({ simIdx: id, weight: 1, payoutMultiplierX100: payoutMultiplier });
    weighted += payoutMultiplier;
  }

  return { mode, cost, books, lookup, rtp: weighted / 100 / count };
}

/** RTP implied by a lookup table (the artifact-weighted figure Stake verifies). */
export function rtpFromLookup(lookup: LookupRow[]): number {
  let w = 0;
  let p = 0;
  for (const row of lookup) {
    w += row.weight;
    p += row.weight * row.payoutMultiplierX100;
  }
  return w === 0 ? 0 : p / w / 100;
}

export function toLookupCsv(lookup: LookupRow[]): string {
  return lookup.map((r) => `${r.simIdx},${r.weight},${r.payoutMultiplierX100}`).join('\n') + '\n';
}

export function toBooksJsonl(books: BookRow[]): string {
  return books.map((b) => JSON.stringify(b)).join('\n') + '\n';
}

export function buildIndex(modes: { books: OutcomeBooks; idx?: number }[]): {
  modes: ModeManifest[];
} {
  return {
    modes: modes.map(({ books, idx = 0 }) => ({
      name: books.mode,
      cost: books.cost,
      events: `books_${books.mode}_${idx}.jsonl`,
      weights: `lookUpTable_${books.mode}_${idx}.csv`,
      // RTP for a mode = mean win / its cost (base cost = 1).
      rtp: rtpFromLookup(books.lookup) / (books.cost || 1),
    })),
  };
}
