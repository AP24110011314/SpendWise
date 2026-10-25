export function toMinorUnits(major) {
  if (typeof major !== 'number' || !Number.isFinite(major)) {
    throw new Error('Amount must be a finite number');
  }
  if (major <= 0) {
    throw new Error('Amount must be positive');
  }
  return Math.round(major * 100);
}

export function fromMinorUnits(minor) {
  if (!Number.isInteger(minor)) {
    throw new Error('Minor units must be an integer');
  }
  return minor / 100;
}

export function validateMinorUnits(amount) {
  return Number.isInteger(amount) && amount >= 1 && amount <= 100_000_000_000;
}