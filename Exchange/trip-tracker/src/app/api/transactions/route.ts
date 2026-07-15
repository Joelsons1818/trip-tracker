import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/sheets';
import type { sheets_v4 } from 'googleapis';
import type { Transaction } from '@/types';

export const dynamic = 'force-dynamic';

type SheetRow = Array<string | number | undefined>;

async function getFirstSheetName(sheets: sheets_v4.Sheets, sheetId: string) {
    const response = await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
    });
    return response.data.sheets?.[0]?.properties?.title || 'Página1';
}

const parseNumber = (val: string | number | undefined | null) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const str = val.toString().trim();
    if (str.includes(',') && str.includes('.')) {
         const lastDot = str.lastIndexOf('.');
         const lastComma = str.lastIndexOf(',');
         if (lastComma > lastDot) {
             return parseFloat(str.replace(/\./g, '').replace(',', '.'));
         } else {
             return parseFloat(str.replace(/,/g, ''));
         }
    } else if (str.includes(',')) {
         return parseFloat(str.replace(',', '.'));
    } else {
         return parseFloat(str);
    }
};

const parseDate = (val: string | number | undefined | null) => {
    if (!val) return new Date().toISOString();
    if (typeof val === 'number') {
        return new Date(Math.round((val - 25569) * 86400 * 1000)).toISOString();
    }
    const str = val.toString();
    if (str.includes('T') || str.match(/^\d{4}-\d{2}-\d{2}/)) {
        const d = new Date(str);
        if (!isNaN(d.getTime())) return d.toISOString();
    }
    const parts = str.split(/[\s/:]+/);
    if (parts.length >= 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        let h = 0, m = 0, s = 0;
        if (parts[3]) h = parseInt(parts[3], 10);
        if (parts[4]) m = parseInt(parts[4], 10);
        if (parts[5]) s = parseInt(parts[5], 10);
        const pad = (n: number) => n.toString().padStart(2, '0');
        const strForm = `${year}-${pad(month+1)}-${pad(day)}T${pad(h)}:${pad(m)}:${pad(s)}-03:00`;
        const d = new Date(strForm);
        if (!isNaN(d.getTime())) return d.toISOString();
    }
    const fallback = new Date(str);
    if (!isNaN(fallback.getTime())) return fallback.toISOString();
    return new Date().toISOString();
};

export async function GET() {
    try {
        const sheets = await getGoogleSheets();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            return NextResponse.json({ error: 'Missing GOOGLE_SHEET_ID' }, { status: 500 });
        }

        const sheetName = await getFirstSheetName(sheets, sheetId);
        const range = `${sheetName}!A2:H`;

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: range,
        });

        const rows = response.data.values as SheetRow[] | undefined;
        if (!rows || rows.length === 0) {
            return NextResponse.json({ transactions: [] });
        }

        const transactions: Transaction[] = rows.map((row, index) => ({
            id: String(row[0] || ''),
            date: parseDate(row[1]),
            type: row[2] as Transaction['type'],
            person: row[3] as Transaction['person'],
            amountUSD: parseNumber(row[4]),
            costBRL: row[5] ? parseNumber(row[5]) : undefined,
            description: row[6] ? String(row[6]) : undefined,
            category: row[7] ? String(row[7]) : undefined,
            rowIndex: index + 2,
        }));

        return NextResponse.json({ transactions: transactions.reverse() });
    } catch (error: unknown) {
        console.error('Error fetching transactions:', error);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body: Transaction | Transaction[] = await request.json();
        const transactions = Array.isArray(body) ? body : [body];
        const sheets = await getGoogleSheets();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            return NextResponse.json({ error: 'Missing GOOGLE_SHEET_ID' }, { status: 500 });
        }

        const sheetName = await getFirstSheetName(sheets, sheetId);
        const range = `${sheetName}!A2:H`;

        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: transactions.map(transaction => [
                    transaction.id,
                    transaction.date,
                    transaction.type,
                    transaction.person,
                    transaction.amountUSD,
                    transaction.costBRL || '',
                    transaction.description || '',
                    transaction.category || ''
                ]),
            },
        });

        return NextResponse.json({ success: true, transaction: body });
    } catch (error: unknown) {
        console.error('Error creating transaction:', error);
        return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const rowIndexStr = searchParams.get('rowIndex');

        if (!rowIndexStr) {
            return NextResponse.json({ error: 'Missing rowIndex' }, { status: 400 });
        }

        const rowIndex = parseInt(rowIndexStr, 10);
        const sheets = await getGoogleSheets();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            return NextResponse.json({ error: 'Missing GOOGLE_SHEET_ID' }, { status: 500 });
        }

        const response = await sheets.spreadsheets.get({
            spreadsheetId: sheetId,
        });

        const firstSheetId = response.data.sheets?.[0]?.properties?.sheetId || 0;

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: firstSheetId,
                                dimension: 'ROWS',
                                startIndex: rowIndex - 1,
                                endIndex: rowIndex,
                            }
                        }
                    }
                ]
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('Error deleting transaction:', error);
        return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body: Transaction = await request.json();
        if (!body.rowIndex) return NextResponse.json({ error: 'Missing rowIndex' }, { status: 400 });

        const sheets = await getGoogleSheets();
        const sheetId = process.env.GOOGLE_SHEET_ID;
        if (!sheetId) return NextResponse.json({ error: 'Missing GOOGLE_SHEET_ID' }, { status: 500 });

        const sheetName = await getFirstSheetName(sheets, sheetId);
        const range = `${sheetName}!A${body.rowIndex}:H${body.rowIndex}`;

        await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [
                    [
                        body.id,
                        body.date,
                        body.type,
                        body.person,
                        body.amountUSD,
                        body.costBRL || '',
                        body.description || '',
                        body.category || ''
                    ]
                ]
            }
        });

        return NextResponse.json({ success: true, transaction: body });
    } catch (error: unknown) {
        console.error('Error updating transaction:', error);
        return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
    }
}
