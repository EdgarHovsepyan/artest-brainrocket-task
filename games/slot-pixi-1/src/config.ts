import type { SlotMathConfig } from '@artest/math-core';

/** WILD STRIKE — ARTEST flagship. 5×3, 10 lines, Scatter (id 9) triggers free
 *  spins with a ×2.5 multiplier + retrigger. Tuned ≈ base 73% + feature 24% ≈ 97%. */
export const SCATTER = 9;

export const SLOT_CONFIG: SlotMathConfig = {
  reels: 5,
  rows: 3,
  wildId: 0,
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
    9: 3,
  })),
  scatter: { id: SCATTER, pays: { 3: 2, 4: 8, 5: 40 }, triggers: { 3: 10, 4: 12, 5: 15 } },
  feature: { multiplier: 2.5, retriggerScatters: 3, retriggerSpins: 5, cap: 60 },
  maxWinX: 5000,
};

/** Buy-feature: jump straight to the free-spins entry. Cost anchored to ~96% by
 *  tools/sim.ts (solveBuyCost = mean feature win / 0.96). */
export const BUY = { startSpins: 10, costMultiple: 20.38 };

/** Per-symbol display (glyph + accent colour) — all-Graphics, no art assets. */
export const SYMBOL_STYLE: Record<number, { glyph: string; color: number }> = {
  0: { glyph: 'WILD', color: 0xeaff00 },
  1: { glyph: 'A', color: 0xff5d3c },
  2: { glyph: 'K', color: 0xffb000 },
  3: { glyph: 'Q', color: 0xffe14d },
  4: { glyph: 'J', color: 0xb06cff },
  5: { glyph: '10', color: 0x3cc8ff },
  6: { glyph: '9', color: 0x46e6a0 },
  7: { glyph: '8', color: 0x6ea8ff },
  8: { glyph: '7', color: 0x9ad1ff },
  9: { glyph: '✦', color: 0xff3cac },
};

/** Brand palette + motion tokens (industrial brutalism, acid on jet). */
export const THEME = {
  bg: 0x070709,
  ink: 0x0a0a08,
  acid: 0xeaff00,
  plate: 0x12120e,
  plateEdge: 0x3c4028,
  muted: 0x96968a,
  white: 0xffffff,
  scatter: 0xff3cac,
} as const;
