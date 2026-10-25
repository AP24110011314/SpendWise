import rateLimit from 'express-rate-limit';
import { getEnv } from '../config/env.js';

// Dynamic limit functions to support test mode without calling getEnv at module load
function getAuthLimit() {
  const { NODE_ENV } = getEnv();
  return NODE_ENV === 'test' ? 1000 : 10;
}

function getApiLimit() {
  const { NODE_ENV } = getEnv();
  return NODE_ENV === 'test' ? 10000 : 200;
}

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: getAuthLimit,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: getApiLimit,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
});