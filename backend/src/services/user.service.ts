import { query, queryOne } from '../db/postgres.js';
import type { DbUser } from '../types/database.js';

interface TelegramUser {
  id: number | string;
  username?: string;
  first_name?: string;
}

export async function findOrCreateUser(telegramUser: TelegramUser): Promise<DbUser> {
  const telegramId = String(telegramUser.id);

  const existing = await queryOne<DbUser>(
    'SELECT * FROM users WHERE telegram_id = $1',
    [telegramId],
  );

  if (existing) {
    // Update username/name if changed
    if (existing.telegram_username !== (telegramUser.username ?? null) ||
        existing.telegram_first_name !== (telegramUser.first_name ?? null)) {
      const updated = await queryOne<DbUser>(
        `UPDATE users SET
          telegram_username = $2,
          telegram_first_name = $3,
          updated_at = NOW()
        WHERE telegram_id = $1
        RETURNING *`,
        [telegramId, telegramUser.username ?? null, telegramUser.first_name ?? null],
      );
      return updated ?? existing;
    }
    return existing;
  }

  const newUser = await queryOne<DbUser>(
    `INSERT INTO users (telegram_id, telegram_username, telegram_first_name)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [telegramId, telegramUser.username ?? null, telegramUser.first_name ?? null],
  );

  if (!newUser) {
    throw new Error('Failed to create user');
  }

  return newUser;
}

export async function getUserById(id: number): Promise<DbUser | null> {
  return queryOne<DbUser>('SELECT * FROM users WHERE id = $1', [id]);
}

export async function getUserByTelegramId(telegramId: string): Promise<DbUser | null> {
  return queryOne<DbUser>('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
}

export async function updateUserSettings(
  userId: number,
  settings: { notification_enabled?: boolean; max_filters?: number },
): Promise<DbUser | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (settings.notification_enabled !== undefined) {
    sets.push(`notification_enabled = $${paramIndex++}`);
    values.push(settings.notification_enabled);
  }
  if (settings.max_filters !== undefined) {
    sets.push(`max_filters = $${paramIndex++}`);
    values.push(settings.max_filters);
  }

  if (sets.length === 0) return getUserById(userId);

  sets.push(`updated_at = NOW()`);
  values.push(userId);

  return queryOne<DbUser>(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values,
  );
}
