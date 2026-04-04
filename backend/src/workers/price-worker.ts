import cron from 'node-cron';
import pino from 'pino';
import { refreshPriceReferences } from '../services/price.service.js';

const logger = pino({ name: 'price-worker' });

let task: cron.ScheduledTask | null = null;

export function startPriceWorker(): void {
  // Run every 6 hours
  task = cron.schedule('0 */6 * * *', async () => {
    logger.info('Starting price reference refresh');
    try {
      await refreshPriceReferences();
      logger.info('Price reference refresh completed');
    } catch (err) {
      logger.error({ err }, 'Price reference refresh failed');
    }
  });

  logger.info('Price worker scheduled (every 6 hours)');
}

export function stopPriceWorker(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
