// Monte-Carlo anchoring for Buy-Feature costs. For each mode, the fair price is
// mean_feature_win / rtpAnchor (so a player who buys gets back ~anchor on average).
// Run:  npm run sim:bonus [buys]

import { createRng } from '../assets/scripts/logic/rng';
import { runFreeSpins } from '../assets/scripts/logic/bonus-engine';
import { BONUS_MODES, BonusMode, SETTINGS } from '../assets/scripts/logic/game-config';

const buys = Number(process.argv[2] ?? 1_000_000);
const anchor = 0.96;
const lines = SETTINGS.activeLines;
const rng = createRng(0x1234);

console.log('='.repeat(58));
console.log(`Buys/mode: ${buys.toLocaleString()}   anchor RTP: ${(anchor * 100).toFixed(0)}%`);
console.log('-'.repeat(58));
console.log('mode             meanWin(xBet)   fairCost   current');
for (const mode of Object.keys(BONUS_MODES) as BonusMode[]) {
  let total = 0;
  for (let i = 0; i < buys; i++)
    total += runFreeSpins(rng, mode, BONUS_MODES[mode].spins).totalPayout;
  const meanWinX = total / buys / lines;
  const fairCost = meanWinX / anchor;
  console.log(
    `${mode.padEnd(16)} ${meanWinX.toFixed(2).padStart(10)}   ${fairCost.toFixed(2).padStart(8)}   ${String(BONUS_MODES[mode].cost).padStart(7)}`,
  );
}
console.log('='.repeat(58));
