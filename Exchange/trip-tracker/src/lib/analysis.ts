import type { Transaction } from '@/types';

export const cents = (amount: number) => Math.round(amount * 100);
export const sumAmounts = (transactions: Transaction[]) =>
  transactions.reduce((sum, tx) => sum + cents(tx.amountUSD), 0) / 100;

/** Internal transfers only spend their fee, charged to the source wallet. */
export function getSpendingTransactions(transactions: Transaction[]) {
  const expenses = transactions.filter(tx => tx.type === 'Expense');
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (tx.type !== 'TransferOut' && tx.type !== 'TransferIn') continue;
    const id = tx.id.replace(/-(in|out)$/, '');
    groups.set(id, [...(groups.get(id) || []), tx]);
  }
  let invalidTransfers = 0;
  for (const [id, group] of groups) {
    const outgoing = group.filter(tx => tx.type === 'TransferOut');
    const incoming = group.filter(tx => tx.type === 'TransferIn');
    if (outgoing.length !== 1 || incoming.length !== 1 || cents(incoming[0].amountUSD) > cents(outgoing[0].amountUSD)) {
      invalidTransfers++;
      continue;
    }
    const fee = cents(outgoing[0].amountUSD) - cents(incoming[0].amountUSD);
    if (fee > 0) expenses.push({
      ...outgoing[0], id: `${id}-fee`, type: 'Expense', amountUSD: fee / 100,
      description: 'Tarifa de transferência para BofA', category: 'Tarifas de transferência',
    });
  }
  return { expenses, invalidTransfers };
}

export function calculateAverages(expenses: Transaction[], startYear: number, startMonth: number,
  endYear: number, endMonth: number, now: Date) {
  const months = (endYear - startYear) * 12 + endMonth - startMonth + 1;
  const start = new Date(startYear, startMonth, 1);
  const selectedEnd = new Date(endYear, endMonth + 1, 1);
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const end = new Date(Math.min(selectedEnd.getTime(), tomorrow.getTime()));
  const valid = months > 0 && start < end;
  // Calendar days, independent of daylight-saving transitions.
  const dayKey = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const days = valid ? (dayKey(end) - dayKey(start)) / 86400000 : 0;
  const total = valid ? sumAmounts(expenses.filter(tx => {
    const time = new Date(tx.date || '').getTime();
    return time >= start.getTime() && time < end.getTime();
  })) : 0;
  return { valid, days, months, total, partial: selectedEnd > tomorrow,
    daily: valid ? total / days : 0, monthly: valid ? total / months : 0 };
}

/** Exclusions affect analytics only; never mutate transactions used for balances/history. */
export function partitionAnalysisExpenses(expenses: Transaction[], excludedIds: ReadonlySet<string>) {
  return {
    included: expenses.filter(tx => !excludedIds.has(tx.id)),
    excluded: expenses.filter(tx => excludedIds.has(tx.id)),
  };
}
