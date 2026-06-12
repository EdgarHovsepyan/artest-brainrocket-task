// Monte-Carlo RTP / hit-frequency simulation — applies WILD STRIKE exactly as
// SlotModel.play() does, so the number it reports is the player-facing RTP.
// Run:  npm run sim [spins] [seed]
//
// This runs the SAME pure engine the game runs (assets/scripts/logic). It lives
// OUTSIDE assets/ so the Cocos editor never imports it.

import { createRng } from '../assets/scripts/logic/rng';
import { spin, REEL_STRIPS, wildStrikeMultiplier } from '../assets/scripts/logic/spin-engine';
import { SETTINGS, SYMBOL_NAMES } from '../assets/scripts/logic/game-config';

const spins = Number(process.argv[2] ?? 2_000_000);
const seed = process.argv[3] !== undefined ? Number(process.argv[3]) : 0x9e3779b9;
const linesPerSpin = SETTINGS.activeLines; // total bet = 1 line-bet × active lines

const rng = createRng(seed);
let totalBet = 0;
let totalWin = 0;
let baseWin = 0;
let hits = 0;
let strikes = 0;
let best = 0;
const bySymbol = new Map<number, number>();

for (let i = 0; i < spins; i++) {
  const r = spin(rng);
  const mult = wildStrikeMultiplier(r.grid);
  const win = r.totalPayout * mult;
  totalBet += linesPerSpin;
  baseWin += r.totalPayout;
  totalWin += win;
  if (r.totalPayout > 0) hits++;
  if (mult > 1) strikes++;
  if (win > best) best = win;
  for (const w of r.lineWins) {
    bySymbol.set(w.symbol, (bySymbol.get(w.symbol) ?? 0) + w.payout);
  }
}

const rtp = totalWin / totalBet;
const hitFreq = hits / spins;

console.log('='.repeat(46));
console.log(`Spins:        ${spins.toLocaleString()}`);
console.log(`Reel lengths: ${REEL_STRIPS.map((s) => s.length).join(', ')}`);
console.log(`Bet/spin:     ${linesPerSpin} (line-bet units)`);
console.log('-'.repeat(46));
console.log(`RTP (w/ WS):  ${(rtp * 100).toFixed(3)} %`);
console.log(`  ├─ base:    ${((baseWin / totalBet) * 100).toFixed(3)} %`);
console.log(`  └─ strike:  ${(((totalWin - baseWin) / totalBet) * 100).toFixed(3)} %`);
console.log(`Strike freq:  ${((strikes / spins) * 100).toFixed(3)} %`);
console.log(`Hit freq:     ${(hitFreq * 100).toFixed(2)} %`);
console.log(
  `Max win/spin: ${best} × line-bet  (= ${(best / linesPerSpin).toFixed(1)} × total bet)`,
);
console.log('-'.repeat(46));
console.log('RTP contribution by winning symbol:');
[...bySymbol.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([sym, won]) => {
    console.log(
      `  ${SYMBOL_NAMES[sym].padEnd(5)} ${((won / totalBet) * 100).toFixed(2).padStart(6)} %`,
    );
  });
console.log('='.repeat(46));
