/**
 * Format a number as BDT (Bangladeshi Taka).
 * Uses the ৳ symbol with comma-separated thousands.
 */
export function formatBDT(amount: number): string {
  const formatted = new Intl.NumberFormat('en-BD', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  return `৳${formatted}`;
}

/**
 * Format with sign prefix for income/expense display.
 */
export function formatBDTSigned(amount: number, type: 'income' | 'expense'): string {
  return `${type === 'income' ? '+' : '-'}${formatBDT(amount)}`;
}
