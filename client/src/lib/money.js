export function formatMoney(minor, currency = 'INR') {
  if (minor === null || minor === undefined) return '';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

export function parseMoneyInput(str) {
  if (!str) return null;
  const cleaned = str.replace(/[^\d.-]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) return null;
  let integerPart = parts[0] || '0';
  let decimalPart = parts[1] || '';
  if (decimalPart.length > 2) return null;
  decimalPart = decimalPart.padEnd(2, '0');
  const minor = parseInt(integerPart + decimalPart, 10);
  if (isNaN(minor) || minor <= 0) return null;
  return minor;
}