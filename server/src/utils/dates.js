import { DateTime } from 'luxon';

export function monthRange(month, tz = 'UTC') {
  const start = DateTime.fromFormat(month, 'yyyy-MM', { zone: tz }).startOf('month').toUTC().toJSDate();
  const end = start.plus({ months: 1 }).toJSDate();
  return { start, end };
}

export function currentMonth(tz = 'UTC', now = new Date()) {
  return DateTime.fromJSDate(now, { zone: tz }).toFormat('yyyy-MM');
}

export function daysInMonth(month, tz = 'UTC') {
  const dt = DateTime.fromFormat(month, 'yyyy-MM', { zone: tz });
  return dt.daysInMonth;
}

export function shiftMonth(month, n) {
  const dt = DateTime.fromFormat(month, 'yyyy-MM', { zone: 'UTC' });
  return dt.plus({ months: n }).toFormat('yyyy-MM');
}

export function dayOfMonth(date, tz = 'UTC') {
  return DateTime.fromJSDate(date, { zone: tz }).day;
}

export function startOfDay(date, tz = 'UTC') {
  return DateTime.fromJSDate(date, { zone: tz }).startOf('day').toUTC().toJSDate();
}

export function endOfDay(date, tz = 'UTC') {
  return DateTime.fromJSDate(date, { zone: tz }).endOf('day').toUTC().toJSDate();
}

export function parseDateInTz(dateStr, tz) {
  const dt = DateTime.fromFormat(dateStr, 'yyyy-MM-dd', { zone: tz });
  if (!dt.isValid) return null;
  return dt.set({ hour: 12, minute: 0, second: 0, millisecond: 0 }).toUTC().toJSDate();
}