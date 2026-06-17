import { PAYLINES } from './game-config';
import { SpinResult } from './types';

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
