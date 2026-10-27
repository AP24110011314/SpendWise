import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { getEnv } from './config/env.js';
import { getLogger } from './config/logger.js';
import { startRecurringCron, runStartupCatchUp } from './jobs/recurring.jobs.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'node:fs';
import express from 'express';

const { PORT, NODE_ENV } = getEnv();
const logger = getLogger();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// server/src -> project root is ../../
const projectRoot = path.resolve(__dirname, '..', '..');
const clientDistPath = path.join(projectRoot, 'client', 'dist');

async function start() {
  try {
    await connectDB();

    const app = createApp();

    // Start recurring rules cron job
    startRecurringCron();

    // Run startup catch-up for recurring rules
    await runStartupCatchUp();

    // Serve static files in production if built client exists (monolithic deployment)
    if (NODE_ENV === 'production' && fs.existsSync(path.join(clientDistPath, 'index.html'))) {
      app.use(express.static(clientDistPath));
      app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
          res.sendFile('index.html', { root: clientDistPath });
        }
      });
    }

    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} (${NODE_ENV})`);
    });

    // Graceful shutdown handling
    const shutdown = (signal) => {
      logger.info(`Received ${signal}, closing HTTP server...`);
      server.close(() => {
        logger.info('HTTP server closed cleanly');
        process.exit(0);
      });
      setTimeout(() => {
        logger.warn('Forcing server shutdown after timeout');
        process.exit(1);
      }, 2000).unref();
    };

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

start();