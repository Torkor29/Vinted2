import { pubsub } from '../db/redis.js';
import type { DbArticle, DbFilter } from '../types/database.js';
import type { NotificationPayload } from '../types/bot.js';
import pino from 'pino';

const logger = pino({ name: 'notification-service' });

export const CHANNELS = {
  NEW_ARTICLE: 'notifications:feed',
  NEW_PEPITE: 'notifications:pepites',
} as const;

export function buildNotificationPayload(
  article: DbArticle,
  filter: DbFilter,
): NotificationPayload {
  return {
    type: article.is_pepite ? 'pepite' : 'article',
    userId: article.user_id,
    articleId: article.id,
    filterId: filter.id,
    vintedId: article.vinted_id,
    title: article.title ?? 'Sans titre',
    price: article.price,
    currency: article.currency,
    brandName: article.brand_name,
    sizeName: article.size_name,
    conditionName: article.condition_name,
    photoUrl: article.photo_url,
    vintedUrl: article.vinted_url,
    sellerUsername: article.seller_username,
    sellerRating: article.seller_rating,
    estimatedMarketPrice: article.estimated_market_price,
    priceDifferencePct: article.price_difference_pct,
  };
}

export async function publishNewArticle(article: DbArticle, filter: DbFilter): Promise<void> {
  const payload = buildNotificationPayload(article, filter);

  await pubsub.publish(CHANNELS.NEW_ARTICLE, payload);
  logger.debug({ articleId: article.id, vintedId: article.vinted_id }, 'Published new article notification');

  if (article.is_pepite) {
    await pubsub.publish(CHANNELS.NEW_PEPITE, payload);
    logger.debug({ articleId: article.id }, 'Published pepite notification');
  }
}
