import { z } from 'zod';

// --- Filter schemas ---

export const createFilterSchema = z.object({
  name: z.string().min(1).max(255),
  search_text: z.string().max(500).nullable().optional(),
  catalog_ids: z.array(z.number()).nullable().optional(),
  brand_ids: z.array(z.number()).nullable().optional(),
  size_ids: z.array(z.number()).nullable().optional(),
  color_ids: z.array(z.number()).nullable().optional(),
  material_ids: z.array(z.number()).nullable().optional(),
  status_ids: z.array(z.number()).nullable().optional(),
  price_from: z.number().min(0).nullable().optional(),
  price_to: z.number().min(0).nullable().optional(),
  currency: z.string().length(3).default('EUR'),
  country_ids: z.array(z.number()).nullable().optional(),
  city_ids: z.array(z.number()).nullable().optional(),
  shipping_options: z.array(z.number()).nullable().optional(),
  is_unisex: z.boolean().nullable().optional(),
  sort_by: z.enum(['newest_first', 'price_low_to_high', 'price_high_to_low', 'relevance']).default('newest_first'),
  scan_interval_seconds: z.number().min(3).max(60).default(3),
  pepite_enabled: z.boolean().default(true),
  pepite_threshold: z.number().min(0.1).max(0.7).default(0.30),
});

export type CreateFilterInput = z.infer<typeof createFilterSchema>;

export const updateFilterSchema = createFilterSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export type UpdateFilterInput = z.infer<typeof updateFilterSchema>;

// --- Purchase schemas ---

export const createPurchaseSchema = z.object({
  article_id: z.number().nullable().optional(),
  title: z.string().min(1).max(500),
  brand_name: z.string().max(255).nullable().optional(),
  category_name: z.string().max(255).nullable().optional(),
  vinted_url: z.string().url().nullable().optional(),
  photo_url: z.string().url().nullable().optional(),
  purchase_price: z.number().min(0),
  shipping_cost: z.number().min(0).default(0),
  status: z.enum(['purchased', 'listed', 'sold', 'returned']).default('purchased'),
  notes: z.string().nullable().optional(),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

export const updatePurchaseSchema = z.object({
  is_sold: z.boolean().optional(),
  sold_price: z.number().min(0).nullable().optional(),
  sold_shipping_cost: z.number().min(0).nullable().optional(),
  sold_platform_fee: z.number().min(0).nullable().optional(),
  sold_date: z.string().datetime().nullable().optional(),
  status: z.enum(['purchased', 'listed', 'sold', 'returned']).optional(),
  notes: z.string().nullable().optional(),
});

export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;

// --- Query params ---

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

export const articleQuerySchema = paginationSchema.extend({
  filter_id: z.string().uuid().optional(),
  pepites_only: z.coerce.boolean().optional(),
});

export type ArticleQueryParams = z.infer<typeof articleQuerySchema>;

export const analyticsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
});

export type AnalyticsQueryParams = z.infer<typeof analyticsQuerySchema>;

// --- API responses ---

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  cursor: string | null;
  hasMore: boolean;
}

export interface PurchaseStats {
  totalInvested: number;
  totalRevenue: number;
  totalProfit: number;
  averageRoi: number;
  totalPurchases: number;
  totalSold: number;
  avgTimeToSellDays: number;
}

export interface AnalyticsOverview {
  totalArticlesDetected: number;
  totalPepites: number;
  articlesToday: number;
  pepitesToday: number;
  purchaseStats: PurchaseStats;
}

export interface ProfitTimeline {
  date: string;
  profit: number;
  cumulative: number;
}
