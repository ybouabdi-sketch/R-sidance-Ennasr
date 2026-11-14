/**
 * Formats a number to a string with Western Arabic numerals (0, 1, 2...).
 * Always shows negative sign on the left.
 */
export const formatNumber = (num: number): string => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  
  // Use fr-FR to ensure Western numerals and standard French formatting
  const formatter = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 2,
    useGrouping: true,
  });

  const formatted = formatter.format(absNum);
  // Use \u200E (Left-to-Right Mark) to ensure the minus sign stays on the left even in RTL
  return isNegative ? `\u200E-${formatted}` : `\u200E${formatted}`;
};

/**
 * Formats a date to a string with Western Arabic numerals (0, 1, 2...).
 */
export const formatDate = (date: string | Date, options?: Intl.DateTimeFormatOptions): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  
  return new Intl.DateTimeFormat('fr-FR', {
    ...options,
    numberingSystem: 'latn'
  }).format(d);
};

/**
 * Formats a currency amount. Currency on the right.
 */
export const formatCurrency = (amount: number, currency: string = 'MAD'): string => {
  return `${formatNumber(amount)} ${currency}`;
};
