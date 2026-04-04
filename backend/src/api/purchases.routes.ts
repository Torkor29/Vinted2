import type { FastifyInstance } from 'fastify';
import { telegramAuthMiddleware } from './auth.middleware.js';
import { createPurchaseSchema, updatePurchaseSchema } from '../types/api.js';
import * as purchaseService from '../services/purchase.service.js';

export async function purchasesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', telegramAuthMiddleware);

  // Get all purchases (JSON or CSV)
  app.get<{ Querystring: { status?: string; format?: string } }>('/api/purchases', async (request, reply) => {
    const user = request.telegramUser!;
    const purchases = await purchaseService.getPurchasesByUser(user.id, request.query.status);

    // CSV export
    if (request.query.format === 'csv') {
      const header = 'Titre,Marque,Prix achat,Frais port,Cout total,Vendu,Prix vente,Commission,Profit,Profit %,Statut,Date achat,Notes\n';
      const rows = purchases.map(p =>
        [
          csvEscape(p.title),
          csvEscape(p.brand_name ?? ''),
          p.purchase_price,
          p.shipping_cost,
          p.total_cost,
          p.is_sold ? 'Oui' : 'Non',
          p.sold_price ?? '',
          p.sold_platform_fee ?? '',
          p.profit ?? '',
          p.profit_pct ? `${p.profit_pct}%` : '',
          p.status,
          p.purchased_at,
          csvEscape(p.notes ?? ''),
        ].join(','),
      ).join('\n');

      const csv = '\uFEFF' + header + rows; // BOM for Excel UTF-8 compat

      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="vinted-achats.csv"')
        .send(csv);
    }

    return { success: true, data: purchases };
  });

  // Get purchase stats
  app.get('/api/purchases/stats', async (request) => {
    const user = request.telegramUser!;
    const stats = await purchaseService.getPurchaseStats(user.id);
    return { success: true, data: stats };
  });

  // Get single purchase
  app.get<{ Params: { id: string } }>('/api/purchases/:id', async (request, reply) => {
    const user = request.telegramUser!;
    const purchase = await purchaseService.getPurchaseById(request.params.id, user.id);

    if (!purchase) {
      return reply.status(404).send({ success: false, error: 'Purchase not found' });
    }

    return { success: true, data: purchase };
  });

  // Create purchase
  app.post('/api/purchases', async (request, reply) => {
    const user = request.telegramUser!;

    const parsed = createPurchaseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.issues });
    }

    const purchase = await purchaseService.createPurchase(user.id, parsed.data);
    return reply.status(201).send({ success: true, data: purchase });
  });

  // Update purchase
  app.put<{ Params: { id: string } }>('/api/purchases/:id', async (request, reply) => {
    const user = request.telegramUser!;

    const parsed = updatePurchaseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.issues });
    }

    const purchase = await purchaseService.updatePurchase(request.params.id, user.id, parsed.data);
    if (!purchase) {
      return reply.status(404).send({ success: false, error: 'Purchase not found' });
    }

    return { success: true, data: purchase };
  });

  // Delete purchase
  app.delete<{ Params: { id: string } }>('/api/purchases/:id', async (request) => {
    const user = request.telegramUser!;
    await purchaseService.deletePurchase(request.params.id, user.id);
    return { success: true };
  });
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
