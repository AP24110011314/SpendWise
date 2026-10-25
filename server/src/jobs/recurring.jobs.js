import cron from 'node-cron';
import { User } from '../models/User.js';
import { processDueRules } from '../services/recurring.service.js';

/**
 * Start the recurring rules processing cron job
 * Runs every hour at minute 0
 */
export function startRecurringCron() {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('[Cron] Processing due recurring rules...');
      const users = await User.find({}).select('_id').lean();

      let totalProcessed = 0;
      let totalCreated = 0;
      let totalSkipped = 0;
      let totalErrors = 0;

      for (const user of users) {
        const results = await processDueRules(user._id);
        totalProcessed += results.processedCount;
        totalCreated += results.createdCount;
        totalSkipped += results.skippedCount;
        totalErrors += results.errors.length;

        if (results.errors.length > 0) {
          console.error(`[Cron] Errors processing rules for user ${user._id}:`, results.errors);
        }
      }

      if (totalCreated > 0 || totalErrors > 0) {
        console.log(`[Cron] Processed: ${totalProcessed}, Created: ${totalCreated}, Skipped: ${totalSkipped}, Errors: ${totalErrors}`);
      }
    } catch (err) {
      console.error('[Cron] Error processing recurring rules:', err);
    }
  });

  console.log('[Cron] Recurring rules processing job scheduled (hourly)');
}

/**
 * Run catch-up for all users at startup
 * Processes any rules that were due while the server was down
 */
export async function runStartupCatchUp() {
  try {
    console.log('[Cron] Running startup catch-up for recurring rules...');
    const users = await User.find({}).select('_id').lean();

    let totalProcessed = 0;
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const user of users) {
      const results = await processDueRules(user._id);
      totalProcessed += results.processedCount;
      totalCreated += results.createdCount;
      totalSkipped += results.skippedCount;
      totalErrors += results.errors.length;

      if (results.errors.length > 0) {
        console.error(`[Cron] Errors in catch-up for user ${user._id}:`, results.errors);
      }
    }

    console.log(`[Cron] Startup catch-up complete: Processed: ${totalProcessed}, Created: ${totalCreated}, Skipped: ${totalSkipped}, Errors: ${totalErrors}`);
  } catch (err) {
    console.error('[Cron] Error in startup catch-up:', err);
  }
}