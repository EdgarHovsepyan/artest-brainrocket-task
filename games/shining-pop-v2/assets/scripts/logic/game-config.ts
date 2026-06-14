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
  8: 'Scat', // the rainbow-lollipop SCATTER (pays anywhere + triggers free spins)
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
 * At these weights (2026-06-14, after the SCATTER feature): base lines ≈ 74.8% +
 * WILD STRIKE ≈ 17.3% + SCATTER pay ≈ 2.4% + free spins ≈ 3.2% → RTP ≈ 97.8% at a
 * ~25% hit frequency (`npm run sim`, 2M). The scatter (id 8) was carved out of the
 * line symbols, so the strip was lengthened (low symbols padded) to dilute the base
 * back down and the freed RTP returned through the scatter pay + free-spins trigger
 * (1 in ~75). The spec paytable is never touched — only these counts shape RTP.
 */
export const REEL_WEIGHTS: Record<SymbolId, number>[] = [
  { 0: 3, 1: 5, 2: 6, 3: 8, 4: 8, 5: 8, 6: 11, 7: 11, 8: 3, 9: 14 }, // reel 1
  { 0: 3, 1: 5, 2: 6, 3: 8, 4: 8, 5: 8, 6: 11, 7: 11, 8: 3, 9: 14 }, // reel 2
  { 0: 3, 1: 5, 2: 6, 3: 8, 4: 8, 5: 8, 6: 11, 7: 11, 8: 3, 9: 14 }, // reel 3
  { 0: 3, 1: 5, 2: 6, 3: 8, 4: 8, 5: 8, 6: 11, 7: 11, 8: 3, 9: 14 }, // reel 4
  { 0: 3, 1: 5, 2: 6, 3: 8, 4: 8, 5: 8, 6: 11, 7: 11, 8: 3, 9: 14 }, // reel 5
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

/**
 * SCATTER feature. The rainbow-lollipop (id 8, formerly the L4 line symbol) is a
 * true SCATTER: it pays ANYWHERE on the grid (not on paylines) and, at SCATTER_MIN+,
 * triggers a free-spins run. Its art literally says "SCATTER", so the symbol now
 * matches its art (the previous bug: a SCATTER-labelled symbol that paid like a
 * normal low line symbol, so players saw "scatters" that never did anything).
 *
 * RTP: id 8 was removed from line eligibility (it was ~5% base RTP), and that
 * budget is returned via the scatter pay + the free-spins trigger. Reel weight for
 * id 8 controls trigger frequency. Re-tuned + verified to ~97% via `npm run sim`.
 * The scatter never substitutes and never forms a line (see spin-engine).
 */
export const SCATTER = 8;
/** Minimum scatters anywhere on the 5×3 grid to pay + trigger free spins. */
export const SCATTER_MIN = 3;
/** Scatter pay by scatter count, in TOTAL-bet multiples (independent of WILD STRIKE
 *  and of paylines — a flat scatter pay credited on top of any line win). */
export const SCATTER_PAY: Record<number, number> = { 3: 1.5, 4: 6, 5: 30 };
/** Free spins awarded by scatter count. Played out via runScatterFreeSpins (plain
 *  base spins). Sized to the trigger frequency so the freed base-RTP budget returns
 *  WITHOUT ballooning — re-tuned to ~97% via `npm run sim`. */
export const FREE_SPINS_AWARD: Record<number, number> = { 3: 3, 4: 6, 5: 10 };
/** The free-spins mechanic a scatter trigger plays. STICKY WILDS = the headline
 *  feature, so scatters lead into the game's best free-spins mode. */
export const SCATTER_FS_MODE: BonusMode = 'wilds';
