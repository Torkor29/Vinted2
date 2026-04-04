import { query, queryOne } from '../db/postgres.js';
import type { DbPurchase } from '../types/database.js';
import type { CreatePurchaseInput, UpdatePurchaseInput, PurchaseStats } from '../types/api.js';

export async function createPurchase(userId: number, input: CreatePurchaseInput): Promise<DbPurchase> {
  const result = await queryOne<DbPurchase>(
    `INSERT INTO purchases (
      user_id, article_id, title, brand_name, category_name,
      vinted_url, photo_url, purchase_price, shipping_cost, status, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      userId, input.article_id ?? null, input.title, input.brand_name ?? null,
      input.category_name ?? null, input.vinted_url ?? null, input.photo_url ?? null,
      input.purchase_price, input.shipping_cost, input.status, input.notes ?? null,
    ],
  );

  if (!result) throw new Error('Failed to create purchase');
  return result;
}

export async function updatePurchase(
  purchaseId: string,
  userId: number,
  input: UpdatePurchaseInput,
): Promise<DbPurchase | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.is_sold !== undefined) { fields.push(`is_sold = $${idx++}`); values.push(input.is_sold); }
  if (input.sold_price !== undefined) { fields.push(`sold_price = $${idx++}`); values.push(input.sold_price); }
  if (input.sold_shipping_cost !== undefined) { fields.push(`sold_shipping_cost = $${idx++}`); values.push(input.sold_shipping_cost); }
  if (input.sold_platform_fee !== undefined) { fields.push(`sold_platform_fee = $${idx++}`); values.push(input.sold_platform_fee); }
  if (input.sold_date !== undefined) { fields.push(`sold_date = $${idx++}`); values.push(input.sold_date); }
  if (input.status !== undefined) { fields.push(`status = $${idx++}`); values.push(input.status); }
  if (input.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(input.notes); }

  if (fields.length === 0) {
    return queryOne<DbPurchase>('SELECT * FROM purchases WHERE id = $1 AND user_id = $2', [purchaseId, userId]);
  }

  fields.push(`updated_at = NOW()`);
  values.push(purchaseId, userId);

  return queryOne<DbPurchase>(
    `UPDATE purchases SET ${fields.join(', ')}
     WHERE id = $${idx++} AND user_id = $${idx}
     RETURNING *`,
    values,
  );
}

export async function deletePurchase(purchaseId: string, userId: number): Promise<boolean> {
  await query('DELETE FROM purchases WHERE id = $1 AND user_id = $2', [purchaseId, userId]);
  return true;
}

export async function getPurchasesByUser(
  userId: number,
  status?: string,
): Promise<DbPurchase[]> {
  if (status) {
    return query<DbPurchase>(
      'SELECT * FROM purchases WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC',
      [userId, status],
    );
  }
  return query<DbPurchase>(
    'SELECT * FROM purchases WHERE user_id = $1 ORDER BY created_at DESC',
    [userId],
  );
}

export async function getPurchaseById(purchaseId: string, userId: number): Promise<DbPurchase | null> {
  return queryOne<DbPurchase>(
    'SELECT * FROM purchases WHERE id = $1 AND user_id = $2',
    [purchaseId, userId],
  );
}

export async function getPurchaseStats(userId: number): Promise<PurchaseStats> {
  const result = await queryOne<{
    total_invested: string | null;
    total_revenue: string | null;
    total_profit: string | null;
    total_purchases: string;
    total_sold: string;
    avg_time_to_sell: string | null;
  }>(
    `SELECT
      COALESCE(SUM(total_cost), 0) as total_invested,
      COALESCE(SUM(CASE WHEN is_sold THEN sold_price ELSE 0 END), 0) as total_revenue,
      COALESCE(SUM(profit), 0) as total_profit,
      COUNT(*) as total_purchases,
      COUNT(*) FILTER (WHERE is_sold) as total_sold,
      AVG(EXTRACT(EPOCH FROM (sold_date - purchased_at)) / 86400) FILTER (WHERE is_sold AND sold_date IS NOT NULL) as avg_time_to_sell
    FROM purchases
    WHERE user_id = $1`,
    [userId],
  );

  const totalInvested = parseFloat(result?.total_invested ?? '0');
  const totalRevenue = parseFloat(result?.total_revenue ?? '0');
  const totalProfit = parseFloat(result?.total_profit ?? '0');
  const totalPurchases = parseInt(result?.total_purchases ?? '0', 10);
  const totalSold = parseInt(result?.total_sold ?? '0', 10);
  const avgRoi = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  return {
    totalInvested: Math.round(totalInvested * 100) / 100,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    averageRoi: Math.round(avgRoi * 100) / 100,
    totalPurchases,
    totalSold,
    avgTimeToSellDays: Math.round(parseFloat(result?.avg_time_to_sell ?? '0') * 10) / 10,
  };
}
