import { Composer, InlineKeyboard } from 'grammy';
import type { BotContext } from '../../types/bot.js';
import { findOrCreateUser } from '../../services/user.service.js';
import { getArticlesByUser } from '../../services/article.service.js';
import { getPurchaseStats } from '../../services/purchase.service.js';
import { config } from '../../config.js';

const composer = new Composer<BotContext>();

// Handle pepites callback
composer.callbackQuery('cmd:pepites', async (ctx) => {
  if (!ctx.from) return;
  const user = await findOrCreateUser({ id: ctx.from.id, username: ctx.from.username, first_name: ctx.from.first_name });
  await ctx.answerCallbackQuery();

  const pepites = await getArticlesByUser(user.id, undefined, 5, true);

  if (pepites.length === 0) {
    await ctx.reply(
      '💎 <b>Pepites</b>\n\nAucune pepite detectee pour le moment. Active des filtres avec la detection de pepites !',
      { parse_mode: 'HTML' },
    );
    return;
  }

  let text = '💎 <b>Dernieres Pepites</b>\n\n';

  for (const pepite of pepites) {
    const diff = pepite.price_difference_pct ? `${pepite.price_difference_pct}%` : '';
    text += `• <b>${pepite.title ?? 'Sans titre'}</b>\n`;
    text += `  💰 ${pepite.price} ${pepite.currency}`;
    if (pepite.estimated_market_price) {
      text += ` (marche: ${pepite.estimated_market_price} €)`;
    }
    if (diff) {
      text += ` 📉 ${diff}`;
    }
    text += `\n  🔗 <a href="${pepite.vinted_url}">Voir</a>\n\n`;
  }

  const keyboard = new InlineKeyboard()
    .webApp('📱 Voir tout dans la Mini App', `${config.WEBAPP_URL}/feed?pepites=true`);

  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
});

// Handle purchases command via callback
composer.command('purchases', async (ctx) => {
  if (!ctx.from) return;
  const user = await findOrCreateUser({ id: ctx.from.id, username: ctx.from.username, first_name: ctx.from.first_name });

  const stats = await getPurchaseStats(user.id);

  const keyboard = new InlineKeyboard()
    .webApp('📱 Gerer les achats', `${config.WEBAPP_URL}/purchases`);

  await ctx.reply(
    `🛒 <b>Resume Achats/Reventes</b>\n\n` +
    `📦 Articles achetes : ${stats.totalPurchases}\n` +
    `✅ Articles vendus : ${stats.totalSold}\n\n` +
    `💸 Total investi : ${stats.totalInvested.toFixed(2)} €\n` +
    `💰 Total revenus : ${stats.totalRevenue.toFixed(2)} €\n` +
    `📈 Profit net : <b>${stats.totalProfit.toFixed(2)} €</b>\n` +
    `📊 ROI moyen : ${stats.averageRoi.toFixed(1)}%`,
    { parse_mode: 'HTML', reply_markup: keyboard },
  );
});

// Settings command
composer.command('settings', async (ctx) => {
  const keyboard = new InlineKeyboard()
    .webApp('⚙️ Ouvrir les parametres', `${config.WEBAPP_URL}/settings`);

  await ctx.reply(
    '⚙️ <b>Parametres</b>\n\nOuvre la Mini App pour gerer tes parametres.',
    { parse_mode: 'HTML', reply_markup: keyboard },
  );
});

export default composer;
