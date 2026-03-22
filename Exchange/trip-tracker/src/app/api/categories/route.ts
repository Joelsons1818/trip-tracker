import { NextResponse } from 'next/server';
import { getGoogleSheets } from '@/lib/sheets';
import { Category } from '@/types';

export const dynamic = 'force-dynamic';

const DEFAULT_CATEGORIES = [
    { name: 'Fixo', codebook: 'Despesas regulares fixas mensais' },
    { name: 'Gasolina', codebook: 'Combustível para os veículos' },
    { name: 'Viagens', codebook: 'Passagens, hoteis, turismo' },
    { name: 'Mercado', codebook: 'Compras de supermercado, higiene e limpeza' },
    { name: 'Restaurante', codebook: 'Bares, restaurantes, ifood e lanches' },
    { name: 'Lazer', codebook: 'Passeios, ingressos, entretenimento' },
    { name: 'Casa BR', codebook: 'Contas, reparos e itens para a casa no Brasil' },
    { name: 'Casa EUA', codebook: 'Contas, reparos e itens para a casa nos EUA' },
    { name: 'Outros', codebook: 'Gastos diversos não categorizados' },
    { name: 'Farmácia', codebook: 'Medicamentos e produtos de saúde' },
];

async function ensureCategoriasSheet(sheets: any, sheetId: string) {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const exists = spreadsheet.data.sheets?.some((s: any) => s.properties.title === 'Categorias');
    
    if (!exists) {
        // Create the sheet
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: {
                requests: [{ addSheet: { properties: { title: 'Categorias' } } }]
            }
        });
        
        // Add header
        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: 'Categorias!A1:B1',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [['Nome', 'Codebook']] }
        });
        
        // Seed defaults
        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: 'Categorias!A2:B',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: DEFAULT_CATEGORIES.map(c => [c.name, c.codebook]) }
        });
    }
}

export async function GET() {
    try {
        const sheets = await getGoogleSheets();
        const sheetId = process.env.GOOGLE_SHEET_ID;
        if (!sheetId) return NextResponse.json({ error: 'Missing GOOGLE_SHEET_ID' }, { status: 500 });
        
        await ensureCategoriasSheet(sheets, sheetId);
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Categorias!A2:B',
        });
        
        const rows = response.data.values;
        if (!rows || rows.length === 0) return NextResponse.json({ categories: [] });
        
        const categories: Category[] = rows.map((row: any[], index: number) => ({
            id: row[0] || index.toString(),
            name: row[0] || '',
            codebook: row[1] || ''
        })).filter(c => c.name);
        
        return NextResponse.json({ categories });
    } catch (error: any) {
        console.error('Error fetching categories:', error);
        return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body: Category = await request.json();
        const sheets = await getGoogleSheets();
        const sheetId = process.env.GOOGLE_SHEET_ID;
        if (!sheetId) return NextResponse.json({ error: 'Missing GOOGLE_SHEET_ID' }, { status: 500 });
        
        await ensureCategoriasSheet(sheets, sheetId);
        
        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: 'Categorias!A:B',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[body.name, body.codebook || '']] }
        });
        
        return NextResponse.json({ success: true, category: body });
    } catch (error: any) {
        console.error('Error creating category:', error);
        return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const nameId = searchParams.get('id');
        if (!nameId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        
        const sheets = await getGoogleSheets();
        const sheetId = process.env.GOOGLE_SHEET_ID;
        if (!sheetId) return NextResponse.json({ error: 'Missing sheetId' }, { status: 500 });
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Categorias!A:A'
        });
        
        const rows = response.data.values;
        const rowIndex = rows?.findIndex((row: any[]) => row[0] === nameId);
        if (rowIndex === undefined || rowIndex === -1) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }
        
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        const categoriesSheetId = spreadsheet.data.sheets?.find((s: any) => s.properties.title === 'Categorias')?.properties?.sheetId;
        
        if (categoriesSheetId === undefined) {
            return NextResponse.json({ error: 'Categorias sheet not found' }, { status: 404 });
        }

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: categoriesSheetId,
                            dimension: 'ROWS',
                            startIndex: rowIndex,
                            endIndex: rowIndex + 1,
                        }
                    }
                }]
            }
        });
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
    }
}
