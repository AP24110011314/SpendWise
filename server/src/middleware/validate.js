import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';

export function validate(schema) {
  return (req, res, next) => {
    // Filter out empty string query parameters so optional schema fields are treated as undefined
    const cleanQuery = {};
    if (req.query && typeof req.query === 'object') {
      for (const [key, val] of Object.entries(req.query)) {
        if (val !== '' && val !== undefined && val !== null) {
          cleanQuery[key] = val;
        }
      }
    }

    const data = {
      body: req.body,
      query: cleanQuery,
      params: req.params,
    };

    const result = schema.safeParse(data);
    if (!result.success) {
      const details = result.error.flatten().fieldErrors;
      return next(ApiError.badRequest('Validation failed', details));
    }

    req.validated = result.data;
    next();
  };
}

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');
export const idParamSchema = z.object({ id: objectIdSchema });
export const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM');
export const dateSchema = z.union([
  z.string().datetime({ offset: true }),
  z.string().datetime(),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
]).transform(s => {
  const str = String(s);
  return new Date(str.includes('T') ? str : `${str}T12:00:00.000Z`);
});
export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').transform(s => new Date(s + 'T00:00:00.000Z'));
export const amountSchema = z.coerce.number().int().min(1).max(100_000_000_000);