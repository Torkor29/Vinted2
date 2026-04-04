import type { FastifyInstance } from 'fastify';
import { telegramAuthMiddleware } from './auth.middleware.js';
import { createFilterSchema, updateFilterSchema } from '../types/api.js';
import * as filterService from '../services/filter.service.js';

export async function filtersRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', telegramAuthMiddleware);

  // Get all filters for user
  app.get('/api/filters', async (request) => {
    const user = request.telegramUser!;
    const filters = await filterService.getFiltersByUser(user.id);
    return { success: true, data: filters };
  });

  // Get single filter
  app.get<{ Params: { id: string } }>('/api/filters/:id', async (request, reply) => {
    const user = request.telegramUser!;
    const filter = await filterService.getFilterById(request.params.id);

    if (!filter || filter.user_id !== user.id) {
      return reply.status(404).send({ success: false, error: 'Filter not found' });
    }

    return { success: true, data: filter };
  });

  // Create filter
  app.post('/api/filters', async (request, reply) => {
    const user = request.telegramUser!;

    const parsed = createFilterSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.issues });
    }

    try {
      const filter = await filterService.createFilter(user.id, parsed.data);
      return reply.status(201).send({ success: true, data: filter });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(400).send({ success: false, error: message });
    }
  });

  // Update filter
  app.put<{ Params: { id: string } }>('/api/filters/:id', async (request, reply) => {
    const user = request.telegramUser!;

    const parsed = updateFilterSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.issues });
    }

    const filter = await filterService.updateFilter(request.params.id, user.id, parsed.data);
    if (!filter) {
      return reply.status(404).send({ success: false, error: 'Filter not found' });
    }

    return { success: true, data: filter };
  });

  // Delete filter
  app.delete<{ Params: { id: string } }>('/api/filters/:id', async (request, reply) => {
    const user = request.telegramUser!;
    await filterService.deleteFilter(request.params.id, user.id);
    return { success: true };
  });

  // Toggle filter active/inactive
  app.patch<{ Params: { id: string } }>('/api/filters/:id/toggle', async (request, reply) => {
    const user = request.telegramUser!;
    const filter = await filterService.toggleFilter(request.params.id, user.id);

    if (!filter) {
      return reply.status(404).send({ success: false, error: 'Filter not found' });
    }

    return { success: true, data: filter };
  });
}
