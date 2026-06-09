// DATA-DRIVEN game definition. Everything the math depends on lives here as data.
// Tuning the game (paytable, lines, reel composition, RTP target) = editing this file,
// never the engine code.

import { SymbolId } from './types';

/** Named symbol IDs (from the spec). */
export const SYMBOLS = {
  WILD: 0,
  H1: 1,
  H2: 2,
  H3: 3,
  H4: 4,
  L1: 5,
  L2: 6,
  L3: 7,
  L4: 8,
  L5: 9,
} as const;

/** Human-readable names, for logs / debug overlays. */
export const SYMBOL_NAMES: Record<SymbolId, string> = {
  0: 'Wild',
  1: 'H1',
  2: 'H2',
  3: 'H3',
  4: 'H4',
  5: 'L1',
  6: 'L2',
  7: 'L3',
  8: 'L4',
  9: 'L5',
};

/** Grid dimensions. */
export const GRID = { reels: 5, rows: 3 } as const;

/**
 * Paytable: payout per [symbol][matchCount], matchCount in {3,4,5}.
 * Values are in line-bet multiples, EXACTLY as given in the BrainRocket spec —
 * not altered to chase an RTP number (the spec fixes the paytable; RTP is shaped
 * via REEL_WEIGHTS only).
 */
export const PAYTABLE: Record<SymbolId, Record<number, number>> = {
  0: { 5: 2000, 4: 1000, 3: 100 }, // Wild
  1: { 5: 1000, 4: 500, 3: 50 }, // H1
  2: { 5: 750, 4: 150, 3: 20 }, // H2
  3: { 5: 500, 4: 100, 3: 15 }, // H3
  4: { 5: 500, 4: 100, 3: 15 }, // H4
  5: { 5: 250, 4: 75, 3: 10 }, // L1
  6: { 5: 150, 4: 50, 3: 5 }, // L2
  7: { 5: 150, 4: 25, 3: 5 }, // L3
  8: { 5: 150, 4: 25, 3: 5 }, // L4
  9: { 5: 100, 4: 15, 3: 5 }, // L5
};

/**
 * 10 paylines. Each entry is the row index (0=top, 1=middle, 2=bottom)
 * for reels 0..4. Wins pay left-to-right.
 */
export const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], // 1  middle
  [0, 0, 0, 0, 0], // 2  top
  [2, 2, 2, 2, 2], // 3  bottom
  [0, 1, 2, 1, 0], // 4  V
  [2, 1, 0, 1, 2], // 5  ^
  [0, 0, 1, 2, 2], // 6
  [2, 2, 1, 0, 0], // 7
  [1, 0, 0, 0, 1], // 8
  [1, 2, 2, 2, 1], // 9
  [2, 1, 2, 1, 2], // 10 zigzag
];

/**
 * Reel composition as symbol weights (counts on each reel strip).
 * This is the SINGLE RTP / hit-frequency tuning surface — the paytable above is
 * fixed by the spec, so all math shaping happens here. buildStrip spreads these
 * counts EVENLY around the strip (see spin-engine.ts) — not in blocks — which is
 * what makes small wins land on many spins instead of clustering.
 *
 * At these weights: base lines ≈ 73% + WILD STRIKE ≈ 24% → RTP ≈ 97% at a ~22%
 * hit frequency (`npm run sim`). Wild density is the master lever — it drives both
 * base substitution AND the WILD STRIKE tail, so wilds are kept rare (3/strip).
 * The spec paytable is never touched — only these counts shape RTP.
 */
export const REEL_WEIGHTS: Record<SymbolId, number>[] = [
  { 0: 3, 1: 5, 2: 6, 3: 8, 4: 8, 5: 6, 6: 9, 7: 9, 8: 9, 9: 10 }, // reel 1
  { 0: 3, 1: 5, 2: 6, 3: 8, 4: 8, 5: 6, 6: 9, 7: 9, 8: 9, 9: 10 }, // reel 2
  { 0: 3, 1: 5, 2: 6, 3: 8, 4: 8, 5: 6, 6: 9, 7: 9, 8: 9, 9: 10 }, // reel 3
  { 0: 3, 1: 5, 2: 6, 3: 8, 4: 8, 5: 6, 6: 9, 7: 9, 8: 9, 9: 10 }, // reel 4
  { 0: 3, 1: 5, 2: 6, 3: 8, 4: 8, 5: 6, 6: 9, 7: 9, 8: 9, 9: 10 }, // reel 5
];

/** Tunable game settings (no magic numbers in engine code). */
export const SETTINGS = {
  /** Total bet = one line-bet per active payline (10 lines, all always active). */
  activeLines: PAYLINES.length,
} as const;

/**
 * WILD STRIKE base-game feature: when >= minWilds Wilds land anywhere on the
 * grid, the spin's line wins are multiplied by the wild count (capped). Reel
 * weights are tuned so BASE + WILD STRIKE lands ≈96%.
 */
export const WILD_STRIKE = {
  minWilds: 3,
  maxMultiplier: 3,
} as const;

/** Buy-Feature bonus mode ids. */
export type BonusMode = 'wilds' | 'crowns' | 'reels';

/**
 * Buy-Feature modes. `cost` is the price as a multiple of TOTAL bet, anchored by
 * simulation (cost = mean_payout / rtpAnchor) so each buy returns ≈96%.
 * Re-anchor with `npm run sim:bonus` whenever the reels change.
 */
export const BONUS_MODES: Record<BonusMode, { name: string; spins: number; cost: number }> = {
  // costs anchored to ~96% by tools/bonus-sim.ts (500k buys each).
  // 2026-06-09 — `wilds` is now STICKY (wilds persist + bounce, were respinning).
  // Re-anchored to ~96% via `npm run sim:bonus` (1M buys): mean 106.25×bet → 110.68.
  wilds: { name: 'STICKY WILDS', spins: 8, cost: 110.68 },
  crowns: { name: 'STICKY CROWNS', spins: 8, cost: 96.99 },
  reels: { name: 'WILD REELS', spins: 8, cost: 33.64 },
};
