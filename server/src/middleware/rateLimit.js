import rateLimit from 'express-rate-limit';
import { getEnv } from '../config/env.js';

function createRateLimiters() {
  const { NODE_ENV } = getEnv();
  const isTest = NODE_ENV === 'test';

  return {
    authRateLimit: rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      limit: isTest ? 1000 : 10,
      message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.ip,
    }),
    apiRateLimit: rateLimit({
      windowMs: 60 * 1000, // 1 minute
      limit: isTest ? 10000 : 200,
      message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.ip,
    }),
  };
}

// Lazy getters to avoid calling getEnv() at module load time
let _rateLimiters;

function getRateLimiters() {
  if (!_rateLimiters) {
    _rateLimiters = createRateLimiters();
  }
  return _rateLimiters;
}

export const authRateLimit = (req, res, next) => getRateLimiters().authRateLimit(req, res, next);
export const apiRateLimit = (req, res, next) => getRateLimiters().apiRateLimit(req, res, next);