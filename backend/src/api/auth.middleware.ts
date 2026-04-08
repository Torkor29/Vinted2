import crypto from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';
import { findOrCreateUser } from '../services/user.service.js';
import { getRedis } from '../db/redis.js';
import type { DbUser } from '../types/database.js';

declare module 'fastify' {
  interface FastifyRequest {
    telegramUser?: DbUser;
  }
}

const AUTH_MAX_AGE_SECONDS = 3600; // 1 hour

export async function telegramAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    reply.status(401).send({ success: false, error: 'Missing authorization' });
    return;
  }

  // Bearer session token (PWA standalone mode)
  if (authHeader.startsWith('Bearer ')) {
    const sessionToken = authHeader.slice(7);
    try {
      const redis = getRedis();
      const telegramUserId = await redis.get(`session:${sessionToken}`);
      if (!telegramUserId) {
        reply.status(401).send({ success: false, error: 'Invalid or expired session' });
        return;
      }
      const user = await findOrCreateUser({ id: telegramUserId });
      request.telegramUser = user;
    } catch (err) {
      reply.status(500).send({ success: false, error: 'Failed to authenticate user' });
    }
    return;
  }

  // Telegram Mini App initData
  if (!authHeader.startsWith('tma ')) {
    reply.status(401).send({ success: false, error: 'Missing authorization' });
    return;
  }

  const initData = authHeader.slice(4);
  const parsed = validateInitData(initData, config.TELEGRAM_BOT_TOKEN);

  if (!parsed) {
    reply.status(401).send({ success: false, error: 'Invalid authorization' });
    return;
  }

  // Find or create user
  try {
    const user = await findOrCreateUser({
      id: parsed.id,
      username: parsed.username,
      first_name: parsed.first_name,
    });
    request.telegramUser = user;
  } catch (err) {
    reply.status(500).send({ success: false, error: 'Failed to authenticate user' });
  }
}

interface TelegramUserData {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
}

function validateInitData(initData: string, botToken: string): TelegramUserData | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    const authDate = params.get('auth_date');

    if (!hash || !authDate) return null;

    // Check auth_date is not too old
    const authTimestamp = parseInt(authDate, 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authTimestamp > AUTH_MAX_AGE_SECONDS) return null;

    // Build data check string
    params.delete('hash');
    const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

    // Compute HMAC
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computedHash !== hash) return null;

    // Extract user data
    const userStr = params.get('user');
    if (!userStr) return null;

    const user = JSON.parse(userStr) as TelegramUserData;
    return user;
  } catch {
    return null;
  }
}
