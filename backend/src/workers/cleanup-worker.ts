import cron from 'node-cron';
import pino from 'pino';
import { query } from '../db/postgres.js';

const logger = pino({ name: 'cleanup-worker' });

let task: cron.ScheduledTask | null = null;

export function startCleanupWorker(): void {
  // Run daily at 3 AM
  task = cron.schedule('0 3 * * *', async () => {
    logger.info('Starting cleanup');
    try {
      // Delete articles older than 30 days
      const articlesResult = await query(
        `DELETE FROM articles WHERE detected_at < NOW() - INTERVAL '30 days' RETURNING id`,
      );
      logger.info({ count: articlesResult.length }, 'Deleted old articles');

      // Delete expired price references
      const pricesResult = await query(
        `DELETE FROM price_references WHERE expires_at < NOW() RETURNING id`,
      );
      logger.info({ count: pricesResult.length }, 'Deleted expired price references');

      // Vacuum analyze for performance
      await query('VACUUM ANALYZE articles');
      await query('VACUUM ANALYZE price_references');

      logger.info('Cleanup completed');
    } catch (err) {
      logger.error({ err }, 'Cleanup failed');
    }
  });

  logger.info('Cleanup worker scheduled (daily at 3 AM)');
}

export function stopCleanupWorker(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
