// Data-driven "feel" contract (Nystrom + Sylvester): view-config.ts is the single
// tuning surface for the game's feel — beats, tiers, win-focus, counters. These
// invariants guard against a careless knob edit silently corrupting the feel
// (an opacity out of range, tiers that no longer escalate, a non-positive
// duration). They assert RELATIONSHIPS, not exact values, so intentional tuning
// stays free while structural breakage fails CI. view-config has no `cc` import,
// so it loads in plain Node.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIEW_CONFIG, resolveBigWinTier } from '../assets/scripts/view/view-config';

test('ceremony tiers escalate (minMultiple strictly descending — first match wins)', () => {
  const tiers = VIEW_CONFIG.ceremony.tiers;
  assert.ok(tiers.length >= 2);
  for (let i = 1; i < tiers.length; i++) {
    assert.ok(
      tiers[i - 1].minMultiple > tiers[i].minMultiple,
      `tier ${tiers[i].name} breaks the descending order resolveBigWinTier relies on`,
    );
  }
});

test('every ceremony tier carries the keys the view reads, in range', () => {
  for (const t of VIEW_CONFIG.ceremony.tiers) {
    assert.equal(typeof t.name, 'string');
    assert.match(t.color, /^#[0-9a-fA-F]{6}$/);
    assert.ok(t.shakeAmp >= 0);
    assert.ok(t.boardDimAlpha >= 0 && t.boardDimAlpha <= 1, `${t.name} boardDimAlpha out of [0,1]`);
    assert.ok(t.textPopScale >= 1, `${t.name} textPopScale must be >= 1`);
  }
});

test('count-up durations + pops are sane', () => {
  const c = VIEW_CONFIG.counter;
  assert.ok(c.maxMs >= c.baseMs, 'counter.maxMs must be >= baseMs');
  assert.ok(c.logScaleMs >= 0);
  assert.ok(c.heartbeat.popScale >= 1);
  assert.ok(c.landingPopScale > 0);
});

test('big-win ceremony beat-timeline (Sylvester) is well-formed', () => {
  const b = VIEW_CONFIG.ceremony.beats;
  // every beat duration is a positive number of milliseconds
  for (const [k, v] of Object.entries(b)) {
    assert.equal(typeof v, 'number', `beats.${k} must be a number`);
    assert.ok(v > 0, `beats.${k} must be > 0 ms`);
  }
  // the detonation flash must punch ON faster than it blooms OUT (a "bang")
  assert.ok(
    b.detonationFlashInMs < b.detonationFlashOutMs,
    'detonation flash must punch in faster than it fades',
  );
  // bigger wins savour longer: per-tx scaling is real (positive)
  assert.ok(b.climaxPerTxMs > 0 && b.savourHoldPerTxMs > 0);
});

test('win-focus + win-line beams stay within valid ranges', () => {
  assert.ok(
    VIEW_CONFIG.win.loserDimOpacity >= 0 && VIEW_CONFIG.win.loserDimOpacity <= 255,
    'loserDimOpacity must be a valid 0..255 opacity',
  );
  const b = VIEW_CONFIG.win.beams;
  assert.ok(b.heightPx > 0);
  assert.ok(b.holdOpacity > 0 && b.holdOpacity <= 255);
  assert.ok(b.intensity > 0 && b.flowSpeed > 0, 'beam shader uniforms must be positive');
});

test('resolveBigWinTier maps win multiples to the right tier band', () => {
  assert.equal(resolveBigWinTier(0), null, 'no ceremony for a 0x win');
  assert.equal(resolveBigWinTier(9), null, 'below the BIG floor → no named tier');
  assert.equal(resolveBigWinTier(10)?.name, 'BIG');
  assert.equal(resolveBigWinTier(100)?.name, 'EPIC');
  // monotonic: a bigger win never resolves to a lower tier's floor
  assert.ok(resolveBigWinTier(50)!.minMultiple >= resolveBigWinTier(30)!.minMultiple);
});
