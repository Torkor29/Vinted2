export interface DbUser {
  id: number;
  telegram_id: string; // bigint stored as string
  telegram_username: string | null;
  telegram_first_name: string | null;
  is_premium: boolean;
  max_filters: number;
  notification_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DbFilter {
  id: string; // UUID
  user_id: number;
  name: string;
  is_active: boolean;

  // Search criteria
  search_text: string | null;
  catalog_ids: number[] | null;
  brand_ids: number[] | null;
  size_ids: number[] | null;
  color_ids: number[] | null;
  material_ids: number[] | null;
  status_ids: number[] | null;
  price_from: string | null; // DECIMAL as string
  price_to: string | null;
  currency: string;

  // Advanced filters
  country_ids: number[] | null;
  city_ids: number[] | null;
  shipping_options: number[] | null;
  is_unisex: boolean | null;

  // Sort and monitoring
  sort_by: string;
  scan_interval_seconds: number;

  // Pepite detection
  pepite_enabled: boolean;
  pepite_threshold: string; // DECIMAL as string

  last_scanned_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbArticle {
  id: number;
  vinted_id: string; // bigint as string
  filter_id: string | null;
  user_id: number;

  title: string | null;
  description: string | null;
  price: string; // DECIMAL as string
  currency: string;
  brand_name: string | null;
  size_name: string | null;
  condition_name: string | null;
  color_names: string | null;
  category_name: string | null;

  photo_url: string | null;
  photo_urls: string[] | null;
  vinted_url: string;

  seller_username: string | null;
  seller_rating: string | null;
  seller_country: string | null;

  // Price analysis
  estimated_market_price: string | null;
  price_difference_pct: string | null;
  is_pepite: boolean;

  // Status
  is_notified: boolean;
  is_sold: boolean;
  is_reserved: boolean;

  detected_at: Date;
  created_at: Date;
}

export interface DbPurchase {
  id: string; // UUID
  user_id: number;
  article_id: number | null;

  title: string;
  brand_name: string | null;
  category_name: string | null;
  vinted_url: string | null;
  photo_url: string | null;

  // Purchase finance
  purchase_price: string;
  shipping_cost: string;
  total_cost: string; // generated column

  // Resale finance
  is_sold: boolean;
  sold_price: string | null;
  sold_shipping_cost: string | null;
  sold_platform_fee: string | null;
  sold_date: Date | null;

  // Computed
  profit: string | null; // generated column
  profit_pct: string | null; // generated column

  status: 'purchased' | 'listed' | 'sold' | 'returned';
  notes: string | null;

  purchased_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface DbPriceReference {
  id: number;
  search_key: string;
  catalog_id: number | null;
  brand_id: number | null;
  size_id: string | null;
  condition_id: number | null;

  avg_price: string | null;
  median_price: string | null;
  min_price: string | null;
  max_price: string | null;
  sample_count: number | null;

  calculated_at: Date;
  expires_at: Date;
}
