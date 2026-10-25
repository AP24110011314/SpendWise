import { DateTime } from 'luxon';

/**
 * Get the start and end of a month in UTC for a given timezone.
 * @param {string} month - Month in 'YYYY-MM' format
 * @param {string} tz - IANA timezone string (e.g., 'Asia/Kolkata')
 * @returns {{start: Date, end: Date}} - Start (inclusive) and end (exclusive) as UTC Dates
 */
export function monthRange(month, tz = 'Asia/Kolkata') {
  const start = DateTime.fromFormat(month, 'yyyy-MM', { zone: tz }).startOf('month').toUTC();
  const end = start.plus({ months: 1 });
  return {
    start: start.toJSDate(),
    end: end.toJSDate(),
  };
}

/**
 * Get the current month key in 'YYYY-MM' format for a given timezone.
 * @param {string} tz - IANA timezone string
 * @param {Date} [now=new Date()] - Reference date
 * @returns {string} - Month key in 'YYYY-MM' format
 */
export function currentMonth(tz = 'Asia/Kolkata', now = new Date()) {
  return DateTime.fromJSDate(now, { zone: tz }).toFormat('yyyy-MM');
}

/**
 * Get the number of days in a month for a given timezone.
 * @param {string} month - Month in 'YYYY-MM' format
 * @param {string} tz - IANA timezone string
 * @returns {number} - Number of days in the month
 */
export function daysInMonth(month, tz = 'Asia/Kolkata') {
  const dt = DateTime.fromFormat(month, 'yyyy-MM', { zone: tz });
  return dt.daysInMonth;
}

/**
 * Shift a month by N months.
 * @param {string} month - Month in 'YYYY-MM' format
 * @param {number} n - Number of months to shift (can be negative)
 * @returns {string} - Shifted month in 'YYYY-MM' format
 */
export function shiftMonth(month, n) {
  const dt = DateTime.fromFormat(month, 'yyyy-MM', { zone: 'UTC' });
  return dt.plus({ months: n }).toFormat('yyyy-MM');
}

/**
 * Get the day of month (1-31) for a date in a given timezone.
 * @param {Date} date - Date to check
 * @param {string} tz - IANA timezone string
 * @returns {number} - Day of month (1-31)
 */
export function dayOfMonth(date, tz = 'Asia/Kolkata') {
  return DateTime.fromJSDate(date, { zone: tz }).day;
}

/**
 * Get an array of month keys for the last N months including the current month.
 * @param {string} currentMonthKey - Current month in 'YYYY-MM' format
 * @param {number} n - Number of months to include
 * @returns {string[]} - Array of month keys from oldest to newest
 */
export function getLastNMonths(currentMonthKey, n) {
  const months = [];
  for (let i = n - 1; i >= 0; i--) {
    months.push(shiftMonth(currentMonthKey, -i));
  }
  return months;
}

/**
 * Get the start and end of the current month range for a given timezone.
 * @param {string} tz - IANA timezone string
 * @param {Date} [now=new Date()] - Reference date
 * @returns {{start: Date, end: Date, monthKey: string}} - Month range and key
 */
export function getCurrentMonthRange(tz = 'Asia/Kolkata', now = new Date()) {
  const monthKey = currentMonth(tz, now);
  const { start, end } = monthRange(monthKey, tz);
  return { start, end, monthKey };
}

/**
 * Get the start of day in UTC for a given date in a timezone.
 * @param {Date} date - Date to get start of day for
 * @param {string} tz - IANA timezone string
 * @returns {Date} - Start of day in UTC
 */
export function startOfDay(date, tz = 'Asia/Kolkata') {
  return DateTime.fromJSDate(date, { zone: tz }).startOf('day').toUTC().toJSDate();
}

/**
 * Get the end of day in UTC for a given date in a timezone.
 * @param {Date} date - Date to get end of day for
 * @param {string} tz - IANA timezone string
 * @returns {Date} - End of day in UTC
 */
export function endOfDay(date, tz = 'Asia/Kolkata') {
  return DateTime.fromJSDate(date, { zone: tz }).endOf('day').toUTC().toJSDate();
}