import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateLine,
  evaluateSpin,
  buildStrip,
  spinGrid,
  winningCellsByReel,
} from '../src/index.js';
import { createRng } from '../src/index.js';
import { BRAINROCKET_CONFIG as CFG, SYMBOLS } from './fixtures/brainrocket.config.js';

const { WILD, H1, H2, L5 } = SYMBOLS;
const PT = CFG.paytable;

test('3-of-a-kind pays the spec value, left-to-right', () => {
  const line = evaluateLine([H1, H1, H1, L5, H2], PT, WILD);
  assert.equal(line?.symbol, H1);
  assert.equal(line?.count, 3);
  assert.equal(line?.payout, PT[H1][3]);
});

test('a run is only counted from the left, no gaps', () => {
  assert.equal(evaluateLine([H1, H2, H2, H1, H2], PT, WILD), null);
});

test('Wild extends another symbol run', () => {
  const line = evaluateLine([H1, WILD, H1, L5, L5], PT, WILD);
  assert.equal(line?.symbol, H1);
  assert.equal(line?.count, 3);
  assert.equal(line?.payout, PT[H1][3]);
});

test('five Wilds take the top Wild payout', () => {
  const line = evaluateLine([WILD, WILD, WILD, WILD, WILD], PT, WILD);
  assert.equal(line?.symbol, WILD);
  assert.equal(line?.count, 5);
  assert.equal(line?.payout, PT[WILD][5]);
});

test('no win below 3 matches', () => {
  assert.equal(evaluateLine([H1, H1, L5, H2, H2], PT, WILD), null);
});

test('paytable matches the BrainRocket spec exactly', () => {
  const spec: Record<number, [number, number, number]> = {
    0: [100, 1000, 2000],
    1: [50, 500, 1000],
    2: [20, 150, 750],
    3: [15, 100, 500],
    4: [15, 100, 500],
    5: [10, 75, 250],
    6: [5, 50, 150],
    7: [5, 25, 150],
    8: [5, 25, 150],
    9: [5, 15, 100],
  };
  for (const [sym, [x3, x4, x5]] of Object.entries(spec)) {
    const s = Number(sym);
    assert.equal(PT[s][3], x3);
    assert.equal(PT[s][4], x4);
    assert.equal(PT[s][5], x5);
  }
});

test('exactly 10 paylines spanning 5 reels in rows 0..2', () => {
  assert.equal(CFG.paylines.length, 10);
  for (const line of CFG.paylines) {
    assert.equal(line.length, CFG.reels);
    for (const row of line) assert.ok(row >= 0 && row < CFG.rows);
  }
});

test('evaluateSpin sums all winning lines on a full-Wild grid', () => {
  const grid = Array.from({ length: CFG.reels }, () =>
    Array.from({ length: CFG.rows }, () => WILD),
  );
  const result = evaluateSpin(grid, CFG);
  assert.equal(result.lineWins.length, 10);
  assert.equal(result.totalPayout, PT[WILD][5] * 10);
});

test('a dead grid pays nothing', () => {
  const grid = Array.from({ length: CFG.reels }, (_, reel) =>
    Array.from({ length: CFG.rows }, () => (reel % 2 === 0 ? SYMBOLS.L2 : SYMBOLS.L3)),
  );
  const result = evaluateSpin(grid, CFG);
  assert.equal(result.totalPayout, 0);
  assert.equal(result.lineWins.length, 0);
});

test('winningCellsByReel reports cells without duplicates', () => {
  const grid = Array.from({ length: CFG.reels }, () =>
    Array.from({ length: CFG.rows }, () => WILD),
  );
  const cells = winningCellsByReel(evaluateSpin(grid, CFG), CFG);
  assert.equal(cells.length, CFG.reels);
  assert.deepEqual([...cells[0]].sort(), [0, 1, 2]);
});

test('buildStrip is deterministic and preserves symbol counts', () => {
  const w = CFG.reelWeights[0];
  assert.deepEqual(buildStrip(w), buildStrip(w));
  const total = Object.values(w).reduce((s, n) => s + n, 0);
  assert.equal(buildStrip(w).length, total);
});

test('spinGrid reads a 5×3 window of valid symbol ids', () => {
  const grid = spinGrid(createRng(42), CFG);
  assert.equal(grid.length, CFG.reels);
  for (const col of grid) {
    assert.equal(col.length, CFG.rows);
    for (const id of col) assert.ok(id >= 0 && id <= 9);
  }
});
