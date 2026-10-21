import type { Transaction, WalletId } from '@/types';

const cents = (value: number) => Math.round(value * 100);
export const isCardTransaction = (tx: Transaction) => tx.person === 'Cartão';
export const isCashIncoming = (tx: Transaction) => tx.person !== 'Cartão' && (tx.type === 'Deposit' || tx.type === 'TransferIn');
export const isCashOutgoing = (tx: Transaction) => tx.type === 'CardPayment' ||
  (tx.person !== 'Cartão' && (tx.type === 'Expense' || tx.type === 'TransferOut'));
export const belongsToWallet = (tx: Transaction, wallet: WalletId) => tx.person === wallet ||
  (wallet === 'BofA' && tx.type === 'CardPayment');
export function getCardBalance(transactions: Transaction[]) {
  return transactions.reduce((total, tx) => total + (tx.person !== 'Cartão' ? 0 :
    tx.type === 'Expense' ? cents(tx.amountUSD) : tx.type === 'CardPayment' ? -cents(tx.amountUSD) : 0), 0) / 100;
}
export function getCashBalance(transactions: Transaction[], wallet?: WalletId) {
  return transactions.filter(tx => !wallet || belongsToWallet(tx, wallet)).reduce((sum, tx) =>
    sum + (isCashIncoming(tx) ? cents(tx.amountUSD) : isCashOutgoing(tx) ? -cents(tx.amountUSD) : 0), 0) / 100;
}

export type CardEvent = { eventId: string; id: string; operation: 'save' | 'delete'; transaction?: Transaction };
export function readCardEvents(rows: unknown[][]): CardEvent[] {
  return rows.map(([eventId, id, operation, payload]) => {
    if (typeof eventId !== 'string' || typeof id !== 'string' || !id.startsWith('card-') ||
      (operation !== 'save' && operation !== 'delete')) throw new Error('Registro do cartão inválido.');
    if (operation === 'delete') return { eventId, id, operation };
    const tx = JSON.parse(String(payload)) as Transaction;
    if (tx.id !== id || !validCardTransaction(tx)) throw new Error('Dados do cartão inválidos.');
    return { eventId, id, operation, transaction: tx };
  });
}
export function materializeCard(events: CardEvent[]) {
  const seen = new Set<string>();
  const transactions = new Map<string, Transaction>();
  for (const event of events) {
    if (seen.has(event.eventId)) continue;
    seen.add(event.eventId);
    if (event.operation === 'delete') transactions.delete(event.id);
    else if (event.transaction) transactions.set(event.id, event.transaction);
  }
  return [...transactions.values()];
}
function validCardTransaction(tx: Transaction) {
  return tx.person === 'Cartão' && ['Expense', 'CardPayment'].includes(tx.type) &&
    typeof tx.id === 'string' && tx.id.startsWith('card-') && tx.id.length <= 160 &&
    typeof tx.amountUSD === 'number' && Number.isFinite(tx.amountUSD) && tx.amountUSD > 0 &&
    Number.isSafeInteger(cents(tx.amountUSD)) && Math.abs(tx.amountUSD * 100 - cents(tx.amountUSD)) < 0.00001 &&
    typeof tx.date === 'string' && /^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/.test(tx.date) &&
    !Number.isNaN(Date.parse(tx.date)) && new Date(tx.date).toISOString() === tx.date &&
    typeof tx.description === 'string' && tx.description.trim().length > 0 && tx.description.length <= 500 &&
    (tx.type !== 'Expense' || (typeof tx.category === 'string' && tx.category.trim().length > 0 && tx.category.length <= 100));
}
export type CardCommand = { action: 'purchase' | 'pay' | 'edit' | 'delete'; requestId: string; revision: string;
  transaction?: Transaction; id?: string; date?: string };
export function prepareCardEvent(command: CardCommand, events: CardEvent[], revision: string): CardEvent | null {
  if (!command || !['purchase', 'pay', 'edit', 'delete'].includes(command.action) ||
    typeof command.requestId !== 'string' || !/^[\w-]{1,100}$/.test(command.requestId) ||
    typeof command.revision !== 'string' || !/^[\w-]{1,100}$/.test(command.revision)) throw new Error('Solicitação inválida.');
  const eventId = command.action === 'pay' ? `pay-${command.revision}` : command.requestId;
  if (events.some(event => event.eventId === eventId)) return null; // Retry or simultaneous payment of the same balance.
  if (command.revision !== revision) throw new Error('Os lançamentos mudaram. Atualize e confira os valores novamente.');
  const transactions = materializeCard(events);
  if (command.action === 'delete') {
    if (!transactions.some(tx => tx.id === command.id)) throw new Error('Lançamento não encontrado.');
    return { eventId, id: command.id!, operation: 'delete' };
  }
  let transaction: Transaction;
  if (command.action === 'pay') {
    const amountUSD = getCardBalance(transactions);
    if (amountUSD <= 0) throw new Error('Não há saldo em aberto para pagar.');
    transaction = { id: `card-payment-${command.revision}`, type: 'CardPayment', person: 'Cartão',
      amountUSD, date: command.date, description: 'Pagamento do cartão', category: 'Pagamento do cartão' };
  } else {
    const tx = command.transaction;
    if (!tx || !validCardTransaction(tx)) throw new Error('Confira descrição, categoria, data e valor positivo com até duas casas decimais.');
    const previous = transactions.find(item => item.id === tx.id);
    if (command.action === 'purchase' && (previous || tx.type !== 'Expense')) throw new Error('Compra inválida ou já existente.');
    if (command.action === 'edit' && (!previous || previous.type !== tx.type)) throw new Error('Lançamento não encontrado.');
    transaction = { id: tx.id, type: tx.type, person: 'Cartão', date: tx.date, amountUSD: tx.amountUSD,
      description: tx.type === 'CardPayment' ? 'Pagamento do cartão' : tx.description!.trim(),
      category: tx.type === 'CardPayment' ? 'Pagamento do cartão' : tx.category!.trim() };
  }
  if (!validCardTransaction(transaction)) throw new Error('Data ou valor inválido.');
  return { eventId, id: transaction.id, operation: 'save', transaction };
}
