import { createHash } from 'node:crypto';
import type { sheets_v4 } from 'googleapis';
import type { CardEvent } from './card';
const TITLE = 'CartaoCredito';
const RANGE = `'${TITLE}'!A:E`;
const HEADER = ['eventId', 'transactionId', 'operation', 'payload', 'createdAt'];
async function exists(sheets: sheets_v4.Sheets, spreadsheetId: string) {
  const response = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  return response.data.sheets?.some(sheet => sheet.properties?.title === TITLE) ?? false;
}
export async function readCardLedger(sheets: sheets_v4.Sheets, spreadsheetId: string) {
  let rows: unknown[][] = [];
  if (await exists(sheets, spreadsheetId)) {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: RANGE });
    const values: unknown[][] = response.data.values || [];
    if (!HEADER.every((value, i) => values[0]?.[i] === value)) throw new Error('Aba do cartão com cabeçalho inesperado.');
    rows = values.slice(1).filter(row => row.some(value => value !== '' && value != null));
  }
  const revision = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  return { rows, revision };
}
export async function appendCardEvent(sheets: sheets_v4.Sheets, spreadsheetId: string, event: CardEvent) {
  if (!await exists(sheets, spreadsheetId)) {
    const sheetId = Math.floor(Math.random() * 2_000_000_000) + 1;
    try {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [
        { addSheet: { properties: { sheetId, title: TITLE } } },
        { updateCells: { start: { sheetId, rowIndex: 0, columnIndex: 0 }, rows: [{ values:
          HEADER.map(stringValue => ({ userEnteredValue: { stringValue } })) }], fields: 'userEnteredValue' } },
      ] } });
    } catch (error) { if (!await exists(sheets, spreadsheetId)) throw error; }
  }
  await readCardLedger(sheets, spreadsheetId);
  // One canonical payment feeds both histories. No write to the original transactions sheet.
  await sheets.spreadsheets.values.append({ spreadsheetId, range: RANGE, valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS', requestBody: { values: [[event.eventId, event.id, event.operation,
      event.transaction ? JSON.stringify(event.transaction) : '', new Date().toISOString()]] } });
}
