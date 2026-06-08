import type { SlotMathConfig } from '../../src/types.js';

/**
 * The BrainRocket spec game: 5×3, 10 fixed paylines, Wild (id 0) substitutes all.
 * Paytable verbatim from the task PDF; RTP shaped only via reel weights (≈95.6%).
 */
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

export const BRAINROCKET_CONFIG: SlotMathConfig = {
  reels: 5,
  rows: 3,
  wildId: SYMBOLS.WILD,
  paytable: {
    0: { 3: 100, 4: 1000, 5: 2000 },
    1: { 3: 50, 4: 500, 5: 1000 },
    2: { 3: 20, 4: 150, 5: 750 },
    3: { 3: 15, 4: 100, 5: 500 },
    4: { 3: 15, 4: 100, 5: 500 },
    5: { 3: 10, 4: 75, 5: 250 },
    6: { 3: 5, 4: 50, 5: 150 },
    7: { 3: 5, 4: 25, 5: 150 },
    8: { 3: 5, 4: 25, 5: 150 },
    9: { 3: 5, 4: 15, 5: 100 },
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
    0: 4,
    1: 5,
    2: 6,
    3: 8,
    4: 8,
    5: 6,
    6: 9,
    7: 9,
    8: 9,
    9: 11,
  })),
};
