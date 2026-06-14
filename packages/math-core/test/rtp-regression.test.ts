// Economy regression guard (Sellers, "Advanced Game Design: A Systems Approach"
// — the reward economy is a measured system, not a guess). A DETERMINISTIC
// seeded Monte-Carlo over the canonical BrainRocket spec fixture: any change to
// reel weights / paytable / the WILD STRIKE feature that shifts the economy
// moves these numbers and fails CI. The bands catch a real shift (a paytable or
// weight bug moves RTP several points) while tolerating Monte-Carlo + cross-
// platform float jitter at 250k spins.
//
// If you INTENTIONALLY retune, re-run and update the bands:
//   pnpm --filter @artest/math-core sim 250000 0x9e3779b9
// Reference (this seed/spins): RTP ~94.63%, hit ~25.35%, max ~232x.
// (The full 2,000,000-spin run lands at ~95.57% / 25.36% / 277.5x.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { simulate } from '../src/index.js';
import { BRAINROCKET_CONFIG } from './fixtures/brainrocket.config.js';

const SPINS = 250_000;
const SEED = 0x9e3779b9;

test('canonical RTP stays within the certified band', () => {
  const r = simulate(BRAINROCKET_CONFIG, SPINS, SEED);
  const rtp = r.rtp * 100;
  assert.ok(
    rtp > 93.5 && rtp < 96.5,
    `RTP ${rtp.toFixed(3)}% drifted out of [93.5, 96.5] — economy regression?`,
  );
});

test('hit frequency + max win stay in range', () => {
  const r = simulate(BRAINROCKET_CONFIG, SPINS, SEED);
  const hit = r.hitFrequency * 100;
  assert.ok(hit > 24 && hit < 27, `hit frequency ${hit.toFixed(2)}% out of [24, 27]`);
  assert.ok(
    r.maxWinX > 150,
    `max win ${r.maxWinX.toFixed(1)}x too low — paytable/feature regression?`,
  );
});

test('simulation is deterministic for a fixed seed', () => {
  const a = simulate(BRAINROCKET_CONFIG, 20_000, SEED);
  const b = simulate(BRAINROCKET_CONFIG, 20_000, SEED);
  assert.equal(a.rtp, b.rtp, 'same seed must reproduce the same RTP (capture/repro guarantee)');
  assert.equal(a.maxWinX, b.maxWinX);
});
