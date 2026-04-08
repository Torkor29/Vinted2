import crypto from 'crypto';
import { Composer } from 'grammy';
import type { BotContext } from '../../types/bot.js';
import { getRedis } from '../../db/redis.js';
import { config } from '../../config.js';

const LOGIN_TOKEN_TTL = 600; // 10 minutes

const composer = new Composer<BotContext>();

composer.command('login', async (ctx) => {
  if (!ctx.from) return;

  const token = crypto.randomBytes(16).toString('hex');
  const telegramUserId = String(ctx.from.id);

  const redis = getRedis();
  await redis.setex(`login_token:${token}`, LOGIN_TOKEN_TTL, telegramUserId);

  const loginUrl = `${config.APP_URL}/auth?token=${token}`;

  await ctx.reply(
    `🔐 Clique ici pour ouvrir l'application :\n${loginUrl}\n\n⏱ Lien valide 10 minutes.`,
  );
});

export default composer;
