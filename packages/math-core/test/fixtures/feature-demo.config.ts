import type { SlotMathConfig } from '../../src/types.js';

/**
 * A feature-slot fixture (ARTEST numbers) exercising the advanced math: a Wild
 * (id 0), eight line symbols (1–8), and a Scatter (id 9) that pays from anywhere
 * and triggers free spins with a multiplier + retrigger. Demonstrates the same
 * shape as a SHINING-POP-class game without copying any locked third-party math.
 *
 * Tuned so base ≈ 73% leaves headroom for the feature ≈ 24% → TOTAL ≈ 96.8% at a
 * ~26% hit frequency (a real feature-slot RTP split — `simulate(..., {includeFeatures:true})`).
 */
export const SCATTER = 9;

export const FEATURE_DEMO_CONFIG: SlotMathConfig = {
  reels: 5,
  rows: 3,
  wildId: 0,
  paytable: {
    0: { 3: 100, 4: 1000, 5: 2000 }, // Wild
    1: { 3: 50, 4: 500, 5: 1000 },
    2: { 3: 20, 4: 150, 5: 750 },
    3: { 3: 15, 4: 100, 5: 500 },
    4: { 3: 15, 4: 100, 5: 500 },
    5: { 3: 10, 4: 75, 5: 250 },
    6: { 3: 5, 4: 50, 5: 150 },
    7: { 3: 5, 4: 25, 5: 150 },
    8: { 3: 5, 4: 25, 5: 150 },
    // 9 = Scatter: no line pay.
  },
  paylines: [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
    [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0],
    [2, 1, 0, 1, 2],
    [0, 0, 1, 2, 2],
    [2, 2, 1, 0, 0],
    [1, 0, 0, 0, 1],
    [1, 2, 2, 2, 1],
    [2, 1, 2, 1, 2],
  ],
  reelWeights: Array.from({ length: 5 }, () => ({
    0: 3,
    1: 5,
    2: 6,
    3: 8,
    4: 8,
    5: 10,
    6: 13,
    7: 13,
    8: 14,
    9: 3, // scatter — rare
  })),
  scatter: {
    id: SCATTER,
    pays: { 3: 2, 4: 8, 5: 40 },
    triggers: { 3: 10, 4: 12, 5: 15 },
  },
  feature: {
    multiplier: 2.5,
    retriggerScatters: 3,
    retriggerSpins: 5,
    cap: 60,
  },
  maxWinX: 5000,
};
