export interface Transaction {
    id: string;
    date: string;
    type: 'Deposit' | 'Expense';
    person: 'Daniel' | 'Marília';
    amountUSD: number;
    costBRL?: number;
    description?: string;
    rowIndex?: number; // Row index in Google Sheets to allow easy deletion
}
