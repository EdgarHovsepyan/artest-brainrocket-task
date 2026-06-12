import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BET_LEVELS_CENTS,
  maxBet,
  minBet,
  snapBet,
  stepBet,
} from '../assets/scripts/logic/bet-levels';

test('ladder is sorted, unique and bounded by min/max', () => {
  const sorted = [...BET_LEVELS_CENTS].sort((a, b) => a - b);
  assert.deepEqual([...BET_LEVELS_CENTS], sorted);
  assert.equal(new Set(BET_LEVELS_CENTS).size, BET_LEVELS_CENTS.length);
  assert.equal(minBet(), BET_LEVELS_CENTS[0]);
  assert.equal(maxBet(), BET_LEVELS_CENTS[BET_LEVELS_CENTS.length - 1]);
});

test('stepBet walks the ladder and clamps at both ends', () => {
  assert.equal(stepBet(100, 1), 200);
  assert.equal(stepBet(200, 1), 300);
  assert.equal(stepBet(1000, 1), 1000);
  assert.equal(stepBet(100, -1), 100);
  assert.equal(stepBet(500, -1), 300);
});

test('snapBet lands every off-ladder value on a designed stake', () => {
  assert.equal(snapBet(0), 100);
  assert.equal(snapBet(260), 300);
  assert.equal(snapBet(99_999), 1000);
  for (const lv of BET_LEVELS_CENTS) assert.equal(snapBet(lv), lv);
});
