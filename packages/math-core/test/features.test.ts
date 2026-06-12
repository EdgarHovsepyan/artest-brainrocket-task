import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createRng,
  runFreeSpins,
  solveBuyCost,
  scatterCount,
  scatterWinX,
  classifyWinTier,
  wildStrikeMultiplier,
  simulate,
  generateOutcomeBooks,
  rtpFromLookup,
} from '../src/index.js';
import { FEATURE_DEMO_CONFIG as CFG, SCATTER } from './fixtures/feature-demo.config.js';
import { BRAINROCKET_CONFIG } from './fixtures/brainrocket.config.js';

test('scatterCount + scatterWinX read the scatter symbol', () => {
  const grid = [
    [SCATTER, 1, 2],
    [3, SCATTER, 4],
    [5, 6, SCATTER],
    [1, 2, 3],
    [4, 5, 6],
  ];
  assert.equal(scatterCount(grid, CFG), 3);
  assert.equal(scatterWinX(grid, CFG), CFG.scatter!.pays![3]); // 2× total bet
});

test('runFreeSpins is deterministic and respects the spin cap', () => {
  const a = runFreeSpins(createRng(123), CFG, 10);
  const b = runFreeSpins(createRng(123), CFG, 10);
  assert.deepEqual(
    a.steps.map((s) => s.winX),
    b.steps.map((s) => s.winX),
  );
  assert.ok(a.spinsPlayed <= CFG.feature!.cap);
  assert.ok(a.totalX >= 0);
});

test('free-spins win never exceeds maxWinX', () => {
  let maxSeen = 0;
  for (let s = 0; s < 200; s++)
    maxSeen = Math.max(maxSeen, runFreeSpins(createRng(s), CFG, 12).totalX);
  assert.ok(maxSeen <= CFG.maxWinX!);
});

test('solveBuyCost makes a bought feature return ~anchor RTP', () => {
  const anchor = 0.96;
  const cost = solveBuyCost(CFG, { startSpins: 10, anchorRtp: anchor, sims: 60_000, seed: 7 });
  // Replay the same distribution and confirm mean return / cost ≈ anchor.
  const rng = createRng(7);
  let total = 0;
  const N = 60_000;
  for (let i = 0; i < N; i++) total += runFreeSpins(rng, CFG, 10).totalX;
  const realized = total / N / cost;
  assert.ok(Math.abs(realized - anchor) < 0.03, `realized=${realized} cost=${cost}`);
});

test('wildStrikeMultiplier triggers at minWilds and respects the cap', () => {
  const cfg = {
    ...BRAINROCKET_CONFIG,
    wildStrike: { minWilds: 3, multiplier: 'count' as const, maxMultiplier: 3 },
  };
  const w = BRAINROCKET_CONFIG.wildId;
  assert.equal(
    wildStrikeMultiplier(
      [
        [1, 2, 3],
        [1, 2, 3],
        [1, 2, 3],
        [1, 2, 3],
        [1, 2, 3],
      ],
      cfg,
    ),
    1,
  );
  assert.equal(
    wildStrikeMultiplier(
      [
        [w, 1, 1],
        [w, 2, 2],
        [w, 3, 3],
        [4, 4, 4],
        [5, 5, 5],
      ],
      cfg,
    ),
    3,
  );
  assert.equal(
    wildStrikeMultiplier(
      [
        [w, 1, 2],
        [w, 1, 2],
        [w, 1, 2],
        [w, 1, 2],
        [w, 1, 2],
      ],
      cfg,
    ),
    3,
  );
});

test('classifyWinTier bands a round win correctly', () => {
  assert.equal(classifyWinTier(0), 'none');
  assert.equal(classifyWinTier(1), 'returned');
  assert.equal(classifyWinTier(2), 'win');
  assert.equal(classifyWinTier(9), 'nice');
  assert.equal(classifyWinTier(40), 'big');
  assert.equal(classifyWinTier(200), 'mega');
  assert.equal(classifyWinTier(5000), 'epic');
});

test('round-complete books RTP matches the feature-inclusive simulator', () => {
  const seed = 0x9e3779b9;
  const n = 200_000;
  const sim = simulate(CFG, n, seed, { includeFeatures: true });
  const books = generateOutcomeBooks(CFG, { count: n, seed });
  // Same seed + same per-round operations → book RTP must equal the sim RTP.
  assert.ok(
    Math.abs(rtpFromLookup(books.lookup) - sim.rtp) < 0.01,
    `book=${books.rtp} sim=${sim.rtp}`,
  );
  // Triggered rounds must encode their free-spin steps for playback.
  assert.ok(books.books.some((b) => b.events.some((e) => e.type === 'freeSpins')));
});

test('simulate with features reports base + feature RTP that sum to total', () => {
  const r = simulate(CFG, 300_000, 0x9e3779b9, { includeFeatures: true });
  assert.ok(Math.abs(r.rtp - (r.baseRtp + r.featureRtp)) < 1e-9);
  assert.ok(r.featureRtp > 0, 'scatter/free-spins should contribute RTP');
  assert.ok(r.rtp > 0.5 && r.rtp < 1.5, `rtp=${r.rtp}`);
});
