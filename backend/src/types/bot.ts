import type { Context } from 'grammy';
import type { DbUser } from './database.js';

export interface SessionData {
  userId: number | null;
}

export interface BotContext extends Context {
  session: SessionData;
  dbUser?: DbUser;
}

export interface TopicIds {
  general: number | null;
  feed: number | null;
  pepites: number | null;
}

export interface NotificationPayload {
  type: 'article' | 'pepite';
  userId: number;
  articleId: number;
  filterId: string;
  vintedId: string;
  title: string;
  price: string;
  currency: string;
  brandName: string | null;
  sizeName: string | null;
  conditionName: string | null;
  photoUrl: string | null;
  vintedUrl: string;
  sellerUsername: string | null;
  sellerRating: string | null;
  estimatedMarketPrice: string | null;
  priceDifferencePct: string | null;
}
