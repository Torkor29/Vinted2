import { query, queryOne } from '../db/postgres.js';
import { dedup } from '../db/redis.js';
import { config } from '../config.js';
import { getPhotoUrl, getAllPhotoUrls, getFullVintedUrl } from '../scraper/parser.js';
import type { DbArticle } from '../types/database.js';
import type { VintedItem } from '../types/vinted.js';

export async function saveNewArticles(
  filterId: string,
  userId: number,
  items: VintedItem[],
): Promise<DbArticle[]> {
  const newArticles: DbArticle[] = [];

  for (const item of items) {
    const vintedId = String(item.id);

    // Check Redis dedup
    if (await dedup.has(vintedId)) {
      continue;
    }

    // Mark as seen in Redis (48h TTL)
    await dedup.add(vintedId);

    const photoUrl = getPhotoUrl(item);
    const photoUrls = getAllPhotoUrls(item);
    const vintedUrl = getFullVintedUrl(config.VINTED_DOMAIN, item.url);
    const colorNames = [item.colour1, item.colour2].filter(Boolean).join(', ') || null;

    try {
      const article = await queryOne<DbArticle>(
        `INSERT INTO articles (
          vinted_id, filter_id, user_id, title, description, price, currency,
          brand_name, size_name, condition_name, color_names, category_name,
          photo_url, photo_urls, vinted_url,
          seller_username, seller_rating, seller_country
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        ) ON CONFLICT (vinted_id) DO NOTHING
        RETURNING *`,
        [
          vintedId, filterId, userId, item.title, item.description,
          item.price, item.currency, item.brand_title, item.size_title,
          item.status, colorNames, null, // category_name extracted later if needed
          photoUrl, photoUrls.length > 0 ? photoUrls : null, vintedUrl,
          item.user.login,
          item.user.feedback_reputation != null ? String(item.user.feedback_reputation) : null,
          item.user.country_title,
        ],
      );

      if (article) {
        newArticles.push(article);
      }
    } catch (err) {
      // Skip duplicate articles silently
      if ((err as { code?: string }).code !== '23505') {
        throw err;
      }
    }
  }

  return newArticles;
}

export async function markAsPepite(
  articleId: number,
  marketPrice: number,
  diffPct: number,
): Promise<void> {
  await query(
    `UPDATE articles SET
      is_pepite = TRUE,
      estimated_market_price = $2,
      price_difference_pct = $3
    WHERE id = $1`,
    [articleId, marketPrice, diffPct],
  );
}

export async function markAsNotified(articleId: number): Promise<void> {
  await query('UPDATE articles SET is_notified = TRUE WHERE id = $1', [articleId]);
}

export async function getArticlesByFilter(
  filterId: string,
  cursor: string | undefined,
  limit: number = 20,
): Promise<DbArticle[]> {
  if (cursor) {
    return query<DbArticle>(
      `SELECT * FROM articles
       WHERE filter_id = $1 AND detected_at < $2
       ORDER BY detected_at DESC
       LIMIT $3`,
      [filterId, cursor, limit],
    );
  }

  return query<DbArticle>(
    `SELECT * FROM articles
     WHERE filter_id = $1
     ORDER BY detected_at DESC
     LIMIT $2`,
    [filterId, limit],
  );
}

export async function getArticlesByUser(
  userId: number,
  cursor: string | undefined,
  limit: number = 20,
  pepitesOnly: boolean = false,
): Promise<DbArticle[]> {
  const pepiteClause = pepitesOnly ? 'AND is_pepite = TRUE' : '';

  if (cursor) {
    return query<DbArticle>(
      `SELECT * FROM articles
       WHERE user_id = $1 AND detected_at < $2 ${pepiteClause}
       ORDER BY detected_at DESC
       LIMIT $3`,
      [userId, cursor, limit],
    );
  }

  return query<DbArticle>(
    `SELECT * FROM articles
     WHERE user_id = $1 ${pepiteClause}
     ORDER BY detected_at DESC
     LIMIT $2`,
    [userId, limit],
  );
}

export async function getArticleById(articleId: number): Promise<DbArticle | null> {
  return queryOne<DbArticle>('SELECT * FROM articles WHERE id = $1', [articleId]);
}

export async function getArticlesCount(userId: number, since?: Date): Promise<number> {
  const sinceClause = since ? 'AND detected_at >= $2' : '';
  const params: unknown[] = [userId];
  if (since) params.push(since.toISOString());

  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM articles WHERE user_id = $1 ${sinceClause}`,
    params,
  );
  return parseInt(result?.count ?? '0', 10);
}

export async function getPepitesCount(userId: number, since?: Date): Promise<number> {
  const sinceClause = since ? 'AND detected_at >= $2' : '';
  const params: unknown[] = [userId];
  if (since) params.push(since.toISOString());

  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM articles WHERE user_id = $1 AND is_pepite = TRUE ${sinceClause}`,
    params,
  );
  return parseInt(result?.count ?? '0', 10);
}
