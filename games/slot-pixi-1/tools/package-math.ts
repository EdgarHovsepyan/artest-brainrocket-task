// Generate the Stake "Math" upload for this game (index.json + lookUpTable_*.csv +
// books_*.jsonl) into stake-build/back/, and copy the single-file front in.
//   npm run package:math   (or package:stake for the full gated pipeline)

import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMathArtifacts } from '@artest/stake-adapter';
import { SLOT_CONFIG, BUY } from '../src/config';

const game = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const back = resolve(game, 'stake-build/back');
const front = resolve(game, 'stake-build/front');
mkdirSync(back, { recursive: true });
mkdirSync(front, { recursive: true });

const pkg = buildMathArtifacts(SLOT_CONFIG, [
  { name: 'base', cost: 1, count: 200_000, seed: 0x9e3779b9 },
  {
    name: 'buy',
    cost: BUY.costMultiple,
    count: 100_000,
    seed: 0xb0b,
    forceFreeSpins: BUY.startSpins,
  },
]);

writeFileSync(resolve(back, 'index.json'), pkg.indexJson);
for (const f of pkg.files) writeFileSync(resolve(back, f.name), f.content);

const dist = resolve(game, 'dist/index.html');
if (existsSync(dist)) copyFileSync(dist, resolve(front, 'index.html'));

console.log('Stake math written → stake-build/back/');
for (const [mode, rtp] of Object.entries(pkg.rtpByMode)) {
  console.log(`  ${mode.padEnd(6)} RTP ${(rtp * 100).toFixed(2)}%`);
}
