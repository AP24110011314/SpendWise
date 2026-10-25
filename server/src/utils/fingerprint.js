import crypto from 'crypto';

export function generateFingerprint(date, type, amount, note) {
  const normalizedNote = note.toLowerCase().replace(/\s+/g, ' ').trim();
  const dateStr = date.toISOString().split('T')[0];
  const str = `${dateStr}|${type}|${amount}|${normalizedNote}`;
  return crypto.createHash('sha1').update(str).digest('hex');
}