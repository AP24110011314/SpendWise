import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { getEnv } from './config/env.js';
import { getLogger } from './config/logger.js';
import routes from './routes/index.routes.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/error.js';
import { apiRateLimit } from './middleware/rateLimit.js';

export function createApp() {
  const app = express();
  const { CLIENT_ORIGIN } = getEnv();
  const logger = getLogger();

  // Trust proxy for rate limiting behind reverse proxy
  app.set('trust proxy', 1);

  // Logging
  app.use(pinoHttp({ logger }));

  // Security
  app.use(helmet());
  app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));

  // Body parsing
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(cookieParser());

  // API rate limiting
  app.use('/api', apiRateLimit);

  // Routes
  app.use('/api', routes);

  // 404 and error handling
  app.use(notFound);
  app.use(errorHandler);

  return app;
}