import crypto from 'crypto';
import type { FastifyInstance } from 'fastify';
import { getRedis } from '../db/redis.js';
import { findOrCreateUser } from '../services/user.service.js';

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/auth/exchange — exchange one-time login token for session token
  app.post<{ Body: { token: string } }>('/api/auth/exchange', async (request, reply) => {
    const { token } = request.body ?? {};

    if (!token || typeof token !== 'string') {
      return reply.status(400).send({ success: false, error: 'Missing token' });
    }

    const redis = getRedis();
    const loginKey = `login_token:${token}`;
    const telegramUserId = await redis.get(loginKey);

    if (!telegramUserId) {
      return reply.status(401).send({ success: false, error: 'Invalid or expired token' });
    }

    // Delete the one-time token
    await redis.del(loginKey);

    // Find or create user
    const user = await findOrCreateUser({ id: telegramUserId });

    // Create session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionKey = `session:${sessionToken}`;
    await redis.setex(sessionKey, SESSION_TTL_SECONDS, telegramUserId);

    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

    return { success: true, sessionToken, expiresAt, user };
  });

  // POST /api/auth/logout — delete session from Redis
  app.post('/api/auth/logout', async (request, reply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ success: false, error: 'Missing authorization' });
    }

    const sessionToken = authHeader.slice(7);
    const redis = getRedis();
    await redis.del(`session:${sessionToken}`);

    return { success: true };
  });
}
