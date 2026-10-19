import test from 'node:test';
import assert from 'node:assert/strict';
import { readAnalysisPreferences, saveAnalysisPreference, excludedIdsFromRows } from '../src/lib/analysis-preferences.ts';
import { partitionAnalysisExpenses, calculateAverages, sumAmounts } from '../src/lib/analysis.ts';

function fakeSheets({ exists = false, rows = [['transactionId', 'excluded', 'updatedAt']], failAppend = false } = {}) {
  const mutations = [];
  return {
    mutations,
    spreadsheets: {
      get: async () => ({ data: { sheets: exists ? [{ properties: { title: 'PreferenciasAnalise' } }] : [] } }),
      batchUpdate: async request => {
        mutations.push(request);
        assert.equal(request.requestBody.requests[0].addSheet.properties.title, 'PreferenciasAnalise');
        assert.equal(request.requestBody.requests.length, 2);
        assert.equal(request.requestBody.requests[1].updateCells.start.sheetId, request.requestBody.requests[0].addSheet.properties.sheetId);
        exists = true;
      },
      values: {
        get: async request => {
          assert.equal(request.range, "'PreferenciasAnalise'!A:C");
          return { data: { values: structuredClone(rows) } };
        },
        append: async request => {
          assert.equal(request.range, "'PreferenciasAnalise'!A:C");
          assert.equal(request.valueInputOption, 'RAW');
          if (failAppend) throw new Error('network failure');
          mutations.push(request);
          rows.push(...request.requestBody.values);
        },
      },
    },
  };
}

test('loading preferences without a sheet never writes or creates anything', async () => {
  const sheets = fakeSheets();
  assert.deepEqual(await readAnalysisPreferences(sheets, 'test'), []);
  assert.deepEqual(sheets.mutations, []);
});

test('exclude, reload, restore, reload; only isolated preferences receive writes', async () => {
  const sheets = fakeSheets();
  await saveAnalysisPreference(sheets, 'test', 'expense-1', true);
  assert.deepEqual(await readAnalysisPreferences(sheets, 'test'), ['expense-1']);
  await saveAnalysisPreference(sheets, 'test', 'expense-2', true);
  await saveAnalysisPreference(sheets, 'test', 'expense-1', false);
  assert.deepEqual(await readAnalysisPreferences(sheets, 'test'), ['expense-2']);
  assert.equal(sheets.mutations.filter(m => m.requestBody.requests).length, 1);
  assert.equal(sheets.mutations.filter(m => m.requestBody.values).length, 3);
});

test('malformed existing tab is never overwritten', async () => {
  const sheets = fakeSheets({ exists: true, rows: [['Other data']] });
  await assert.rejects(saveAnalysisPreference(sheets, 'test', 'expense-1', true), /header/);
  assert.deepEqual(sheets.mutations, []);
});

test('failed writes propagate instead of reporting a saved preference', async () => {
  const sheets = fakeSheets({ exists: true, failAppend: true });
  await assert.rejects(saveAnalysisPreference(sheets, 'test', 'expense-1', true), /network failure/);
  assert.deepEqual(await readAnalysisPreferences(sheets, 'test'), []);
});

test('last event wins without losing choices for other transactions', () => {
  assert.deepEqual(excludedIdsFromRows([['a', 'TRUE'], ['b', true], ['a', 'FALSE'], ['a', true]]), ['b', 'a']);
  assert.throws(() => excludedIdsFromRows([['a', 'maybe']]), /Invalid/);
});

test('all analysis periods exclude selected expenses; actual spending stays intact', () => {
  const rows = [
    { id:'a', type:'Expense', person:'Daniel', amountUSD:180, date:'2026-10-18T12:00:00Z' },
    { id:'b', type:'Expense', person:'Daniel', amountUSD:720, date:'2026-10-18T12:00:00Z' },
  ];
  const original = structuredClone(rows);
  const { included, excluded } = partitionAnalysisExpenses(rows, new Set(['b']));
  assert.equal(sumAmounts(rows), 900);
  assert.equal(sumAmounts(included), 180);
  assert.equal(sumAmounts(excluded), 720);
  for (const start of ['2026-10-18', '2026-10-12', '2026-10-01']) {
    assert.equal(sumAmounts(included.filter(tx => new Date(tx.date) >= new Date(start))), 180);
  }
  const averages = calculateAverages(included, 2026, 9, 2026, 9, new Date(2026, 9, 18));
  assert.equal(averages.daily, 10);
  assert.equal(averages.monthly, 180);
  assert.deepEqual(rows, original);
  assert.equal(sumAmounts(partitionAnalysisExpenses(rows, new Set()).included), 900);
  assert.equal(sumAmounts(partitionAnalysisExpenses(rows, new Set(['a','b'])).included), 0);
});
