import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';

export function validate(schema) {
  return (req, res, next) => {
    const data = {
      body: req.body,
      query: req.query,
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
export const dateSchema = z.string().datetime({ offset: true }).transform(s => new Date(s));
export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').transform(s => new Date(s + 'T00:00:00.000Z'));
export const amountSchema = z.coerce.number().int().min(1).max(100_000_000_000);