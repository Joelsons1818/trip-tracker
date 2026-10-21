export type WalletId = 'Daniel' | 'Marília' | 'BofA' | 'Cartão';
export type TransactionType = 'Deposit' | 'Expense' | 'TransferOut' | 'TransferIn' | 'CardPayment';

export interface Transaction {
    id: string;
    date?: string;
    type: TransactionType;
    person: WalletId;
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
