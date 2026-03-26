import { createLogger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';

const log = createLogger('query');

// Country code to flag emoji mapping
const COUNTRY_FLAGS = {
  fr: '\u{1F1EB}\u{1F1F7}', de: '\u{1F1E9}\u{1F1EA}', es: '\u{1F1EA}\u{1F1F8}',
  it: '\u{1F1EE}\u{1F1F9}', nl: '\u{1F1F3}\u{1F1F1}', be: '\u{1F1E7}\u{1F1EA}',
  pt: '\u{1F1F5}\u{1F1F9}', pl: '\u{1F1F5}\u{1F1F1}', lt: '\u{1F1F1}\u{1F1F9}',
  cz: '\u{1F1E8}\u{1F1FF}', at: '\u{1F1E6}\u{1F1F9}', uk: '\u{1F1EC}\u{1F1E7}',
  us: '\u{1F1FA}\u{1F1F8}',
};

/**
 * VintedSearch - Query system for searching Vinted catalog.
 *
 * Uses Vinted's internal catalog API which returns JSON.
 * Supports keyword search, filters, pagination, and deduplication.
 */
export class VintedSearch {
  constructor(client) {
    this.client = client;
    // Track seen item IDs for deduplication
    this.seenItems = new Map(); // id → timestamp
    // Cleanup old seen items every 30 minutes
    this.cleanupTimer = setInterval(() => this.cleanupSeen(), 30 * 60_000);
  }

  /**
   * Search for items with full filter support.
   *
   * @param {string} country - Country code (fr, de, etc.)
   * @param {Object} query - Search parameters
   * @param {string} query.text - Search keywords
   * @param {number} query.priceFrom - Minimum price
   * @param {number} query.priceTo - Maximum price
   * @param {string[]} query.brandIds - Brand IDs to filter
   * @param {string[]} query.sizeIds - Size IDs to filter
   * @param {string[]} query.catalogIds - Category IDs
   * @param {string[]} query.statusIds - Item condition IDs
   * @param {string} query.order - Sort order (newest_first, price_low_to_high, etc.)
   * @param {number} query.page - Page number
   * @param {number} query.perPage - Items per page (max 96)
   */
  async search(country, query = {}) {
    const params = this.buildParams(query);

    const result = await withRetry(
      () => this.client.request(country, '/catalog/items', { params }),
      {
        attempts: 3,
        backoffMs: 2000,
        label: `search(${query.text || 'all'})`,
        isSilentFailure: (res) => {
          // Detect silent invalidation: 200 but empty items
          return res.status === 200 &&
            res.data?.items &&
            res.data.items.length === 0 &&
            query.text; // Empty results for specific search = likely dead session
        },
      },
    );

    if (!result.success) {
      log.error(`Search failed for "${query.text}"`);
      return { items: [], total: 0, page: query.page || 1, error: true };
    }

    const data = result.data?.data || result.data;
    const items = (data?.items || []).map(item => this.normalizeItem(item, country));
    const total = data?.pagination?.total_entries || items.length;

    log.info(`Search "${query.text || 'all'}": ${items.length} items (total: ${total}) [${result.data?.session}]`);

    return {
      items,
      total,
      page: query.page || 1,
      perPage: query.perPage || 24,
    };
  }

  /**
   * Poll for new items matching a query.
   * Returns only items not seen before (deduplication).
   */
  async pollNewItems(country, query = {}) {
    // Always sort by newest to catch new listings
    const searchQuery = { ...query, order: 'newest_first', page: 1, perPage: 24 };
    const result = await this.search(country, searchQuery);

    if (result.error) return [];

    const newItems = result.items.filter(item => {
      if (this.seenItems.has(item.id)) return false;
      this.seenItems.set(item.id, Date.now());
      return true;
    });

    // ── Post-filter: Vinted API sometimes ignores some filters ──
    // Double-check locally that items match the query criteria
    const filtered = this.postFilter(newItems, query);

    if (filtered.length > 0) {
      log.info(`Found ${filtered.length} new items for "${query.text || 'all'}"${filtered.length < newItems.length ? ` (${newItems.length - filtered.length} filtered out locally)` : ''}`);
    }

    return filtered;
  }

  /**
   * Local post-filter to catch items the API returned despite not matching.
   * Vinted's API sometimes ignores brand/size/price filters.
   */
  postFilter(items, query) {
    if (!items.length) return items;

    const labels = query._labels || {};

    return items.filter(item => {
      // Price filter
      if (query.priceTo && item.price > query.priceTo) {
        log.debug(`Filtered out "${item.title}" — price ${item.price}€ > max ${query.priceTo}€`);
        return false;
      }
      if (query.priceFrom && item.price < query.priceFrom) {
        log.debug(`Filtered out "${item.title}" — price ${item.price}€ < min ${query.priceFrom}€`);
        return false;
      }

      // Brand filter (if labels available, check by name since IDs may mismatch)
      if (labels.brands?.length > 0 && item.brand) {
        const itemBrand = item.brand.toLowerCase();
        const matchesBrand = labels.brands.some(b => itemBrand.includes(b.toLowerCase()) || b.toLowerCase().includes(itemBrand));
        if (!matchesBrand) {
          log.debug(`Filtered out "${item.title}" — brand "${item.brand}" not in [${labels.brands}]`);
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Get full item details.
   */
  async getItemDetails(country, itemId) {
    const result = await withRetry(
      () => this.client.request(country, `/items/${itemId}`),
      { attempts: 2, label: `item(${itemId})` },
    );

    if (!result.success) return null;

    const data = result.data?.data || result.data;
    return data?.item ? this.normalizeItemDetails(data.item) : null;
  }

  /**
   * Build API query parameters from search query.
   */
  buildParams(query) {
    const params = {};

    if (query.text) params.search_text = query.text;
    if (query.priceFrom) params.price_from = query.priceFrom;
    if (query.priceTo) params.price_to = query.priceTo;
    if (query.order) params.order = query.order;
    if (query.page) params.page = query.page;
    if (query.perPage) params.per_page = Math.min(query.perPage, 96);

    // Array filters
    if (query.brandIds?.length) params.brand_ids = query.brandIds.join(',');
    if (query.sizeIds?.length) params.size_ids = query.sizeIds.join(',');
    if (query.catalogIds?.length) params.catalog_ids = query.catalogIds.join(',');
    if (query.statusIds?.length) params.status_ids = query.statusIds.join(',');
    if (query.colorIds?.length) params.color_ids = query.colorIds.join(',');
    if (query.materialIds?.length) params.material_ids = query.materialIds.join(',');

    // Currency
    if (query.currency) params.currency = query.currency;

    return params;
  }

  /**
   * Normalize a catalog item to a standard format.
   * @param {Object} raw - Raw API item
   * @param {string} [country] - Country code the item was fetched from
   */
  normalizeItem(raw, country = null) {
    return {
      id: raw.id,
      title: raw.title || '',
      // Include description if present in catalog results (often a short excerpt)
      description: raw.description || '',
      price: parseFloat(raw.price?.amount || raw.price || 0),
      currency: raw.price?.currency_code || raw.currency || 'EUR',
      totalPrice: parseFloat(raw.total_item_price?.amount || raw.service_fee?.amount || 0) + parseFloat(raw.price?.amount || 0),
      brand: raw.brand_title || raw.brand?.title || '',
      size: raw.size_title || raw.size?.title || '',
      condition: raw.status || '',
      url: raw.url || raw.path || '',
      photos: (raw.photos || raw.photo?.thumbnails || []).map(p =>
        typeof p === 'string' ? p : (p.url || p.full_size_url || ''),
      ),
      photo: raw.photo?.url || raw.photo?.thumbnails?.[0]?.url || '',
      seller: {
        id: raw.user?.id,
        login: raw.user?.login || '',
        rating: raw.user?.feedback_reputation || 0,
        reviewCount: raw.user?.feedback_count || 0,
        profileUrl: raw.user?.profile_url || '',
      },
      // Multi-country: tag every item with its origin country and flag
      country: country || '',
      countryFlag: country ? (COUNTRY_FLAGS[country] || '') : '',
      isFavourite: raw.is_favourite || false,
      isReserved: raw.is_reserved || false,
      isClosed: raw.is_closed || false,
      isHidden: raw.is_hidden || false,
      createdAt: raw.created_at_ts ? new Date(raw.created_at_ts * 1000).toISOString() : '',
      scrapedAt: new Date().toISOString(),
    };
  }

  /**
   * Normalize detailed item data.
   */
  normalizeItemDetails(raw) {
    return {
      ...this.normalizeItem(raw),
      description: raw.description || '',
      categoryId: raw.catalog_id,
      categoryTitle: raw.catalog_title || '',
      brandId: raw.brand_id,
      sizeId: raw.size_id,
      colorId: raw.color1_id,
      materialId: raw.material_id,
      packageSize: raw.package_size_id,
      shipmentPrices: raw.shipment_prices || [],
      canBuy: raw.can_buy || false,
      canBundle: raw.can_bundle || false,
    };
  }

  /**
   * Enrich an item with its full description from the detail API.
   * Use this for top-scoring items where the catalog endpoint didn't return a description.
   * @param {string} country - Country code
   * @param {Object} item - Normalized item (must have .id)
   * @returns {Object} item with description field populated
   */
  async enrichWithDescription(country, item) {
    if (item.description) return item; // already has description
    try {
      const details = await this.getItemDetails(country, item.id);
      if (details?.description) {
        item.description = details.description;
      }
    } catch (err) {
      log.debug(`Failed to fetch description for item ${item.id}: ${err.message}`);
    }
    return item;
  }

  /**
   * Clean up old seen items (>1 hour old).
   */
  cleanupSeen() {
    const cutoff = Date.now() - 60 * 60_000;
    let removed = 0;
    for (const [id, ts] of this.seenItems) {
      if (ts < cutoff) {
        this.seenItems.delete(id);
        removed++;
      }
    }
    if (removed > 0) log.debug(`Cleaned up ${removed} old seen items`);
  }

  destroy() {
    clearInterval(this.cleanupTimer);
  }
}
