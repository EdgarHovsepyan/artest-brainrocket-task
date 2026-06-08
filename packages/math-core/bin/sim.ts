/** Monte-Carlo RTP demo over the BrainRocket fixture.
 *  Usage: pnpm --filter @artest/math-core sim [spins] [seed] */
import { simulate } from '../src/index.js';
import { BRAINROCKET_CONFIG } from '../test/fixtures/brainrocket.config.js';

const spins = Number(process.argv[2] ?? 2_000_000);
const seed = process.argv[3] !== undefined ? Number(process.argv[3]) : 0x9e3779b9;

const r = simulate(BRAINROCKET_CONFIG, spins, seed);

console.log('='.repeat(44));
console.log(`spins        ${r.spins.toLocaleString()}`);
console.log(`strip length ${r.stripLength}`);
console.log(`bet/spin     ${r.betPerSpin} line-bet units`);
console.log('-'.repeat(44));
console.log(`RTP          ${(r.rtp * 100).toFixed(3)} %`);
console.log(`hit freq     ${(r.hitFrequency * 100).toFixed(2)} %`);
console.log(`max win      ${r.maxWinX.toFixed(1)} × total bet`);
console.log('='.repeat(44));
