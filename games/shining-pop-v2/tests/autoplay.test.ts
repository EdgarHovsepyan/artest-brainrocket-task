import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AUTOPLAY_COUNTS,
  BIG_WIN_MULT,
  DEFAULT_OPTIONS,
  evaluateContinuation,
  idleAutoplay,
  interSpinDelayMs,
  spinStarted,
  startAutoplay,
  stopAutoplay,
} from '../assets/scripts/logic/autoplay';

const spin = (over: Partial<Parameters<typeof evaluateContinuation>[1]> = {}) => ({
  isFeature: false,
  winCents: 0,
  betCents: 100,
  balanceCents: 10_000,
  ...over,
});

test('defaults match the master: stop-on-feature ON, stop-on-big-win OFF', () => {
  assert.deepEqual(DEFAULT_OPTIONS, { stopOnFeature: true, stopOnBigWin: false });
  assert.deepEqual(AUTOPLAY_COUNTS, [10, 25, 50, 100, 250]);
  assert.equal(BIG_WIN_MULT, 25);
});

test('startAutoplay clamps to the jurisdiction cap; Infinity only when uncapped', () => {
  assert.equal(startAutoplay(250, DEFAULT_OPTIONS, 100).remaining, 100);
  assert.equal(startAutoplay(50, DEFAULT_OPTIONS, 100).remaining, 50);
  assert.equal(startAutoplay(Infinity, DEFAULT_OPTIONS).remaining, Infinity);
  assert.equal(startAutoplay(Infinity, DEFAULT_OPTIONS, 250).remaining, 250);
});

test('spinStarted decrements at spin start, never below Infinity semantics', () => {
  let s = startAutoplay(2, DEFAULT_OPTIONS);
  s = spinStarted(s);
  assert.equal(s.remaining, 1);
  const inf = spinStarted(startAutoplay(Infinity, DEFAULT_OPTIONS));
  assert.equal(inf.remaining, Infinity);
  const idle = spinStarted(idleAutoplay());
  assert.equal(idle.remaining, 0);
});

test('feature stops autoplay when stopOnFeature is on, continues when off', () => {
  const on = startAutoplay(10, { stopOnFeature: true, stopOnBigWin: false });
  assert.deepEqual(evaluateContinuation(on, spin({ isFeature: true })), {
    stop: true,
    reason: 'feature',
  });
  const off = startAutoplay(10, { stopOnFeature: false, stopOnBigWin: false });
  assert.equal(evaluateContinuation(off, spin({ isFeature: true })).stop, false);
});

test('big win >= 25x total bet stops only when stopOnBigWin is on', () => {
  const on = startAutoplay(10, { stopOnFeature: true, stopOnBigWin: true });
  assert.deepEqual(evaluateContinuation(on, spin({ winCents: 2500 })), {
    stop: true,
    reason: 'bigWin',
  });
  assert.equal(evaluateContinuation(on, spin({ winCents: 2499 })).stop, false);
  const off = startAutoplay(10, DEFAULT_OPTIONS);
  assert.equal(evaluateContinuation(off, spin({ winCents: 9_999_99 })).stop, false);
});

test('exhausted spins and short balance both stop the run', () => {
  let s = startAutoplay(1, DEFAULT_OPTIONS);
  s = spinStarted(s);
  assert.deepEqual(evaluateContinuation(s, spin()), { stop: true, reason: 'exhausted' });
  const broke = startAutoplay(10, DEFAULT_OPTIONS);
  assert.deepEqual(evaluateContinuation(broke, spin({ balanceCents: 99 })), {
    stop: true,
    reason: 'balance',
  });
});

test('stop order parity: feature beats bigWin beats exhausted', () => {
  let s = startAutoplay(1, { stopOnFeature: true, stopOnBigWin: true });
  s = spinStarted(s);
  const r = evaluateContinuation(s, spin({ isFeature: true, winCents: 99_999 }));
  assert.equal(r.reason, 'feature');
});

test('stopAutoplay zeroes the run', () => {
  const s = stopAutoplay(startAutoplay(50, DEFAULT_OPTIONS));
  assert.equal(s.active, false);
  assert.equal(s.remaining, 0);
});

test('inter-spin delay parity: 140 max-turbo, 280 turbo/reduced, 720 off', () => {
  assert.equal(interSpinDelayMs(2), 140);
  assert.equal(interSpinDelayMs(1), 280);
  assert.equal(interSpinDelayMs(0, true), 280);
  assert.equal(interSpinDelayMs(0), 720);
});
