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
  const { CLIENT_ORIGIN, NODE_ENV } = getEnv();
  const logger = getLogger();

  // Trust proxy for rate limiting behind reverse proxy
  app.set('trust proxy', 1);

  // Logging
  app.use(pinoHttp({ logger }));

  // Security
  app.use(helmet());

  // CORS configuration
  const isDevelopment = NODE_ENV !== 'production';
  const clientOrigins = CLIENT_ORIGIN.split(',').map(o => o.trim()).filter(Boolean);
  const devOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ];
  const allowedOrigins = isDevelopment
    ? [...new Set([...clientOrigins, ...devOrigins])]
    : clientOrigins;

  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no Origin header (e.g., server-to-server, curl, Postman)
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Disallowed origin: respond without CORS headers (or 403 with standard error envelope)
      // Never pass an Error to next()
      return callback(null, false);
    },
    credentials: true,
  };

  app.use(cors(corsOptions));

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