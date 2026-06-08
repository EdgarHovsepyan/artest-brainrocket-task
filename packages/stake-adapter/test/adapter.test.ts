import { test } from 'node:test';
import assert from 'node:assert/strict';

import { toWire, fromWire, multiplierFromX100, MockRgs, buildMathArtifacts } from '../src/index.js';
import { generateOutcomeBooks } from '@artest/math-core';
import type { SlotMathConfig } from '@artest/math-core';

const CFG: SlotMathConfig = {
  reels: 5,
  rows: 3,
  wildId: 0,
  paytable: {
    0: { 3: 100, 4: 1000, 5: 2000 },
    1: { 3: 50, 4: 500, 5: 1000 },
    2: { 3: 20, 4: 150, 5: 750 },
    3: { 3: 15, 4: 100, 5: 500 },
    4: { 3: 15, 4: 100, 5: 500 },
    5: { 3: 10, 4: 75, 5: 250 },
    6: { 3: 5, 4: 50, 5: 150 },
    7: { 3: 5, 4: 25, 5: 150 },
    8: { 3: 5, 4: 25, 5: 150 },
  },
  paylines: [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
    [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0],
    [2, 1, 0, 1, 2],
    [0, 0, 1, 2, 2],
    [2, 2, 1, 0, 0],
    [1, 0, 0, 0, 1],
    [1, 2, 2, 2, 1],
    [2, 1, 2, 1, 2],
  ],
  reelWeights: Array.from({ length: 5 }, () => ({
    0: 3,
    1: 5,
    2: 6,
    3: 8,
    4: 8,
    5: 10,
    6: 13,
    7: 13,
    8: 14,
    9: 3, // scatter — rare
  })),
  scatter: { id: 9, pays: { 3: 2, 4: 8, 5: 40 }, triggers: { 3: 10, 4: 12, 5: 15 } },
  feature: { multiplier: 2.5, retriggerScatters: 3, retriggerSpins: 5, cap: 60 },
  maxWinX: 5000,
};

test('money scaling round-trips (×10^6 wire, ×100 multiplier)', () => {
  assert.equal(toWire(12.34), 12_340_000);
  assert.equal(fromWire(1_000_000_000), 1000);
  assert.equal(multiplierFromX100(850), 8.5);
});

test('MockRgs plays back a real book (never recomputes payout)', async () => {
  const ob = generateOutcomeBooks(CFG, { count: 5000, seed: 1 });
  const rgs = new MockRgs(ob.lookup, ob.books);
  const byId = new Map(ob.books.map((b) => [b.id, b]));
  for (let i = 0; i < 50; i++) {
    const r = await rgs.play();
    const book = byId.get(r.bookId)!;
    assert.equal(r.payoutMultiplier, book.payoutMultiplier);
    assert.equal(r.events.at(-1)?.type, 'setTotalWin');
  }
});

test('buildMathArtifacts emits index + lookup + books per mode, RTP cost-anchored', () => {
  const pkg = buildMathArtifacts(CFG, [
    { name: 'base', cost: 1, count: 20_000, seed: 7 },
    { name: 'buy', cost: 20, count: 20_000, seed: 8, forceFreeSpins: 10 },
  ]);
  const index = JSON.parse(pkg.indexJson) as { modes: { name: string; rtp: number }[] };
  assert.equal(index.modes.length, 2);
  assert.ok(pkg.files.some((f) => f.name === 'lookUpTable_base_0.csv'));
  assert.ok(pkg.files.some((f) => f.name === 'books_buy_0.jsonl'));
  // both modes land in the Stake 90–98% band once cost-anchored.
  for (const m of index.modes) assert.ok(m.rtp > 0.9 && m.rtp < 0.99, `${m.name}=${m.rtp}`);
});
