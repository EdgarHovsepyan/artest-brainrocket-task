// Advanced-feature tests: WILD STRIKE, the free-spins bonus engine, the model's
// buy-feature, and engine parity with the shared @artest/math-core.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRng } from '../assets/scripts/logic/rng';
import { spinGrid, wildStrikeMultiplier } from '../assets/scripts/logic/spin-engine';
import { runFreeSpins } from '../assets/scripts/logic/bonus-engine';
import {
  GRID,
  PAYLINES,
  PAYTABLE,
  REEL_WEIGHTS,
  SYMBOLS,
  WILD_STRIKE,
} from '../assets/scripts/logic/game-config';
import { SlotModel } from '../assets/scripts/model/slot-model';

import { spinGrid as coreSpinGrid } from '@artest/math-core';
import type { SlotMathConfig } from '@artest/math-core';

const W = SYMBOLS.WILD;

test('WILD STRIKE triggers at minWilds and caps at maxMultiplier', () => {
  const none = Array.from({ length: 5 }, () => [1, 2, 3]);
  assert.equal(wildStrikeMultiplier(none), 1);
  const three = [
    [W, 1, 1],
    [W, 2, 2],
    [W, 3, 3],
    [4, 4, 4],
    [5, 5, 5],
  ];
  assert.equal(wildStrikeMultiplier(three), Math.min(3, WILD_STRIKE.maxMultiplier));
  const five = Array.from({ length: 5 }, () => [W, 1, 2]);
  assert.equal(wildStrikeMultiplier(five), WILD_STRIKE.maxMultiplier);
});

test('bonus free-spins are deterministic per mode + seed', () => {
  for (const mode of ['wilds', 'crowns', 'reels'] as const) {
    const a = runFreeSpins(createRng(99), mode, 8);
    const b = runFreeSpins(createRng(99), mode, 8);
    assert.equal(a.totalPayout, b.totalPayout);
    assert.equal(a.steps.length, 8);
  }
});

test('sticky-crowns mode accumulates locked cells over the sequence', () => {
  const r = runFreeSpins(createRng(7), 'crowns', 8);
  const first = r.steps[0].sticky.length;
  const last = r.steps[r.steps.length - 1].sticky.length;
  assert.ok(last >= first);
});

test('model.play applies WILD STRIKE and conserves the ledger', () => {
  const m = new SlotModel({ seed: 5, balanceCents: 100_00, betCents: 1_00 });
  const before = m.balance;
  const out = m.play();
  assert.ok(out.wildStrike >= 1);
  assert.equal(out.balanceCents, before - out.betCents + out.winCents);
});

test('model.buyBonus deducts the cost and credits the feature win', () => {
  const m = new SlotModel({ seed: 5, balanceCents: 100_000_00, betCents: 1_00 });
  const before = m.balance;
  const out = m.buyBonus('wilds');
  assert.ok(out.costCents > 0);
  assert.equal(out.balanceCents, before - out.costCents + out.winCents);
});

test('game engine matches @artest/math-core for the same config + seed (no drift)', () => {
  const config: SlotMathConfig = {
    reels: GRID.reels,
    rows: GRID.rows,
    wildId: SYMBOLS.WILD,
    paytable: PAYTABLE,
    paylines: PAYLINES,
    reelWeights: REEL_WEIGHTS,
  };
  for (const seed of [1, 42, 777]) {
    assert.deepEqual(spinGrid(createRng(seed)), coreSpinGrid(createRng(seed), config));
  }
});
