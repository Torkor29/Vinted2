import type { VintedItem, VintedCatalogResponse } from '../types/vinted.js';

export function parseSearchResponse(data: unknown): VintedCatalogResponse {
  const obj = data as Record<string, unknown>;

  const items: VintedItem[] = [];
  const rawItems = obj.items as Record<string, unknown>[] | undefined;

  if (Array.isArray(rawItems)) {
    for (const raw of rawItems) {
      const item = parseItem(raw);
      if (item) {
        items.push(item);
      }
    }
  }

  const rawPagination = obj.pagination as Record<string, unknown> | undefined;

  return {
    items,
    pagination: {
      current_page: Number(rawPagination?.current_page ?? 1),
      total_pages: Number(rawPagination?.total_pages ?? 1),
      total_entries: Number(rawPagination?.total_entries ?? 0),
      per_page: Number(rawPagination?.per_page ?? 96),
      time: Number(rawPagination?.time ?? 0),
    },
  };
}

function parseItem(raw: Record<string, unknown>): VintedItem | null {
  if (!raw.id || !raw.title) return null;

  const photo = raw.photo as Record<string, unknown> | null;
  const rawPhotos = raw.photos as Record<string, unknown>[] | undefined;
  const user = raw.user as Record<string, unknown> | undefined;
  const userPhoto = user?.photo as Record<string, unknown> | null | undefined;

  return {
    id: Number(raw.id),
    title: String(raw.title),
    description: raw.description ? String(raw.description) : null,
    price: String(raw.price ?? '0'),
    discount: raw.discount ? String(raw.discount) : null,
    currency: String(raw.currency ?? 'EUR'),
    brand_title: raw.brand_title ? String(raw.brand_title) : null,
    size_title: raw.size_title ? String(raw.size_title) : null,
    status: raw.status ? String(raw.status) : null,
    colour1: raw.colour1 ? String(raw.colour1) : null,
    colour2: raw.colour2 ? String(raw.colour2) : null,
    url: String(raw.url ?? ''),
    photo: photo ? {
      id: Number(photo.id ?? 0),
      url: String(photo.url ?? ''),
      dominant_color: photo.dominant_color ? String(photo.dominant_color) : null,
      dominant_color_opaque: photo.dominant_color_opaque ? String(photo.dominant_color_opaque) : null,
      is_main: Boolean(photo.is_main),
    } : null,
    photos: Array.isArray(rawPhotos) ? rawPhotos.map(p => ({
      id: Number(p.id ?? 0),
      url: String(p.url ?? ''),
      dominant_color: p.dominant_color ? String(p.dominant_color) : null,
      dominant_color_opaque: p.dominant_color_opaque ? String(p.dominant_color_opaque) : null,
      is_main: Boolean(p.is_main),
    })) : [],
    user: {
      id: Number(user?.id ?? 0),
      login: String(user?.login ?? ''),
      feedback_reputation: user?.feedback_reputation != null ? Number(user.feedback_reputation) : null,
      photo: userPhoto ? { url: String(userPhoto.url ?? '') } : null,
      country_title: user?.country_title ? String(user.country_title) : null,
    },
    favourite_count: Number(raw.favourite_count ?? 0),
    is_visible: Boolean(raw.is_visible ?? true),
    created_at_ts: String(raw.created_at_ts ?? ''),
    view_count: raw.view_count != null ? Number(raw.view_count) : null,
    content_source: raw.content_source ? String(raw.content_source) : null,
    category_id: raw.category_id != null ? Number(raw.category_id) : null,
  };
}

export function getFullVintedUrl(domain: string, itemPath: string): string {
  if (itemPath.startsWith('http')) return itemPath;
  return `https://${domain}${itemPath.startsWith('/') ? '' : '/'}${itemPath}`;
}

export function getPhotoUrl(item: VintedItem): string | null {
  return item.photo?.url ?? item.photos[0]?.url ?? null;
}

export function getAllPhotoUrls(item: VintedItem): string[] {
  if (item.photos.length > 0) {
    return item.photos.map(p => p.url);
  }
  if (item.photo?.url) {
    return [item.photo.url];
  }
  return [];
}
