import type { Transaction } from '@/types';

export const getTransactionTimestamp = (date?: string | null) => {
  if (!date) return null;

  const timestamp = new Date(date).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

export const compareOptionalDatesNewestFirst = (
  firstDate?: string | null,
  secondDate?: string | null,
) => {
  const firstTimestamp = getTransactionTimestamp(firstDate);
  const secondTimestamp = getTransactionTimestamp(secondDate);

  if (firstTimestamp === null && secondTimestamp === null) return 0;
  if (firstTimestamp === null) return 1;
  if (secondTimestamp === null) return -1;

  return secondTimestamp - firstTimestamp;
};

export const compareTransactionsNewestFirst = (
  first: Transaction,
  second: Transaction,
) => {
  const dateComparison = compareOptionalDatesNewestFirst(first.date, second.date);
  if (dateComparison !== 0) return dateComparison;

  const rowComparison = (second.rowIndex || 0) - (first.rowIndex || 0);
  if (rowComparison !== 0) return rowComparison;

  return first.id.localeCompare(second.id);
};
