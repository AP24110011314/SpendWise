import crypto from 'crypto';

/**
 * Generate a SHA1 fingerprint for transaction deduplication.
 * Uses userId, categoryId, date, type, amount, and note to ensure uniqueness per user.
 * @param {Object} params
 * @param {string|ObjectId} params.userId - User ID
 * @param {string|ObjectId} params.categoryId - Category ID
 * @param {string} params.type - 'income' or 'expense'
 * @param {number} params.amount - Amount in minor units
 * @param {Date|string} params.date - Transaction date
 * @param {string} [params.note=''] - Transaction note
 * @returns {string} - SHA1 hash hex string
 */
export function generateFingerprint({ userId, categoryId, type, amount, date, note = '' }) {
  const normalizedNote = String(note).toLowerCase().replace(/\s+/g, ' ').trim();
  const dateObj = date instanceof Date ? date : new Date(date);
  const dateStr = dateObj.toISOString().split('T')[0];
  const str = `${userId}|${categoryId}|${dateStr}|${type}|${amount}|${normalizedNote}`;
  return crypto.createHash('sha1').update(str).digest('hex');
}