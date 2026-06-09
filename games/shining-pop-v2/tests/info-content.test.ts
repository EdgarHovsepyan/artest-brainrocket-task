import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PAYTABLE, SYMBOLS, WILD_STRIKE } from '../assets/scripts/logic/game-config';
import {
  CONTROLS_LINES,
  maxWinMultiple,
  paytableRows,
  RTP_DISPLAY,
  RULES_LINES,
  SYMBOL_DISPLAY,
} from '../assets/scripts/logic/info-content';

test('paytable rows mirror the spec PAYTABLE exactly — all 10 symbols, all pays', () => {
  const rows = paytableRows();
  assert.equal(rows.length, 10);
  for (const row of rows) {
    assert.equal(row.pay3, PAYTABLE[row.id][3]);
    assert.equal(row.pay4, PAYTABLE[row.id][4]);
    assert.equal(row.pay5, PAYTABLE[row.id][5]);
    assert.equal(row.name, SYMBOL_DISPLAY[row.id]);
  }
});

test('max win derives from paytable + WILD STRIKE cap (no hand-typed number)', () => {
  assert.equal(maxWinMultiple(), PAYTABLE[SYMBOLS.WILD][5] * WILD_STRIKE.maxMultiplier);
  assert.equal(maxWinMultiple(), 6000);
});

test('display constants and texts are present and non-empty', () => {
  assert.match(RTP_DISPLAY, /^\d{2}\.\d{2}%$/);
  assert.ok(RULES_LINES.length >= 5);
  assert.ok(CONTROLS_LINES.length >= 4);
  for (const line of [...RULES_LINES, ...CONTROLS_LINES]) assert.ok(line.trim().length > 0);
});
