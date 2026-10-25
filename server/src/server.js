import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { getEnv } from './config/env.js';
import { getLogger } from './config/logger.js';
import { startRecurringCron, runStartupCatchUp } from './jobs/recurring.jobs.js';
import path from 'path';
import { fileURLToPath } from 'url';
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

    // Serve static files in production
    if (NODE_ENV === 'production') {
      app.use(express.static(clientDistPath));
      app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
          res.sendFile('index.html', { root: clientDistPath });
        }
      });
    }

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} (${NODE_ENV})`);
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

start();