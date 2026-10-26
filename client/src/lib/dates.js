export function formatDate(date, format = 'dd MMM yyyy') {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleDateString(undefined, { month: 'short' });
  const year = d.getFullYear();

  return format
    .replace('dd', day)
    .replace('MMM', month)
    .replace('yyyy', year);
}

export function formatMonth(month) {
  if (!month) return '';
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year), parseInt(monthNum) - 1);
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function addMonths(month, n) {
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(year, monthNum - 1 + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function dateToInputValue(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

export function parseMonth(month) {
  if (!month) return { year: 0, month: 0 };
  const [year, monthNum] = month.split('-').map(Number);
  return { year, month: monthNum };
}

export function formatAmount(amount, currency = 'INR') {
  if (amount == null) return '';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100);
}