export interface VintedItemPhoto {
  id: number;
  url: string;
  dominant_color: string | null;
  dominant_color_opaque: string | null;
  is_main: boolean;
}

export interface VintedItemUser {
  id: number;
  login: string;
  feedback_reputation: number | null;
  photo: { url: string } | null;
  country_title: string | null;
}

export interface VintedItem {
  id: number;
  title: string;
  description: string | null;
  price: string; // "45.00"
  discount: string | null;
  currency: string;
  brand_title: string | null;
  size_title: string | null;
  status: string | null;
  colour1: string | null;
  colour2: string | null;
  url: string;
  photo: VintedItemPhoto | null;
  photos: VintedItemPhoto[];
  user: VintedItemUser;
  favourite_count: number;
  is_visible: boolean;
  created_at_ts: string;
  view_count: number | null;
  content_source: string | null;
  category_id: number | null;
}

export interface VintedCatalogResponse {
  items: VintedItem[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_entries: number;
    per_page: number;
    time: number;
  };
}

export interface VintedSearchParams {
  search_text?: string;
  catalog_ids?: string;
  brand_ids?: string;
  size_ids?: string;
  color_ids?: string;
  material_ids?: string;
  status_ids?: string;
  price_from?: number;
  price_to?: number;
  currency?: string;
  country_ids?: string;
  city_ids?: string;
  order?: 'newest_first' | 'price_low_to_high' | 'price_high_to_low' | 'relevance';
  page?: number;
  per_page?: number;
}

export interface VintedCookie {
  value: string;
  domain: string;
  expiresAt: number;
}

export interface VintedCategory {
  id: number;
  name: string;
  children?: VintedCategory[];
}

export interface VintedColor {
  id: number;
  name: string;
  hex: string;
}

export interface VintedCondition {
  id: number;
  name: string;
  description: string;
}

export interface VintedBrand {
  id: number;
  title: string;
  slug: string;
  favourite_count: number;
}
