// Pure helper: which cells are part of a winning line, grouped per reel.
// Used by the View to know what to highlight. NO Cocos imports.

import { PAYLINES } from './game-config';
import { SpinResult } from './types';

/** Returns rows-per-reel that participate in any win: out[reel] = [row, ...]. */
export function winningCellsByReel(result: SpinResult, reels: number): number[][] {
  const byReel: number[][] = Array.from({ length: reels }, () => []);
  for (const win of result.lineWins) {
    const line = PAYLINES[win.lineIndex];
    for (let reel = 0; reel < win.count; reel++) {
      const row = line[reel];
      if (!byReel[reel].includes(row)) byReel[reel].push(row);
    }
  }
  return byReel;
}
