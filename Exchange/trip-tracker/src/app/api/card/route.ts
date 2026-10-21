import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/sheets';
import { readCardLedger, appendCardEvent } from '@/lib/card-store';
import { readCardEvents, materializeCard, prepareCardEvent, type CardCommand } from '@/lib/card';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const id = process.env.GOOGLE_SHEET_ID;
    if (!id) throw new Error('Missing GOOGLE_SHEET_ID');
    const ledger = await readCardLedger(await getGoogleSheets(), id);
    return NextResponse.json({ transactions: materializeCard(readCardEvents(ledger.rows)), revision: ledger.revision });
  } catch (error) {
    console.error('Card read failed', error);
    return NextResponse.json({ error: 'Não foi possível carregar o cartão. Atualize antes de continuar.' }, { status: 500 });
  }
}
export async function POST(request: Request) {
  let command: CardCommand;
  try { command = await request.json(); } catch { return NextResponse.json({ error: 'Solicitação inválida.' }, { status: 400 }); }
  try {
    const id = process.env.GOOGLE_SHEET_ID;
    if (!id) throw new Error('Missing GOOGLE_SHEET_ID');
    const sheets = await getGoogleSheets();
    const ledger = await readCardLedger(sheets, id);
    let event;
    try { event = prepareCardEvent(command, readCardEvents(ledger.rows), ledger.revision); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Confira os dados.' }, { status: 409 }); }
    if (event) await appendCardEvent(sheets, id, event);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Card write failed', error);
    return NextResponse.json({ error: 'Não foi possível confirmar a gravação. Atualize antes de tentar novamente.' }, { status: 500 });
  }
}
