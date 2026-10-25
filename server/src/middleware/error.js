import { getLogger } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';
import { ZodError } from 'zod';
import mongoose from 'mongoose';

export function errorHandler(err, _req, res, _next) {
  const logger = getLogger();

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.flatten().fieldErrors,
      },
    });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details = {};
    for (const [field, error] of Object.entries(err.errors)) {
      details[field] = [error.message];
    }
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details },
    });
  }

  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid ID format', details: { [err.path]: [err.message] } },
    });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      error: { code: 'CONFLICT', message: `${field} already exists`, details: { [field]: ['already exists'] } },
    });
  }

  if (err instanceof ApiError) {
    logger.warn({ err: err.message, code: err.code, path: _req.path }, 'API error');
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  logger.error({ err, path: _req.path }, 'Unhandled error');
  return res.status(500).json({
    error: { code: 'INTERNAL', message: 'Internal server error' },
  });
}