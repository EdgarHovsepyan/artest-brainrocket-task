import { createRng } from './rng.js';
import { buildStrips, evaluateSpin, spinGrid } from './engine.js';
import { runFreeSpins, scatterCount, scatterWinX, wildStrikeMultiplier } from './features.js';
import type { SlotMathConfig, SymbolId } from './types.js';

export interface SimReport {
  spins: number;
  /** Total bet = one line-bet per payline. */
  betPerSpin: number;
  /** Return to player (won / wagered). */
  rtp: number;
  /** RTP from base line wins only (no scatter/feature). */
  baseRtp: number;
  /** RTP from scatter pays + triggered free spins (0 if no feature). */
  featureRtp: number;
  /** Share of spins with any base win. */
  hitFrequency: number;
  /** Largest single-round win as a multiple of total bet. */
  maxWinX: number;
  stripLength: number;
  /** RTP contribution per winning symbol id (base lines). */
  rtpBySymbol: Record<SymbolId, number>;
}

export interface SimOptions {
  /** Include scatter pays + scatter-triggered free spins in RTP. */
  includeFeatures?: boolean;
}

/** Monte-Carlo RTP / hit-frequency over the same engine the game runs. */
export function simulate(
  config: SlotMathConfig,
  spins: number,
  seed = 0x9e3779b9,
  opts: SimOptions = {},
): SimReport {
  const strips = buildStrips(config);
  const rng = createRng(seed);
  const lines = config.paylines.length;
  const withFeatures = !!opts.includeFeatures && !!config.scatter;

  let totalBet = 0;
  let baseWin = 0; // line-bet units
  let featureWin = 0; // line-bet units
  let hits = 0;
  let best = 0; // total-bet multiple
  const won: Record<SymbolId, number> = {};

  for (let i = 0; i < spins; i++) {
    totalBet += lines;
    const grid = spinGrid(rng, config, strips);
    const r = evaluateSpin(grid, config);
    const wsMult = wildStrikeMultiplier(grid, config);
    const linePayout = r.totalPayout * wsMult;
    baseWin += linePayout;
    if (r.totalPayout > 0) hits++;
    for (const w of r.lineWins) won[w.symbol] = (won[w.symbol] ?? 0) + w.payout;

    let roundX = linePayout / lines;
    if (withFeatures) {
      const scX = scatterWinX(grid, config);
      let fsX = 0;
      const award = config.scatter!.triggers?.[scatterCount(grid, config)];
      if (config.feature && award) fsX = runFreeSpins(rng, config, award, strips).totalX;
      featureWin += (scX + fsX) * lines;
      roundX += scX + fsX;
    }
    if (roundX > best) best = roundX;
  }

  const rtpBySymbol: Record<SymbolId, number> = {};
  for (const key of Object.keys(won)) rtpBySymbol[Number(key)] = won[Number(key)] / totalBet;

  return {
    spins,
    betPerSpin: lines,
    rtp: (baseWin + featureWin) / totalBet,
    baseRtp: baseWin / totalBet,
    featureRtp: featureWin / totalBet,
    hitFrequency: hits / spins,
    maxWinX: best,
    stripLength: strips[0].length,
    rtpBySymbol,
  };
}
