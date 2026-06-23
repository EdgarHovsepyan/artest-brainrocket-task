import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AUTOPLAY_COUNTS,
  BIG_WIN_MULT,
  DEFAULT_OPTIONS,
  evaluateContinuation,
  idleAutoplay,
  interSpinDelayMs,
  recordSpin,
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

test('defaults match the master: stop-on-feature ON, stop-on-big-win OFF, limits OFF', () => {
  assert.deepEqual(DEFAULT_OPTIONS, {
    stopOnFeature: true,
    stopOnBigWin: false,
    lossLimitCents: 0,
    singleWinLimitCents: 0,
  });
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
  const on = startAutoplay(10, {
    stopOnFeature: true,
    stopOnBigWin: false,
    lossLimitCents: 0,
    singleWinLimitCents: 0,
  });
  assert.deepEqual(evaluateContinuation(on, spin({ isFeature: true })), {
    stop: true,
    reason: 'feature',
  });
  const off = startAutoplay(10, {
    stopOnFeature: false,
    stopOnBigWin: false,
    lossLimitCents: 0,
    singleWinLimitCents: 0,
  });
  assert.equal(evaluateContinuation(off, spin({ isFeature: true })).stop, false);
});

test('big win >= 25x total bet stops only when stopOnBigWin is on', () => {
  const on = startAutoplay(10, {
    stopOnFeature: true,
    stopOnBigWin: true,
    lossLimitCents: 0,
    singleWinLimitCents: 0,
  });
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
  let s = startAutoplay(1, {
    stopOnFeature: true,
    stopOnBigWin: true,
    lossLimitCents: 0,
    singleWinLimitCents: 0,
  });
  s = spinStarted(s);
  const r = evaluateContinuation(s, spin({ isFeature: true, winCents: 99_999 }));
  assert.equal(r.reason, 'feature');
});

test('stopAutoplay zeroes the run', () => {
  const s = stopAutoplay(startAutoplay(50, DEFAULT_OPTIONS));
  assert.equal(s.active, false);
  assert.equal(s.remaining, 0);
});

test('single-win limit halts when a spin wins >= the limit, continues just under', () => {
  const s = startAutoplay(50, { ...DEFAULT_OPTIONS, singleWinLimitCents: 5000 });
  assert.deepEqual(evaluateContinuation(s, spin({ winCents: 5000 })), {
    stop: true,
    reason: 'singleWin',
  });
  assert.equal(evaluateContinuation(s, spin({ winCents: 4999 })).stop, false);
});

test('cumulative loss limit halts once net loss (bet - won) reaches the limit', () => {
  // 100c bet, 0 win => 100c net loss per spin; limit 250c trips on the 3rd spin.
  let s = startAutoplay(50, { ...DEFAULT_OPTIONS, lossLimitCents: 250 });
  assert.equal(evaluateContinuation(s, spin({ winCents: 0 })).stop, false); // net would be 100
  s = recordSpin(s, spin({ winCents: 0 })); // tally 100
  assert.equal(evaluateContinuation(s, spin({ winCents: 0 })).stop, false); // net would be 200
  s = recordSpin(s, spin({ winCents: 0 })); // tally 200
  assert.deepEqual(evaluateContinuation(s, spin({ winCents: 0 })), {
    stop: true,
    reason: 'lossLimit',
  }); // 200 + 100 = 300 >= 250
});

test('a win reduces the cumulative loss tally (net exposure, not raw spend)', () => {
  // Two 100c losses (tally 200), then a 150c win on this spin: net 200 + (100-150) = 150 < 250.
  let s = startAutoplay(50, { ...DEFAULT_OPTIONS, lossLimitCents: 250 });
  s = recordSpin(s, spin({ winCents: 0 }));
  s = recordSpin(s, spin({ winCents: 0 }));
  assert.equal(evaluateContinuation(s, spin({ winCents: 150 })).stop, false);
});

test('both limits off (default) preserves legacy behavior: no singleWin/lossLimit stop', () => {
  let s = startAutoplay(50, DEFAULT_OPTIONS);
  // Huge single win does not stop (singleWinLimit off; stopOnBigWin off).
  assert.equal(evaluateContinuation(s, spin({ winCents: 9_999_99 })).stop, false);
  // Endless losses never trip a loss limit when it's off.
  s = recordSpin(s, spin({ winCents: 0 }));
  s = recordSpin(s, spin({ winCents: 0 }));
  s = recordSpin(s, spin({ winCents: 0 }));
  assert.equal(evaluateContinuation(s, spin({ winCents: 0 })).stop, false);
});

test('feature stop still outranks single-win and loss limits', () => {
  const s = startAutoplay(50, {
    ...DEFAULT_OPTIONS,
    singleWinLimitCents: 1,
    lossLimitCents: 1,
  });
  const r = evaluateContinuation(s, spin({ isFeature: true, winCents: 99_999 }));
  assert.equal(r.reason, 'feature');
});

test('inter-spin delay parity: 140 max-turbo, 280 turbo/reduced, 720 off', () => {
  assert.equal(interSpinDelayMs(2), 140);
  assert.equal(interSpinDelayMs(1), 280);
  assert.equal(interSpinDelayMs(0, true), 280);
  assert.equal(interSpinDelayMs(0), 720);
});
