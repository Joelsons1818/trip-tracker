import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/sheets';
import { Transaction } from '@/types';

async function getFirstSheetName(sheets: any, sheetId: string) {
    const response = await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
    });
    return response.data.sheets?.[0]?.properties?.title || 'Página1';
}

export async function GET() {
    try {
        const sheets = await getGoogleSheets();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            return NextResponse.json({ error: 'Missing GOOGLE_SHEET_ID' }, { status: 500 });
        }

        const sheetName = await getFirstSheetName(sheets, sheetId);
        const range = `${sheetName}!A2:G`;

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: range,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return NextResponse.json({ transactions: [] });
        }

        const transactions: Transaction[] = rows.map((row: any[], index: number) => ({
            id: row[0],
            date: row[1],
            type: row[2] as 'Deposit' | 'Expense',
            person: row[3] as 'Daniel' | 'Marília',
            amountUSD: parseFloat(row[4] || '0'),
            costBRL: row[5] ? parseFloat(row[5]) : undefined,
            description: row[6] || undefined,
            rowIndex: index + 1,
        }));

        return NextResponse.json({ transactions: transactions.reverse() });
    } catch (error: any) {
        console.error('Error fetching transactions:', error);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body: Transaction = await request.json();
        const sheets = await getGoogleSheets();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!sheetId) {
            return NextResponse.json({ error: 'Missing GOOGLE_SHEET_ID' }, { status: 500 });
        }

        const sheetName = await getFirstSheetName(sheets, sheetId);
        const range = `${sheetName}!A2:G`;

        await sheets.spreadsheets.values.append({
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
                        body.description || ''
                    ]
                ],
            },
        });

        return NextResponse.json({ success: true, transaction: body });
    } catch (error: any) {
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
                                startIndex: rowIndex,
                                endIndex: rowIndex + 1,
                            }
                        }
                    }
                ]
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting transaction:', error);
        return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
    }
}
