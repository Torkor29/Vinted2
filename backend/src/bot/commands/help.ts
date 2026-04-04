import { Composer, InlineKeyboard } from 'grammy';
import type { BotContext } from '../../types/bot.js';
import { config } from '../../config.js';

const composer = new Composer<BotContext>();

composer.command('help', async (ctx) => {
  await showHelp(ctx);
});

composer.callbackQuery('cmd:help', async (ctx) => {
  await ctx.answerCallbackQuery();
  await showHelp(ctx);
});

async function showHelp(ctx: BotContext): Promise<void> {
  const keyboard = new InlineKeyboard()
    .webApp('📱 Ouvrir la Mini App', config.WEBAPP_URL);

  await ctx.reply(
    `❓ <b>Guide d'utilisation</b>\n\n` +
    `<b>Commandes disponibles :</b>\n` +
    `/start — Menu principal\n` +
    `/filters — Gerer mes filtres\n` +
    `/stats — Voir mes statistiques\n` +
    `/purchases — Resume achats/reventes\n` +
    `/settings — Parametres\n` +
    `/help — Ce message\n\n` +
    `<b>Comment ca marche ?</b>\n\n` +
    `1️⃣ <b>Cree un filtre</b> dans la Mini App avec tes criteres (marque, taille, prix, etat...)\n\n` +
    `2️⃣ <b>Le bot scanne Vinted</b> en temps reel et te previent des qu'un nouvel article correspond a tes filtres\n\n` +
    `3️⃣ <b>Les pepites</b> 💎 sont les articles dont le prix est significativement inferieur au prix moyen du marche\n\n` +
    `4️⃣ <b>Suivi financier</b> : ajoute tes achats et reventes pour suivre ta rentabilite\n\n` +
    `<b>Topics du groupe :</b>\n` +
    `📋 General — Commandes et menus\n` +
    `📦 Feed — Tous les articles detectes\n` +
    `💎 Pepites — Les bonnes affaires uniquement`,
    {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    },
  );
}

export default composer;
