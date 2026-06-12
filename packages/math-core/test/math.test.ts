import { test } from 'node:test';
import assert from 'node:assert/strict';

import { simulate, generateOutcomeBooks, rtpFromLookup, buildIndex } from '../src/index.js';
import { BRAINROCKET_CONFIG as CFG } from './fixtures/brainrocket.config.js';

test('simulated RTP lands in the ~95.6% band', () => {
  const r = simulate(CFG, 500_000, 0x9e3779b9);
  assert.ok(r.rtp > 0.93 && r.rtp < 0.98, `rtp=${r.rtp}`);
  assert.ok(r.hitFrequency > 0.2 && r.hitFrequency < 0.32, `hit=${r.hitFrequency}`);
});

test('outcome-book RTP agrees with the simulated RTP', () => {
  const sim = simulate(CFG, 200_000, 7);
  const books = generateOutcomeBooks(CFG, { count: 200_000, seed: 7 });
  // Same seed + engine → book RTP must match the simulator within rounding noise.
  assert.ok(Math.abs(books.rtp - sim.rtp) < 0.01, `book=${books.rtp} sim=${sim.rtp}`);
});

test('lookup-derived RTP equals the book RTP (artifact parity)', () => {
  const books = generateOutcomeBooks(CFG, { count: 50_000, seed: 1 });
  assert.ok(Math.abs(rtpFromLookup(books.lookup) - books.rtp) < 1e-9);
});

test('every book has a lookup row and a positive weight', () => {
  const { books, lookup } = generateOutcomeBooks(CFG, { count: 1000, seed: 2 });
  assert.equal(books.length, lookup.length);
  const ids = new Set(books.map((b) => b.id));
  for (const row of lookup) {
    assert.ok(ids.has(row.simIdx));
    assert.ok(row.weight > 0);
  }
});

test('index manifest binds mode -> files + rtp', () => {
  const books = generateOutcomeBooks(CFG, { count: 1000, seed: 3 });
  const index = buildIndex([{ books, idx: 0 }]);
  assert.equal(index.modes[0].name, 'base');
  assert.equal(index.modes[0].events, 'books_base_0.jsonl');
  assert.equal(index.modes[0].weights, 'lookUpTable_base_0.csv');
});
