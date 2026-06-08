// RTP sign-off for the flagship: full RTP (base lines + scatter + free spins) and
// the fair buy-feature cost. Runs the same @artest/math-core the game runs.
//   npm run sim [spins]

import { simulate, solveBuyCost } from '@artest/math-core';
import { SLOT_CONFIG, BUY } from '../src/config';

const spins = Number(process.argv[2] ?? 2_000_000);
const r = simulate(SLOT_CONFIG, spins, 0x9e3779b9, { includeFeatures: true });
const buyCost = solveBuyCost(SLOT_CONFIG, {
  startSpins: BUY.startSpins,
  anchorRtp: 0.96,
  sims: 200_000,
});

console.log('='.repeat(48));
console.log(`spins        ${r.spins.toLocaleString()}`);
console.log(`RTP total    ${(r.rtp * 100).toFixed(2)} %`);
console.log(`  ├─ base    ${(r.baseRtp * 100).toFixed(2)} %`);
console.log(`  └─ feature ${(r.featureRtp * 100).toFixed(2)} %`);
console.log(`hit freq     ${(r.hitFrequency * 100).toFixed(2)} %`);
console.log(`max win      ${r.maxWinX.toFixed(0)} × total bet`);
console.log('-'.repeat(48));
console.log(`buy cost     ${buyCost.toFixed(2)} × bet  (config: ${BUY.costMultiple})`);
console.log('='.repeat(48));
