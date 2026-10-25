import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { getEnv } from './config/env.js';
import { getLogger } from './config/logger.js';
import { startRecurringCron, runStartupCatchUp } from './jobs/recurring.jobs.js';

const { PORT, NODE_ENV } = getEnv();
const logger = getLogger();

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
      import('express').then(({ default: express }) => {
        app.use(express.static('client/dist'));
        app.get('*', (req, res) => {
          if (!req.path.startsWith('/api')) {
            res.sendFile('index.html', { root: 'client/dist' });
          }
        });
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