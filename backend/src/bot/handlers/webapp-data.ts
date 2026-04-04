import { Composer } from 'grammy';
import type { BotContext } from '../../types/bot.js';
import pino from 'pino';

const logger = pino({ name: 'webapp-data' });

const composer = new Composer<BotContext>();

// Handle data sent from Telegram Mini App via sendData()
composer.on('message:web_app_data', async (ctx) => {
  if (!ctx.message.web_app_data) return;

  try {
    const data = JSON.parse(ctx.message.web_app_data.data) as {
      action: string;
      payload: unknown;
    };

    logger.info({ action: data.action }, 'Received webapp data');

    switch (data.action) {
      case 'filter_created':
        await ctx.reply('✅ Filtre cree avec succes ! Le scan va demarrer automatiquement.');
        break;

      case 'filter_updated':
        await ctx.reply('✅ Filtre mis a jour !');
        break;

      case 'purchase_added':
        await ctx.reply('✅ Achat enregistre !');
        break;

      case 'purchase_sold':
        await ctx.reply('✅ Vente enregistree ! Ton profit a ete calcule.');
        break;

      default:
        logger.warn({ action: data.action }, 'Unknown webapp action');
    }
  } catch (err) {
    logger.error({ err }, 'Failed to parse webapp data');
  }
});

export default composer;
