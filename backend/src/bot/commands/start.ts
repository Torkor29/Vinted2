import { Composer, InlineKeyboard } from 'grammy';
import type { BotContext } from '../../types/bot.js';
import { findOrCreateUser } from '../../services/user.service.js';
import { config } from '../../config.js';

const composer = new Composer<BotContext>();

composer.command('start', async (ctx) => {
  if (!ctx.from) return;

  const user = await findOrCreateUser({
    id: ctx.from.id,
    username: ctx.from.username,
    first_name: ctx.from.first_name,
  });

  ctx.dbUser = user;

  const keyboard = new InlineKeyboard()
    .webApp('📱 Ouvrir la Mini App', config.WEBAPP_URL)
    .row()
    .text('🔍 Mes Filtres', 'cmd:filters')
    .text('📊 Statistiques', 'cmd:stats')
    .row()
    .text('💎 Pepites', 'cmd:pepites')
    .text('❓ Aide', 'cmd:help');

  await ctx.reply(
    `🛍️ <b>Bienvenue sur Vinted Bot !</b>\n\n` +
    `Salut ${user.telegram_first_name ?? 'ami'} ! 👋\n\n` +
    `Je surveille Vinted en temps reel pour toi et te previens des que je trouve des articles qui correspondent a tes filtres.\n\n` +
    `💎 Je detecte aussi les <b>pepites</b> — les articles dont le prix est bien en dessous du marche !\n\n` +
    `<b>Pour commencer :</b>\n` +
    `1️⃣ Ouvre la Mini App pour creer tes filtres\n` +
    `2️⃣ Active les notifications\n` +
    `3️⃣ Attends les alertes !\n\n` +
    `Utilise /help pour voir toutes les commandes.`,
    {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    },
  );
});

export default composer;
