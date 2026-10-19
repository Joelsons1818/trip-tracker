import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAverages, getSpendingTransactions, sumAmounts } from '../src/lib/analysis.ts';
import { formatUSDate, usDateToIso } from '../src/lib/dates.ts';

const tx = (id, type, amountUSD, person = 'Daniel', date = '2026-10-18T12:00:00.000Z') =>
  ({ id, type, amountUSD, person, date });

test('internal transfer counts only fee; spending reconciles with wallet balances', () => {
  const rows = [tx('deposit', 'Deposit', 1000), tx('t-out', 'TransferOut', 500),
    tx('t-in', 'TransferIn', 495, 'BofA'), tx('purchase', 'Expense', 100, 'BofA')];
  const { expenses, invalidTransfers } = getSpendingTransactions(rows);
  assert.equal(invalidTransfers, 0);
  assert.equal(sumAmounts(expenses), 105);
  assert.equal(sumAmounts(expenses.filter(t => t.person === 'Daniel')), 5);
  assert.equal(sumAmounts(expenses.filter(t => t.person === 'BofA')), 100);
  assert.equal(1000 - sumAmounts(expenses), 895);
  assert.equal(rows.length, 4);
});

test('zero fee, orphaned, duplicated and inconsistent transfers', () => {
  assert.equal(getSpendingTransactions([tx('a-out', 'TransferOut', 10), tx('a-in', 'TransferIn', 10)]).expenses.length, 0);
  for (const rows of [[tx('a-out', 'TransferOut', 10)],
    [tx('a-out', 'TransferOut', 10), tx('a-in', 'TransferIn', 11)],
    [tx('a-out', 'TransferOut', 10), tx('a-out', 'TransferOut', 10), tx('a-in', 'TransferIn', 9)]]) {
    const result = getSpendingTransactions(rows);
    assert.equal(result.invalidTransfers, 1);
    assert.equal(result.expenses.length, 0);
  }
});

test('money sums use cents', () => {
  assert.equal(sumAmounts([tx('a', 'Expense', 0.1), tx('b', 'Expense', 0.2)]), 0.3);
});

test('current-month daily average excludes future days and transactions', () => {
  const result = calculateAverages([tx('a', 'Expense', 180), tx('future', 'Expense', 999, 'Daniel', '2026-10-19T12:00:00Z')],
    2026, 9, 2026, 9, new Date(2026, 9, 18, 15));
  assert.equal(result.days, 18);
  assert.equal(result.daily, 10);
  assert.equal(result.monthly, 180);
  assert.equal(result.partial, true);
});

test('full leap month and multi-month averages include all calendar days', () => {
  const rows = [tx('a', 'Expense', 290, 'Daniel', '2024-02-29T12:00:00Z')];
  assert.equal(calculateAverages(rows, 2024, 1, 2024, 1, new Date(2026, 9, 18)).daily, 10);
  const result = calculateAverages(rows, 2024, 1, 2024, 2, new Date(2026, 9, 18));
  assert.equal(result.days, 60);
  assert.equal(result.monthly, 145);
});

test('inverted/future ranges are invalid, empty valid range has zero averages', () => {
  const now = new Date(2026, 9, 18);
  assert.equal(calculateAverages([], 2026, 9, 2026, 8, now).valid, false);
  assert.equal(calculateAverages([], 2027, 0, 2027, 1, now).valid, false);
  const result = calculateAverages([], 2026, 0, 2026, 0, now);
  assert.equal(result.valid, true);
  assert.equal(result.daily, 0);
});

test('US dates round-trip and reject impossible dates', () => {
  assert.equal(usDateToIso('10/18/2026'), '2026-10-18T12:00:00.000Z');
  assert.equal(formatUSDate('2026-10-18T12:00:00.000Z'), '10/18/2026');
  assert.equal(usDateToIso('02/29/2024'), '2024-02-29T12:00:00.000Z');
  for (const value of ['18/10/2026', '02/29/2026', '04/31/2026', '00/01/2026', '10/00/2026', '2026-10-18']) {
    assert.equal(usDateToIso(value), null);
  }
});

test('undated legacy transactions keep their balance and stay out of period averages', () => {
  const rows = [tx('dated', 'Expense', 180), { ...tx('undated', 'Expense', 50), date: undefined }];
  assert.equal(sumAmounts(rows), 230);
  assert.equal(calculateAverages(rows, 2026, 9, 2026, 9, new Date(2026, 9, 18)).total, 180);
  assert.equal(formatUSDate(undefined), '');
});
