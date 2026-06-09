// Unit tests for the pure game logic — the spec's paytable, paylines and Wild
// substitution. Engine-agnostic (no Cocos), so they run under plain node:test.
//   npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateLine,
  evaluateSpin,
  buildStrip,
  spinGrid,
} from '../assets/scripts/logic/spin-engine';
import {
  PAYTABLE,
  PAYLINES,
  SYMBOLS,
  GRID,
  REEL_WEIGHTS,
} from '../assets/scripts/logic/game-config';
import { winningCellsByReel } from '../assets/scripts/logic/win-cells';
import { createRng } from '../assets/scripts/logic/rng';

const { WILD, H1, H2, L5 } = SYMBOLS;

test('evaluateLine: 3-of-a-kind pays the spec value, left-to-right', () => {
  const line = evaluateLine([H1, H1, H1, L5, H2]);
  assert.equal(line?.symbol, H1);
  assert.equal(line?.count, 3);
  assert.equal(line?.payout, PAYTABLE[H1][3]); // 50
});

test('evaluateLine: a run is only counted from the left, no gaps', () => {
  // H2 appears 3× but not consecutively from reel 0 → only the leading H1 pair,
  // which is below the 3-min, so no win.
  const line = evaluateLine([H1, H2, H2, H1, H2]);
  assert.equal(line, null);
});

test('Wild substitutes to extend another symbol’s run', () => {
  const line = evaluateLine([H1, WILD, H1, L5, L5]);
  assert.equal(line?.symbol, H1);
  assert.equal(line?.count, 3);
  assert.equal(line?.payout, PAYTABLE[H1][3]);
});

test('best-of: pure-Wild run is chosen when it pays more', () => {
  // 3 Wilds then H4: as H4 → 4-of-a-kind (100); as Wild → 3-of-a-kind (100).
  // 5 Wilds must always take the top Wild payout.
  const allWild = evaluateLine([WILD, WILD, WILD, WILD, WILD]);
  assert.equal(allWild?.symbol, WILD);
  assert.equal(allWild?.count, 5);
  assert.equal(allWild?.payout, PAYTABLE[WILD][5]); // 2000
});

test('no win below 3 matches', () => {
  assert.equal(evaluateLine([H1, H1, L5, H2, H2]), null);
});

test('paytable matches the BrainRocket spec exactly', () => {
  // x3 / x4 / x5 columns straight from the task PDF.
  const spec: Record<number, [number, number, number]> = {
    [WILD]: [100, 1000, 2000],
    [H1]: [50, 500, 1000],
    [H2]: [20, 150, 750],
    [SYMBOLS.H3]: [15, 100, 500],
    [SYMBOLS.H4]: [15, 100, 500],
    [SYMBOLS.L1]: [10, 75, 250],
    [SYMBOLS.L2]: [5, 50, 150],
    [SYMBOLS.L3]: [5, 25, 150],
    [SYMBOLS.L4]: [5, 25, 150],
    [L5]: [5, 15, 100],
  };
  for (const [sym, [x3, x4, x5]] of Object.entries(spec)) {
    const s = Number(sym);
    assert.equal(PAYTABLE[s][3], x3, `sym ${s} x3`);
    assert.equal(PAYTABLE[s][4], x4, `sym ${s} x4`);
    assert.equal(PAYTABLE[s][5], x5, `sym ${s} x5`);
  }
});

test('there are exactly 10 paylines, each spanning 5 reels in rows 0..2', () => {
  assert.equal(PAYLINES.length, 10);
  for (const line of PAYLINES) {
    assert.equal(line.length, GRID.reels);
    for (const row of line) assert.ok(row >= 0 && row < GRID.rows);
  }
});

test('evaluateSpin sums all winning lines on a full Wild grid', () => {
  const grid = Array.from({ length: GRID.reels }, () =>
    Array.from({ length: GRID.rows }, () => WILD),
  );
  const result = evaluateSpin(grid);
  // every payline is 5 Wilds → 2000 each × 10 lines.
  assert.equal(result.lineWins.length, 10);
  assert.equal(result.totalPayout, 2000 * 10);
});

test('a dead grid pays nothing', () => {
  // alternate two low symbols per row so no line ever makes 3-from-the-left.
  const grid = Array.from({ length: GRID.reels }, (_, reel) =>
    Array.from({ length: GRID.rows }, () => (reel % 2 === 0 ? SYMBOLS.L2 : SYMBOLS.L3)),
  );
  const result = evaluateSpin(grid);
  assert.equal(result.totalPayout, 0);
  assert.equal(result.lineWins.length, 0);
});

test('winningCellsByReel reports the cells of each win without duplicates', () => {
  const grid = Array.from({ length: GRID.reels }, () =>
    Array.from({ length: GRID.rows }, () => WILD),
  );
  const cells = winningCellsByReel(evaluateSpin(grid), GRID.reels);
  assert.equal(cells.length, GRID.reels);
  // reel 0 participates in all rows but each row listed once.
  assert.deepEqual([...cells[0]].sort(), [0, 1, 2]);
});

test('buildStrip is deterministic and preserves symbol counts', () => {
  const weights = REEL_WEIGHTS[0];
  const a = buildStrip(weights);
  const b = buildStrip(weights);
  assert.deepEqual(a, b); // deterministic → runtime matches the RTP sim
  const total = Object.values(weights).reduce((s, n) => s + n, 0);
  assert.equal(a.length, total);
});

test('spinGrid reads a 5×3 window of valid symbol ids', () => {
  const grid = spinGrid(createRng(42));
  assert.equal(grid.length, GRID.reels);
  for (const col of grid) {
    assert.equal(col.length, GRID.rows);
    for (const id of col) assert.ok(id >= 0 && id <= 9);
  }
});
