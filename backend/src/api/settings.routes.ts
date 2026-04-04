import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { telegramAuthMiddleware } from './auth.middleware.js';
import { updateUserSettings, getUserById } from '../services/user.service.js';

const updateSettingsSchema = z.object({
  notification_enabled: z.boolean().optional(),
  max_filters: z.number().min(1).max(20).optional(),
});

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', telegramAuthMiddleware);

  // Get user settings
  app.get('/api/settings', async (request) => {
    const user = request.telegramUser!;
    return {
      success: true,
      data: {
        notification_enabled: user.notification_enabled,
        max_filters: user.max_filters,
        is_premium: user.is_premium,
        telegram_username: user.telegram_username,
        telegram_first_name: user.telegram_first_name,
      },
    };
  });

  // Update user settings
  app.put('/api/settings', async (request, reply) => {
    const user = request.telegramUser!;

    const parsed = updateSettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.issues });
    }

    const updated = await updateUserSettings(user.id, parsed.data);
    if (!updated) {
      return reply.status(500).send({ success: false, error: 'Failed to update settings' });
    }

    return {
      success: true,
      data: {
        notification_enabled: updated.notification_enabled,
        max_filters: updated.max_filters,
        is_premium: updated.is_premium,
      },
    };
  });
}
