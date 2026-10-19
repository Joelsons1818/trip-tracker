import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/sheets';
import { readAnalysisPreferences, saveAnalysisPreference } from '@/lib/analysis-preferences';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) return NextResponse.json({ error: 'Missing GOOGLE_SHEET_ID' }, { status: 500 });
    const sheets = await getGoogleSheets();
    return NextResponse.json({ excludedIds: await readAnalysisPreferences(sheets, spreadsheetId) });
  } catch (error) {
    console.error('Error reading analysis preferences:', error);
    return NextResponse.json({ error: 'Não foi possível carregar as exclusões da análise.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || !('transactionId' in body) || !('excluded' in body) ||
    typeof body.transactionId !== 'string' || !body.transactionId.trim() || body.transactionId.length > 200 ||
    typeof body.excluded !== 'boolean') {
    return NextResponse.json({ error: 'Invalid preference' }, { status: 400 });
  }
  const { transactionId, excluded } = body;
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) return NextResponse.json({ error: 'Missing GOOGLE_SHEET_ID' }, { status: 500 });
    const sheets = await getGoogleSheets();
    const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
    const title = metadata.data.sheets?.[0]?.properties?.title;
    if (!title) throw new Error('Transactions sheet not found');
    const response = await sheets.spreadsheets.values.get({ spreadsheetId,
      range: `'${title.replace(/'/g, "''")}'!A2:D` });
    const rows: unknown[][] = response.data.values || [];
    const matches = rows.filter(row => row[0] === transactionId && row[2] === 'Expense');
    if (matches.length !== 1) {
      return NextResponse.json({ error: 'Gasto não encontrado ou identificador duplicado. Atualize o histórico.' }, { status: 409 });
    }
    await saveAnalysisPreference(sheets, spreadsheetId, transactionId, excluded);
    return NextResponse.json({ transactionId, excluded });
  } catch (error) {
    console.error('Error saving analysis preference:', error);
    return NextResponse.json({ error: 'Não foi possível salvar a preferência. Tente novamente.' }, { status: 500 });
  }
}
