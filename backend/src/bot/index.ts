import { Bot } from 'grammy';
import type { BotContext, NotificationPayload } from '../types/bot.js';
import { config } from '../config.js';
import { pubsub } from '../db/redis.js';
import { CHANNELS } from '../services/notification.service.js';
import { markAsNotified } from '../services/article.service.js';
import { setupNotificationSender } from './notifications/sender.js';
import { initTopics } from './notifications/topic-router.js';
import startCommand from './commands/start.js';
import filtersCommand from './commands/filters.js';
import statsCommand from './commands/stats.js';
import helpCommand from './commands/help.js';
import loginCommand from './commands/login.js';
import callbackHandler from './handlers/callback.js';
import webappDataHandler from './handlers/webapp-data.js';
import pino from 'pino';

const logger = pino({ name: 'bot' });

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.TELEGRAM_BOT_TOKEN);

  // Error handler
  bot.catch((err) => {
    logger.error({ err: err.error, ctx: err.ctx?.update?.update_id }, 'Bot error');
  });

  // Register commands
  bot.use(startCommand);
  bot.use(filtersCommand);
  bot.use(statsCommand);
  bot.use(helpCommand);
  bot.use(loginCommand);

  // Register handlers
  bot.use(callbackHandler);
  bot.use(webappDataHandler);

  return bot;
}

export async function startBot(bot: Bot<BotContext>): Promise<void> {
  // Initialize forum topics
  await initTopics(bot);

  // Setup notification sender
  const { sendArticle, sendPepite } = setupNotificationSender(bot);

  // Subscribe to Redis pub/sub for notifications
  await pubsub.subscribe(CHANNELS.NEW_ARTICLE, async (data) => {
    const payload = data as NotificationPayload;
    try {
      await sendArticle(payload);
      await markAsNotified(payload.articleId);
    } catch (err) {
      logger.error({ err, articleId: payload.articleId }, 'Failed to send article notification');
    }
  });

  await pubsub.subscribe(CHANNELS.NEW_PEPITE, async (data) => {
    const payload = data as NotificationPayload;
    try {
      await sendPepite(payload);
    } catch (err) {
      logger.error({ err, articleId: payload.articleId }, 'Failed to send pepite notification');
    }
  });

  // Set bot commands menu
  await bot.api.setMyCommands([
    { command: 'start', description: 'Menu principal' },
    { command: 'filters', description: 'Gerer mes filtres' },
    { command: 'stats', description: 'Mes statistiques' },
    { command: 'purchases', description: 'Achats/Reventes' },
    { command: 'settings', description: 'Parametres' },
    { command: 'help', description: 'Aide' },
    { command: 'login', description: 'Ouvrir l\'application PWA' },
  ]);

  // Start polling
  bot.start({
    onStart: () => {
      logger.info('Bot is running');
    },
  });
}

export async function stopBot(bot: Bot<BotContext>): Promise<void> {
  await bot.stop();
  logger.info('Bot stopped');
}
