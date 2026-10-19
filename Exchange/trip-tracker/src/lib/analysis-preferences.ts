import type { sheets_v4 } from 'googleapis';

const TITLE = 'PreferenciasAnalise';
const RANGE = `'${TITLE}'!A:C`;
const HEADER = ['transactionId', 'excluded', 'updatedAt'];

export function excludedIdsFromRows(rows: unknown[][]) {
  const excluded = new Set<string>();
  for (const [id, value] of rows) {
    if (typeof id !== 'string' || !id) continue;
    if (value === true || value === 'TRUE') excluded.add(id);
    else if (value === false || value === 'FALSE') excluded.delete(id);
    else throw new Error('Invalid exclusion preference');
  }
  return [...excluded];
}

async function hasPreferencesSheet(sheets: sheets_v4.Sheets, spreadsheetId: string) {
  const response = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  return response.data.sheets?.some(sheet => sheet.properties?.title === TITLE) ?? false;
}

export async function readAnalysisPreferences(sheets: sheets_v4.Sheets, spreadsheetId: string) {
  // Reading the app must never create or change a sheet.
  if (!await hasPreferencesSheet(sheets, spreadsheetId)) return [];
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: RANGE });
  const rows: unknown[][] = response.data.values || [];
  if (!HEADER.every((name, i) => rows[0]?.[i] === name)) {
    throw new Error('Unexpected analysis preferences header');
  }
  return excludedIdsFromRows(rows.slice(1));
}

export async function saveAnalysisPreference(sheets: sheets_v4.Sheets, spreadsheetId: string,
  transactionId: string, excluded: boolean) {
  if (!await hasPreferencesSheet(sheets, spreadsheetId)) {
    // Create sheet and header atomically, at the end; existing sheet order and data stay intact.
    const sheetId = Math.floor(Math.random() * 2_000_000_000) + 1;
    try {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [
        { addSheet: { properties: { sheetId, title: TITLE } } },
        { updateCells: { start: { sheetId, rowIndex: 0, columnIndex: 0 },
          rows: [{ values: HEADER.map(stringValue => ({ userEnteredValue: { stringValue } })) }],
          fields: 'userEnteredValue' } },
      ] } });
    } catch (error) {
      // Another device may have created it concurrently. Never replace an existing tab.
      if (!await hasPreferencesSheet(sheets, spreadsheetId)) throw error;
    }
  }
  await readAnalysisPreferences(sheets, spreadsheetId); // Validate before writing.
  // Append an event, rather than updating/deleting transaction rows or overwriting other choices.
  await sheets.spreadsheets.values.append({ spreadsheetId, range: RANGE,
    valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[transactionId, excluded, new Date().toISOString()]] } });
}
