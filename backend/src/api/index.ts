import type { FastifyInstance } from 'fastify';
import { filtersRoutes } from './filters.routes.js';
import { articlesRoutes } from './articles.routes.js';
import { purchasesRoutes } from './purchases.routes.js';
import { analyticsRoutes } from './analytics.routes.js';
import { catalogRoutes } from './catalog.routes.js';
import { settingsRoutes } from './settings.routes.js';

export async function registerApiRoutes(app: FastifyInstance): Promise<void> {
  await app.register(filtersRoutes);
  await app.register(articlesRoutes);
  await app.register(purchasesRoutes);
  await app.register(analyticsRoutes);
  await app.register(catalogRoutes);
  await app.register(settingsRoutes);
}
