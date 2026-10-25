import { DateTime } from 'luxon';

/**
 * Parse a date string in a specific format.
 * @param {string} str - Date string to parse
 * @param {string} fmt - Luxon format string (e.g., 'yyyy-MM-dd', 'dd/MM/yyyy')
 * @param {string} [tz='Asia/Kolkata'] - IANA timezone string
 * @returns {Date|null} - Parsed date in UTC, or null if invalid
 */
export function parseDate(str, fmt, tz = 'Asia/Kolkata') {
  if (!str) return null;
  try {
    const dt = DateTime.fromFormat(str, fmt, { zone: tz });
    if (!dt.isValid) return null;
    return dt.toUTC().toJSDate();
  } catch {
    return null;
  }
}

/**
 * Format a date as YYYY-MM-DD string in a given timezone.
 * @param {Date} date - Date to format
 * @param {string} [tz='Asia/Kolkata'] - IANA timezone string
 * @returns {string} - Date in YYYY-MM-DD format
 */
export function formatDateForCsv(date, tz = 'Asia/Kolkata') {
  if (!date) return '';
  return DateTime.fromJSDate(date, { zone: tz }).toFormat('yyyy-MM-dd');
}

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

/**
 * Calculate the next occurrence date for a recurring rule.
 * Handles clamping for month-end dates (e.g., Jan 31 -> Feb 28/29, Mar 31).
 * @param {Object} rule - Recurring rule object with frequency, startDate, anchorDay
 * @param {Date} [fromDate] - Date to calculate from (defaults to rule.nextRunAt or rule.startDate)
 * @param {string} [tz='Asia/Kolkata'] - IANA timezone string
 * @returns {Date|null} - Next occurrence date in UTC, or null if past endDate
 */
export function nextOccurrence(rule, fromDate = null, tz = 'Asia/Kolkata') {
  const baseDate = fromDate || rule.nextRunAt || rule.startDate;
  if (!baseDate) return null;

  const dt = DateTime.fromJSDate(baseDate, { zone: tz });
  let nextDt;

  switch (rule.frequency) {
    case 'daily':
      nextDt = dt.plus({ days: 1 });
      break;
    case 'weekly':
      nextDt = dt.plus({ weeks: 1 });
      break;
    case 'monthly': {
      // Use anchorDay for monthly recurrence, clamp to month end
      const year = dt.year;
      const month = dt.month;
      // Target month is next month (month + 1, with 13 wrapping to 1 next year)
      let targetYear = year;
      let targetMonth = month + 1;
      if (targetMonth > 12) {
        targetMonth = 1;
        targetYear += 1;
      }
      // Get days in target month using Luxon's daysInMonth
      const daysInTargetMonth = DateTime.fromObject({ year: targetYear, month: targetMonth }, { zone: tz }).daysInMonth;
      const clampedDay = Math.min(rule.anchorDay, daysInTargetMonth);
      nextDt = DateTime.fromObject({ year: targetYear, month: targetMonth, day: clampedDay }, { zone: tz });
      break;
    }
    case 'yearly': {
      const year = dt.year;
      const targetYear = year + 1;
      // For yearly, target month is the same month next year
      const targetMonth = dt.month;
      // Get days in target month (handles Feb 29 in leap years)
      const daysInTargetMonth = DateTime.fromObject({ year: targetYear, month: targetMonth }, { zone: tz }).daysInMonth;
      const clampedDay = Math.min(rule.anchorDay, daysInTargetMonth);
      nextDt = DateTime.fromObject({ year: targetYear, month: targetMonth, day: clampedDay }, { zone: tz });
      break;
    }
    default:
      return null;
  }

  // Check if next occurrence is past endDate
  if (rule.endDate) {
    const endDt = DateTime.fromJSDate(rule.endDate, { zone: tz }).startOf('day');
    if (nextDt > endDt) return null;
  }

  return nextDt.toUTC().toJSDate();
}

/**
 * Generate all due occurrences for a rule up to a given date.
 * Used for catch-up when a rule has been paused or server was down.
 * @param {Object} rule - Recurring rule object
 * @param {Date} until - Calculate occurrences until this date (inclusive)
 * @param {string} [tz='Asia/Kolkata'] - IANA timezone string
 * @returns {Date[]} - Array of occurrence dates in UTC
 */
export function getDueOccurrences(rule, until, tz = 'Asia/Kolkata') {
  const occurrences = [];
  let current = rule.nextRunAt || rule.startDate;
  if (!current) return occurrences;

  const untilDt = DateTime.fromJSDate(until, { zone: tz }).startOf('day');

  while (current) {
    const currentDt = DateTime.fromJSDate(current, { zone: tz }).startOf('day');
    if (currentDt > untilDt) break;

    occurrences.push(current);

    const next = nextOccurrence(rule, current, tz);
    if (!next) break;
    current = next;
  }

  return occurrences;
}