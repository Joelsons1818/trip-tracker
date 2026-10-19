export function formatUSDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

/** Keep the existing noon-UTC storage convention; presentation is always US. */
export function usDateToIso(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, month, day, year] = match;
  const iso = `${year}-${month}-${day}T12:00:00.000Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day)) return null;
  return iso;
}
