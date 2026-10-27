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

  // Security - allow cross-origin requests from frontend deployments
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // CORS configuration - allow all .vercel.app deployments and origins from CLIENT_ORIGIN
  const clientOrigins = CLIENT_ORIGIN
    .split(',')
    .map(o => o.trim().replace(/^["']|["']$/g, '').replace(/\/$/, ''))
    .filter(Boolean);

  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no Origin header (e.g., server-to-server, curl, Postman, health check)
      if (!origin) {
        return callback(null, true);
      }
      const normalizedOrigin = origin.trim().replace(/\/$/, '');

      // Always allow any Vercel deployment (production, preview PRs) and local development
      if (
        normalizedOrigin.endsWith('.vercel.app') ||
        normalizedOrigin.startsWith('http://localhost:') ||
        normalizedOrigin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }

      const isAllowed = clientOrigins.some((allowed) => {
        if (allowed === '*' || allowed === normalizedOrigin) return true;
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
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 204,
  };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

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