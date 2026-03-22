export interface Transaction {
    id: string;
    date: string;
    type: 'Deposit' | 'Expense';
    person: 'Daniel' | 'Marília';
    amountUSD: number;
    costBRL?: number;
    description?: string;
    category?: string;
    rowIndex?: number; // Row index in Google Sheets to allow easy deletion/editing
}

export interface Category {
    id: string;
    name: string;
    codebook: string;
}
