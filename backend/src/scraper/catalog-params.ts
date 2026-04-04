import type { DbFilter } from '../types/database.js';
import type { VintedSearchParams } from '../types/vinted.js';

export function buildSearchParams(filter: DbFilter): VintedSearchParams {
  const params: VintedSearchParams = {
    order: filter.sort_by as VintedSearchParams['order'],
    per_page: 96,
  };

  if (filter.search_text) {
    params.search_text = filter.search_text;
  }

  if (filter.catalog_ids?.length) {
    params.catalog_ids = filter.catalog_ids.join(',');
  }

  if (filter.brand_ids?.length) {
    params.brand_ids = filter.brand_ids.join(',');
  }

  if (filter.size_ids?.length) {
    params.size_ids = filter.size_ids.join(',');
  }

  if (filter.color_ids?.length) {
    params.color_ids = filter.color_ids.join(',');
  }

  if (filter.material_ids?.length) {
    params.material_ids = filter.material_ids.join(',');
  }

  if (filter.status_ids?.length) {
    params.status_ids = filter.status_ids.join(',');
  }

  if (filter.price_from) {
    params.price_from = parseFloat(filter.price_from);
  }

  if (filter.price_to) {
    params.price_to = parseFloat(filter.price_to);
  }

  if (filter.currency && filter.currency !== 'EUR') {
    params.currency = filter.currency;
  }

  if (filter.country_ids?.length) {
    params.country_ids = filter.country_ids.join(',');
  }

  if (filter.city_ids?.length) {
    params.city_ids = filter.city_ids.join(',');
  }

  return params;
}

export function buildSearchUrl(domain: string, params: VintedSearchParams): string {
  const url = new URL(`https://${domain}/api/v2/catalog/items`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  // Add timestamp to prevent caching
  url.searchParams.set('time', String(Date.now()));

  return url.toString();
}
