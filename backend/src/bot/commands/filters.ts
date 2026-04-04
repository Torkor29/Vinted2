import { Composer, InlineKeyboard } from 'grammy';
import type { BotContext } from '../../types/bot.js';
import { findOrCreateUser } from '../../services/user.service.js';
import { getFiltersByUser, toggleFilter } from '../../services/filter.service.js';
import { config } from '../../config.js';

const composer = new Composer<BotContext>();

composer.command('filters', async (ctx) => {
  if (!ctx.from) return;
  const user = await findOrCreateUser({ id: ctx.from.id, username: ctx.from.username, first_name: ctx.from.first_name });
  await showFilters(ctx, user.id);
});

composer.callbackQuery('cmd:filters', async (ctx) => {
  if (!ctx.from) return;
  const user = await findOrCreateUser({ id: ctx.from.id, username: ctx.from.username, first_name: ctx.from.first_name });
  await ctx.answerCallbackQuery();
  await showFilters(ctx, user.id);
});

composer.callbackQuery(/^toggle:(.+)$/, async (ctx) => {
  if (!ctx.from) return;
  const user = await findOrCreateUser({ id: ctx.from.id, username: ctx.from.username, first_name: ctx.from.first_name });
  const filterId = ctx.match[1]!;

  const filter = await toggleFilter(filterId, user.id);
  if (filter) {
    await ctx.answerCallbackQuery({
      text: filter.is_active ? '✅ Filtre active' : '⏸️ Filtre desactive',
    });
  } else {
    await ctx.answerCallbackQuery({ text: '❌ Filtre introuvable' });
  }

  // Refresh the filter list
  await showFilters(ctx, user.id, true);
});

async function showFilters(ctx: BotContext, userId: number, edit: boolean = false): Promise<void> {
  const filters = await getFiltersByUser(userId);

  if (filters.length === 0) {
    const keyboard = new InlineKeyboard()
      .webApp('➕ Creer un filtre', `${config.WEBAPP_URL}/filters/new`);

    const text = '🔍 <b>Mes Filtres</b>\n\nTu n\'as pas encore de filtre. Cree-en un pour commencer a surveiller Vinted !';

    if (edit) {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
    }
    return;
  }

  const keyboard = new InlineKeyboard();

  for (const filter of filters) {
    const status = filter.is_active ? '🟢' : '🔴';
    const label = `${status} ${filter.name}`;
    keyboard.text(label, `toggle:${filter.id}`).row();
  }

  keyboard.webApp('➕ Nouveau filtre', `${config.WEBAPP_URL}/filters/new`).row();
  keyboard.webApp('📱 Gerer dans la Mini App', config.WEBAPP_URL);

  const text = `🔍 <b>Mes Filtres</b> (${filters.length}/${config.MAX_FILTERS_PER_USER})\n\n` +
    `Appuie sur un filtre pour l'activer/desactiver :`;

  if (edit) {
    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
  } else {
    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
  }
}

export default composer;
