import { Composer } from 'grammy';
import type { BotContext } from '../../types/bot.js';
import { findOrCreateUser } from '../../services/user.service.js';
import { getArticlesCount, getPepitesCount } from '../../services/article.service.js';
import { getPurchaseStats } from '../../services/purchase.service.js';
import { getFiltersByUser } from '../../services/filter.service.js';

const composer = new Composer<BotContext>();

composer.command('stats', async (ctx) => {
  if (!ctx.from) return;
  const user = await findOrCreateUser({ id: ctx.from.id, username: ctx.from.username, first_name: ctx.from.first_name });
  await showStats(ctx, user.id);
});

composer.callbackQuery('cmd:stats', async (ctx) => {
  if (!ctx.from) return;
  const user = await findOrCreateUser({ id: ctx.from.id, username: ctx.from.username, first_name: ctx.from.first_name });
  await ctx.answerCallbackQuery();
  await showStats(ctx, user.id);
});

async function showStats(ctx: BotContext, userId: number): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [filters, articlesToday, pepitesToday, totalArticles, totalPepites, purchaseStats] = await Promise.all([
    getFiltersByUser(userId),
    getArticlesCount(userId, today),
    getPepitesCount(userId, today),
    getArticlesCount(userId),
    getPepitesCount(userId),
    getPurchaseStats(userId),
  ]);

  const activeFilters = filters.filter(f => f.is_active).length;

  const text = `📊 <b>Statistiques</b>\n\n` +
    `<b>🔍 Filtres</b>\n` +
    `• Actifs : ${activeFilters}/${filters.length}\n\n` +
    `<b>📦 Articles detectes</b>\n` +
    `• Aujourd'hui : ${articlesToday}\n` +
    `• Total : ${totalArticles}\n\n` +
    `<b>💎 Pepites</b>\n` +
    `• Aujourd'hui : ${pepitesToday}\n` +
    `• Total : ${totalPepites}\n\n` +
    `<b>💰 Finances</b>\n` +
    `• Total investi : ${purchaseStats.totalInvested.toFixed(2)} €\n` +
    `• Total revenus : ${purchaseStats.totalRevenue.toFixed(2)} €\n` +
    `• Profit net : ${purchaseStats.totalProfit.toFixed(2)} €\n` +
    `• ROI moyen : ${purchaseStats.averageRoi.toFixed(1)}%\n` +
    `• Articles achetes : ${purchaseStats.totalPurchases}\n` +
    `• Articles vendus : ${purchaseStats.totalSold}\n` +
    (purchaseStats.avgTimeToSellDays > 0 ? `• Temps moyen de vente : ${purchaseStats.avgTimeToSellDays.toFixed(1)} jours` : '');

  await ctx.reply(text, { parse_mode: 'HTML' });
}

export default composer;
