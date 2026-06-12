import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ackRealityCheck,
  getComply,
  newSession,
  realityCheckDue,
  recordSpin,
  sessionNetCents,
} from '../assets/scripts/logic/compliance';

test('getComply returns the jurisdiction or the INT default', () => {
  assert.equal(getComply('UKGC').autoplayMax, 250);
  assert.equal(getComply('DE').autoplayMax, 0);
  assert.equal(getComply().realityCheckMin, 30); // INT default
  assert.equal(getComply('ZZ').realityCheckSpins, 100); // unknown -> INT
});

test('recordSpin accumulates spins, bet and won', () => {
  let s = newSession(0);
  s = recordSpin(s, 100, 250);
  s = recordSpin(s, 100, 0);
  assert.equal(s.spinsSinceCheck, 2);
  assert.equal(s.totalBetCents, 200);
  assert.equal(s.totalWonCents, 250);
  assert.equal(sessionNetCents(s), 50);
});

test('realityCheckDue fires on the spins threshold', () => {
  const rules = getComply('INT'); // 100 spins
  let s = newSession(0);
  for (let i = 0; i < 99; i++) s = recordSpin(s, 100, 0);
  assert.equal(realityCheckDue(s, rules, 1000), false);
  s = recordSpin(s, 100, 0);
  assert.equal(realityCheckDue(s, rules, 1000), true);
});

test('realityCheckDue fires on the time threshold', () => {
  const rules = getComply('INT'); // 30 min
  const s = newSession(0);
  assert.equal(realityCheckDue(s, rules, 29 * 60000), false);
  assert.equal(realityCheckDue(s, rules, 30 * 60000), true);
});

test('ackRealityCheck resets the counters but keeps lifetime totals', () => {
  let s = newSession(0);
  for (let i = 0; i < 50; i++) s = recordSpin(s, 100, 50);
  s = ackRealityCheck(s, 5000);
  assert.equal(s.spinsSinceCheck, 0);
  assert.equal(s.startedAtMs, 5000);
  assert.equal(s.totalBetCents, 5000); // lifetime totals untouched
  assert.equal(realityCheckDue(s, getComply('INT'), 5000), false);
});
