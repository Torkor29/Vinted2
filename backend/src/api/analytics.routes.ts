import type { FastifyInstance } from 'fastify';
import { telegramAuthMiddleware } from './auth.middleware.js';
import { analyticsQuerySchema } from '../types/api.js';
import { getArticlesCount, getPepitesCount } from '../services/article.service.js';
import { getPurchaseStats } from '../services/purchase.service.js';
import { query } from '../db/postgres.js';
import type { AnalyticsOverview, ProfitTimeline } from '../types/api.js';

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', telegramAuthMiddleware);

  // Overview
  app.get('/api/analytics/overview', async (request) => {
    const user = request.telegramUser!;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalArticles, totalPepites, articlesToday, pepitesToday, purchaseStats] = await Promise.all([
      getArticlesCount(user.id),
      getPepitesCount(user.id),
      getArticlesCount(user.id, today),
      getPepitesCount(user.id, today),
      getPurchaseStats(user.id),
    ]);

    const overview: AnalyticsOverview = {
      totalArticlesDetected: totalArticles,
      totalPepites,
      articlesToday,
      pepitesToday,
      purchaseStats,
    };

    return { success: true, data: overview };
  });

  // Profit timeline
  app.get('/api/analytics/profit-timeline', async (request) => {
    const user = request.telegramUser!;

    const parsed = analyticsQuerySchema.safeParse(request.query);
    const period = parsed.success ? parsed.data.period : '30d';

    const intervalMap: Record<string, string> = {
      '7d': '7 days',
      '30d': '30 days',
      '90d': '90 days',
      'all': '10 years',
    };

    const rows = await query<{ date: string; daily_profit: string }>(
      `SELECT
        DATE(sold_date) as date,
        COALESCE(SUM(profit), 0) as daily_profit
      FROM purchases
      WHERE user_id = $1 AND is_sold = TRUE AND sold_date IS NOT NULL
        AND sold_date >= NOW() - INTERVAL '${intervalMap[period] ?? '30 days'}'
      GROUP BY DATE(sold_date)
      ORDER BY date ASC`,
      [user.id],
    );

    let cumulative = 0;
    const timeline: ProfitTimeline[] = rows.map(row => {
      const profit = parseFloat(row.daily_profit);
      cumulative += profit;
      return {
        date: row.date,
        profit: Math.round(profit * 100) / 100,
        cumulative: Math.round(cumulative * 100) / 100,
      };
    });

    return { success: true, data: timeline };
  });

  // Top brands by profit
  app.get('/api/analytics/top-brands', async (request) => {
    const user = request.telegramUser!;

    const brands = await query<{ brand: string; count: string; total_profit: string; avg_profit: string }>(
      `SELECT
        COALESCE(brand_name, 'Autre') as brand,
        COUNT(*) as count,
        COALESCE(SUM(profit), 0) as total_profit,
        COALESCE(AVG(profit), 0) as avg_profit
      FROM purchases
      WHERE user_id = $1 AND is_sold = TRUE
      GROUP BY brand_name
      ORDER BY total_profit DESC
      LIMIT 10`,
      [user.id],
    );

    return {
      success: true,
      data: brands.map(b => ({
        brand: b.brand,
        count: parseInt(b.count, 10),
        totalProfit: Math.round(parseFloat(b.total_profit) * 100) / 100,
        avgProfit: Math.round(parseFloat(b.avg_profit) * 100) / 100,
      })),
    };
  });
}
