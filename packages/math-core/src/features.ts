import type { Rng } from './rng.js';
import { createRng } from './rng.js';
import { buildStrips, evaluateSpin, spinGrid } from './engine.js';
import type { Grid, SlotMathConfig, SymbolId } from './types.js';

/** Count a symbol across the whole grid. */
export function countSymbol(grid: Grid, id: SymbolId): number {
  let n = 0;
  for (const col of grid) for (const s of col) if (s === id) n++;
  return n;
}

export function scatterCount(grid: Grid, config: SlotMathConfig): number {
  return config.scatter ? countSymbol(grid, config.scatter.id) : 0;
}

/** WILD STRIKE multiplier for a grid (1 when inactive/untriggered). */
export function wildStrikeMultiplier(grid: Grid, config: SlotMathConfig): number {
  const ws = config.wildStrike;
  if (!ws) return 1;
  const wilds = countSymbol(grid, config.wildId);
  if (wilds < ws.minWilds) return 1;
  const m = ws.multiplier === 'count' ? wilds : ws.multiplier;
  return ws.maxMultiplier ? Math.min(m, ws.maxMultiplier) : m;
}

/** Scatter pay for a grid, as a multiple of TOTAL bet. */
export function scatterWinX(grid: Grid, config: SlotMathConfig): number {
  if (!config.scatter?.pays) return 0;
  return config.scatter.pays[scatterCount(grid, config)] ?? 0;
}

/** Line win for a spin as a multiple of TOTAL bet (paytable is in line-bet units). */
export function lineWinX(linePayout: number, config: SlotMathConfig): number {
  return linePayout / config.paylines.length;
}

export interface FreeSpinStep {
  grid: Grid;
  /** Win this step as a multiple of TOTAL bet (line × feature multiplier + scatter). */
  winX: number;
  retriggered: boolean;
}

export interface FreeSpinsResult {
  steps: FreeSpinStep[];
  spinsPlayed: number;
  /** Total feature win as a multiple of TOTAL bet (capped by config.maxWinX). */
  totalX: number;
}

/** Run a free-spins sequence: line wins × feature multiplier + scatter pays, with
 *  retrigger and a hard spin cap. Deterministic given the RNG. */
export function runFreeSpins(
  rng: Rng,
  config: SlotMathConfig,
  startSpins: number,
  strips = buildStrips(config),
): FreeSpinsResult {
  const f = config.feature;
  const mult = f?.multiplier ?? 1;
  const cap = f?.cap ?? startSpins;
  const steps: FreeSpinStep[] = [];
  let spins = Math.min(startSpins, cap);
  let played = 0;
  let totalX = 0;

  while (spins > 0 && played < cap) {
    const grid = spinGrid(rng, config, strips);
    const res = evaluateSpin(grid, config);
    const winX = lineWinX(res.totalPayout, config) * mult + scatterWinX(grid, config);

    let retriggered = false;
    if (f && f.retriggerScatters > 0 && scatterCount(grid, config) >= f.retriggerScatters) {
      spins = Math.min(spins + f.retriggerSpins, cap - played);
      retriggered = true;
    }

    steps.push({ grid, winX, retriggered });
    totalX += winX;
    spins--;
    played++;

    if (config.maxWinX !== undefined && totalX >= config.maxWinX) {
      totalX = config.maxWinX;
      break;
    }
  }

  return { steps, spinsPlayed: played, totalX };
}

export interface BuyCostOptions {
  /** Free spins the bought feature awards. */
  startSpins: number;
  /** Target RTP the buy should return (e.g. 0.96). */
  anchorRtp: number;
  sims?: number;
  seed?: number;
}

/**
 * Fair buy-feature cost as a multiple of TOTAL bet: cost = mean_feature_win / anchorRtp,
 * estimated by Monte-Carlo so a player who buys gets back `anchorRtp` on average.
 */
export function solveBuyCost(config: SlotMathConfig, opts: BuyCostOptions): number {
  const { startSpins, anchorRtp, sims = 200_000, seed = 0xb0b } = opts;
  const strips = buildStrips(config);
  const rng = createRng(seed);
  let total = 0;
  for (let i = 0; i < sims; i++) total += runFreeSpins(rng, config, startSpins, strips).totalX;
  return total / sims / anchorRtp;
}

export type WinTier = 'none' | 'returned' | 'win' | 'nice' | 'big' | 'mega' | 'epic';

const DEFAULT_TIER_STEPS: [number, number, number, number, number] = [1, 3, 10, 50, 250];

/** Classify a round win (as a multiple of total bet) into a ceremony tier. */
export function classifyWinTier(
  winX: number,
  steps: [number, number, number, number, number] = DEFAULT_TIER_STEPS,
): WinTier {
  if (winX <= 0) return 'none';
  if (winX <= steps[0]) return 'returned';
  if (winX < steps[1]) return 'win';
  if (winX < steps[2]) return 'nice';
  if (winX < steps[3]) return 'big';
  if (winX < steps[4]) return 'mega';
  return 'epic';
}
