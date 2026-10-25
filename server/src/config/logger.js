import pino from 'pino';
import { getEnv } from './env.js';

let logger;

export function getLogger() {
  if (logger) return logger;
  const { LOG_LEVEL, NODE_ENV } = getEnv();
  logger = pino({
    level: LOG_LEVEL,
    transport: NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
    } : undefined,
  });
  return logger;
}