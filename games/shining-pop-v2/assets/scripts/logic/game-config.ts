import { SymbolId } from './types';

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

export const SYMBOL_NAMES: Record<SymbolId, string> = {
  0: 'Wild',
  1: 'H1',
  2: 'H2',
  3: 'H3',
  4: 'H4',
  5: 'L1',
  6: 'L2',
  7: 'L3',
  8: 'Scat',
  9: 'L5',
};

export const GRID = { reels: 5, rows: 3 } as const;

export const PAYTABLE: Record<SymbolId, Record<number, number>> = {
  0: { 5: 2000, 4: 1000, 3: 100 },
  1: { 5: 1000, 4: 500, 3: 50 },
  2: { 5: 750, 4: 150, 3: 20 },
  3: { 5: 500, 4: 100, 3: 15 },
  4: { 5: 500, 4: 100, 3: 15 },
  5: { 5: 250, 4: 75, 3: 10 },
  6: { 5: 150, 4: 50, 3: 5 },
  7: { 5: 150, 4: 25, 3: 5 },
  8: { 5: 150, 4: 25, 3: 5 },
  9: { 5: 100, 4: 15, 3: 5 },
};

export const PAYLINES: number[][] = [
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
];

export const REEL_WEIGHTS: Record<SymbolId, number>[] = [
  { 0: 3, 1: 5, 2: 6, 3: 8, 4: 8, 5: 8, 6: 11, 7: 11, 8: 3, 9: 14 },
  { 0: 3, 1: 5, 2: 6, 3: 8, 4: 8, 5: 8, 6: 11, 7: 11, 8: 3, 9: 14 },
  { 0: 3, 1: 5, 2: 6, 3: 8, 4: 8, 5: 8, 6: 11, 7: 11, 8: 3, 9: 14 },
  { 0: 3, 1: 5, 2: 6, 3: 8, 4: 8, 5: 8, 6: 11, 7: 11, 8: 3, 9: 14 },
  { 0: 3, 1: 5, 2: 6, 3: 8, 4: 8, 5: 8, 6: 11, 7: 11, 8: 3, 9: 14 },
];

export const SETTINGS = {
  activeLines: PAYLINES.length,
} as const;

export const WILD_STRIKE = {
  minWilds: 3,
  maxMultiplier: 3,
} as const;

export type BonusMode = 'wilds' | 'crowns' | 'reels';

export const BONUS_MODES: Record<BonusMode, { name: string; spins: number; cost: number }> = {
  wilds: { name: 'STICKY WILDS', spins: 8, cost: 110.68 },
  crowns: { name: 'STICKY CROWNS', spins: 8, cost: 96.99 },
  reels: { name: 'WILD REELS', spins: 8, cost: 33.64 },
};

export const SCATTER = 8;

export const SCATTER_MIN = 3;

export const SCATTER_PAY: Record<number, number> = { 3: 1.5, 4: 6, 5: 30 };

export const FREE_SPINS_AWARD: Record<number, number> = { 3: 3, 4: 6, 5: 10 };

export const SCATTER_FS_MODE: BonusMode = 'wilds';
