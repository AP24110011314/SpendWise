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

  // CORS configuration - all origins are imported from CLIENT_ORIGIN in .env
  const allowedOrigins = CLIENT_ORIGIN
    .split(',')
    .map(o => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no Origin header (e.g., server-to-server, curl, Postman, health check)
      if (!origin) {
        return callback(null, true);
      }
      const normalizedOrigin = origin.replace(/\/$/, '');
      const isAllowed = allowedOrigins.some((allowed) => {
        if (allowed === '*') return true;
        if (allowed === normalizedOrigin) return true;
        // Support wildcard patterns from CLIENT_ORIGIN (e.g. *.vercel.app, http://localhost:*)
        if (allowed.includes('*')) {
          const pattern = '^' + allowed.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
          return new RegExp(pattern).test(normalizedOrigin);
        }
        return false;
      });

      if (isAllowed) {
        return callback(null, true);
      }
      // Disallowed origin: respond without CORS headers
      return callback(null, false);
    },
    credentials: true,
  };

  app.use(cors(corsOptions));

  // Health check endpoints for Render and monitoring
  app.get('/health', (req, res) => res.status(200).json({ status: 'ok', service: 'SpendWise API' }));
  app.get('/', (req, res) => res.status(200).json({ status: 'ok', service: 'SpendWise API', health: '/api/health' }));

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