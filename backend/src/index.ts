import Fastify from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import pino from 'pino';
import { config } from './config.js';
import { connectPostgres, closePostgres } from './db/postgres.js';
import { connectRedis, closeRedis } from './db/redis.js';
import { runMigrations } from './db/migrate.js';
import { createBot, startBot, stopBot } from './bot/index.js';
import { registerApiRoutes } from './api/index.js';
import { startScanWorker, stopScanWorker } from './workers/scan-worker.js';
import { startPriceWorker, stopPriceWorker } from './workers/price-worker.js';
import { startCleanupWorker, stopCleanupWorker } from './workers/cleanup-worker.js';

const logger = pino({
  level: config.LOG_LEVEL,
  transport: config.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

async function main() {
  logger.info('Starting Vinted Bot...');

  // Connect to databases
  await connectPostgres();
  logger.info('PostgreSQL connected');

  await connectRedis();
  logger.info('Redis connected');

  // Run migrations
  await runMigrations();
  logger.info('Database migrations applied');

  // Create Fastify server
  const app = Fastify({ logger });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(compress);

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register API routes
  await registerApiRoutes(app);

  // Create and start Telegram bot
  const bot = createBot();
  await startBot(bot);
  logger.info('Telegram bot started');

  // Start workers
  startScanWorker();
  logger.info('Scan worker started');

  startPriceWorker();
  logger.info('Price worker started');

  startCleanupWorker();
  logger.info('Cleanup worker started');

  // Start HTTP server
  await app.listen({ port: config.PORT, host: config.HOST });
  logger.info(`Server listening on ${config.HOST}:${config.PORT}`);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    stopScanWorker();
    stopPriceWorker();
    stopCleanupWorker();

    await stopBot(bot);
    await app.close();
    await closeRedis();
    await closePostgres();

    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error(err, 'Fatal error during startup');
  process.exit(1);
});
