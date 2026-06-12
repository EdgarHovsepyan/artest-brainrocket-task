import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  compactNumber,
  CURRENCIES,
  formatMoney,
  formatNumber,
  safeRound,
} from '../assets/scripts/logic/money';

test('safeRound kills the 0.1+0.2 drift', () => {
  assert.equal(safeRound(0.1 + 0.2, 2), 0.3);
  assert.equal(safeRound(1.005, 2), 1.01);
  assert.equal(safeRound(-1.005, 2), -1.01);
  assert.equal(safeRound(NaN, 2), 0);
  assert.equal(safeRound(Infinity, 2), 0);
});

test('formatNumber renders with grouping, decimals, never scientific', () => {
  assert.equal(formatNumber(1234567.89), '1,234,567.89');
  assert.equal(formatNumber(0.1 + 0.2, 2), '0.30');
  assert.equal(formatNumber(1.2e7, 2), '12,000,000.00');
  assert.equal(formatNumber(0, 0), '0');
  assert.equal(formatNumber(NaN, 2), '0.00');
});

test('formatMoney respects each currency shape (decimals + prefix/suffix + spacing)', () => {
  assert.equal(formatMoney(100, 'USD'), '$100.00');
  assert.equal(formatMoney(100, 'EUR'), '100.00 €');
  assert.equal(formatMoney(1000, 'JPY'), '¥1,000');
  assert.equal(formatMoney(1000, 'IDR'), 'Rp 1,000');
  assert.equal(formatMoney(1000, 'VND'), '1,000 ₫');
  assert.equal(formatMoney(0.12345678, 'BTC'), '₿0.12345678');
});

test('compactNumber scales billions cleanly without overflow', () => {
  assert.equal(compactNumber(1500), '1.5K');
  assert.equal(compactNumber(2_500_000), '2.5M');
  assert.equal(compactNumber(1_200_000_000), '1.2B');
  assert.equal(compactNumber(0), '0.00');
});

test('formatMoney auto-compacts when maxChars would be exceeded', () => {
  // IDR billions otherwise format as Rp 1,200,000,000 (17 chars)
  assert.equal(formatMoney(1_200_000_000, 'IDR', 12), 'Rp 1.2B');
  assert.equal(formatMoney(100, 'USD', 12), '$100.00'); // no compaction when fits
});

test('every currency in the table has a sensible shape', () => {
  for (const c of Object.values(CURRENCIES)) {
    assert.ok(c.symbol.length > 0);
    assert.ok(c.decimals >= 0 && c.decimals <= 8);
    assert.ok(c.position === 'prefix' || c.position === 'suffix');
  }
});
