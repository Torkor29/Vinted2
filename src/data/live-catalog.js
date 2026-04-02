/**
 * Live Vinted Catalog — fetches real catalog data from Vinted API.
 *
 * On init, queries Vinted's catalog endpoints to get the real IDs
 * for categories, sizes, colors, conditions, etc.
 * Falls back to hardcoded data from vinted-catalog.js if API fails.
 *
 * Usage:
 *   const catalog = new LiveCatalog();
 *   await catalog.init(vintedClient, 'fr');
 *   catalog.getCategories(1904) → real women's categories
 *   catalog.searchBrands('zara') → real brand search
 */

import { createLogger } from '../utils/logger.js';
import {
  GENDERS as FALLBACK_GENDERS,
  CATEGORIES as FALLBACK_CATEGORIES,
  BRANDS as FALLBACK_BRANDS,
  SIZES as FALLBACK_SIZES,
  COLORS as FALLBACK_COLORS,
  CONDITIONS as FALLBACK_CONDITIONS,
} from './vinted-catalog.js';

const log = createLogger('catalog');

export class LiveCatalog {
  constructor() {
    this.client = null;
    this.country = 'fr';
    this.ready = false;

    // Live data (populated by init)
    this.genders = [...FALLBACK_GENDERS];
    this.categories = { ...FALLBACK_CATEGORIES };
    this.sizes = { ...FALLBACK_SIZES };
    this.colors = [...FALLBACK_COLORS];
    this.conditions = [...FALLBACK_CONDITIONS];

    // Brand cache from API searches
    this.brandCache = new Map();
  }

  /**
   * Initialize with a Vinted client. Fetches live catalog data.
   */
  async init(client, country = 'fr') {
    this.client = client;
    this.country = country;

    log.info('Fetching live catalog from Vinted API...');

    const results = await Promise.allSettled([
      this._fetchCatalogTree(),
      this._fetchSizes(),
      this._fetchColors(),
      this._fetchConditions(),
    ]);

    const names = ['categories', 'sizes', 'colors', 'conditions'];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) {
        log.info(`✅ ${names[i]}: loaded from API`);
      } else {
        log.warn(`⚠️ ${names[i]}: using fallback (${r.reason?.message || 'no data'})`);
      }
    });

    this.ready = true;
    log.info('Live catalog ready');
  }

  // ══════════════════════════════════════════
  //  CATALOG TREE (genders → categories)
  // ══════════════════════════════════════════

  async _fetchCatalogTree() {
    if (!this.client) return false;

    try {
      const result = await this.client.request(this.country, '/catalog/tree');
      const data = result?.data || result;
      const catalogs = data?.catalogs || data;

      if (!Array.isArray(catalogs) || catalogs.length === 0) return false;

      // Parse the catalog tree into our format
      const genders = [];
      const categories = {};

      for (const root of catalogs) {
        const genderId = root.id;
        const gender = {
          id: genderId,
          label: root.title || root.name || '',
          icon: this._genderIcon(genderId),
          slug: (root.code || root.url || '').replace(/.*\//, ''),
        };
        genders.push(gender);

        // Parse children as categories
        const cats = [{ id: genderId, label: `Tout ${gender.label}`, icon: gender.icon }];
        if (root.catalogs || root.children) {
          for (const cat of (root.catalogs || root.children)) {
            const catEntry = {
              id: cat.id,
              label: cat.title || cat.name || '',
              icon: this._categoryIcon(cat.title || cat.name || ''),
            };
            if (cat.catalogs || cat.children) {
              catEntry.children = (cat.catalogs || cat.children).map(sub => ({
                id: sub.id,
                label: sub.title || sub.name || '',
              }));
            }
            cats.push(catEntry);
          }
        }
        categories[genderId] = cats;
      }

      if (genders.length > 0) {
        this.genders = genders;
        this.categories = categories;
        return true;
      }
    } catch (e) {
      log.warn('Failed to fetch catalog tree:', e.message);
    }
    return false;
  }

  // ══════════════════════════════════════════
  //  SIZES
  // ══════════════════════════════════════════

  async _fetchSizes() {
    if (!this.client) return false;

    try {
      // Try fetching size groups
      const result = await this.client.request(this.country, '/catalog/sizes');
      const data = result?.data || result;
      const groups = data?.size_groups || data?.sizes || data;

      if (Array.isArray(groups) && groups.length > 0) {
        const sizes = { clothing: [], shoes_women: [], shoes_men: [], jeans: [] };
        for (const group of groups) {
          const title = (group.title || group.name || '').toLowerCase();
          const items = (group.sizes || group.items || []).map(s => ({
            id: s.id,
            label: s.title || s.name || s.label || '',
          }));
          if (title.includes('chaussure') && title.includes('femme') || title.includes('shoe') && title.includes('women')) {
            sizes.shoes_women = items;
          } else if (title.includes('chaussure') || title.includes('shoe')) {
            sizes.shoes_men = items;
          } else if (title.includes('jean')) {
            sizes.jeans = items;
          } else if (items.length > 0) {
            sizes.clothing = items;
          }
        }
        if (sizes.clothing.length > 0) {
          this.sizes = sizes;
          return true;
        }
      }
    } catch (e) {
      log.warn('Failed to fetch sizes:', e.message);
    }
    return false;
  }

  // ══════════════════════════════════════════
  //  COLORS
  // ══════════════════════════════════════════

  async _fetchColors() {
    if (!this.client) return false;

    try {
      const result = await this.client.request(this.country, '/catalog/colors');
      const data = result?.data || result;
      const colors = data?.colors || data;

      if (Array.isArray(colors) && colors.length > 0) {
        this.colors = colors.map(c => ({
          id: c.id,
          label: c.title || c.name || '',
          hex: c.hex || c.code || '#888888',
        }));
        return true;
      }
    } catch (e) {
      log.warn('Failed to fetch colors:', e.message);
    }
    return false;
  }

  // ══════════════════════════════════════════
  //  CONDITIONS
  // ══════════════════════════════════════════

  async _fetchConditions() {
    if (!this.client) return false;

    try {
      const result = await this.client.request(this.country, '/catalog/conditions');
      const data = result?.data || result;
      const conditions = data?.conditions || data?.statuses || data;

      if (Array.isArray(conditions) && conditions.length > 0) {
        this.conditions = conditions.map(c => ({
          id: c.id,
          label: c.title || c.name || c.label || '',
          short: this._conditionShort(c.title || c.name || ''),
          icon: this._conditionIcon(c.id),
          value: c.code || c.value || '',
        }));
        return true;
      }
    } catch (e) {
      log.warn('Failed to fetch conditions:', e.message);
    }
    return false;
  }

  // ══════════════════════════════════════════
  //  BRAND SEARCH (always live via API)
  // ══════════════════════════════════════════

  async searchBrands(query) {
    if (!query || query.length < 2) return [];

    // Check cache first
    const cacheKey = query.toLowerCase().trim();
    if (this.brandCache.has(cacheKey)) {
      return this.brandCache.get(cacheKey);
    }

    // Build search variations
    const variations = [query];
    const cleaned = query.replace(/[&+\-_.]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned !== query) variations.push(cleaned);
    const compacted = query.replace(/[&\s\-_.+]+/g, '');
    if (compacted !== query && compacted !== cleaned) variations.push(compacted);

    if (this.client) {
      for (const q of variations) {
        try {
          const result = await this.client.request(this.country, '/catalog/brands', {
            params: { query: q, per_page: 15 },
          });
          const data = result?.data || result;
          const brands = data?.brands || data;
          if (Array.isArray(brands) && brands.length > 0) {
            const mapped = brands.map(b => ({ id: b.id, label: b.title || b.name }));
            this.brandCache.set(cacheKey, mapped);
            return mapped;
          }
        } catch (e) {
          log.debug('Brand search API failed for "%s": %s', q, e.message);
        }
      }
    }

    // Fallback to local catalog
    const q = query.toLowerCase();
    const local = FALLBACK_BRANDS.filter(b => b.label.toLowerCase().includes(q));
    return local;
  }

  /**
   * Get popular brands — fetch top brands from API or return cached.
   */
  async getPopularBrands() {
    if (this._popularBrands) return this._popularBrands;

    if (this.client) {
      try {
        // Fetch most popular brands
        const result = await this.client.request(this.country, '/catalog/brands', {
          params: { per_page: 20 },
        });
        const data = result?.data || result;
        const brands = data?.brands || data;
        if (Array.isArray(brands) && brands.length > 0) {
          this._popularBrands = brands.map(b => ({ id: b.id, label: b.title || b.name }));
          log.info(`Loaded ${this._popularBrands.length} popular brands from API`);
          return this._popularBrands;
        }
      } catch (e) {
        log.warn('Failed to fetch popular brands:', e.message);
      }
    }

    // Fallback
    this._popularBrands = FALLBACK_BRANDS.slice(0, 12);
    return this._popularBrands;
  }

  // ══════════════════════════════════════════
  //  GETTERS
  // ══════════════════════════════════════════

  getGenders() { return this.genders; }
  getCategories(genderId) { return this.categories[genderId] || []; }
  getSizes() { return this.sizes; }
  getColors() { return this.colors; }
  getConditions() { return this.conditions; }

  getSizeGroup(categoryId) {
    const shoesCatIds = [16, 1864, 17, 1042, 1043, 1044, 1045, 1865, 2063, 2064, 2065, 2066, 2067, 2068, 1202];
    const jeansIds = [9, 2055];
    if (shoesCatIds.includes(categoryId)) return 'shoes';
    if (jeansIds.includes(categoryId)) return 'jeans';
    return 'clothing';
  }

  // ══════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════

  _genderIcon(id) {
    if (id === 1904) return '👩';
    if (id === 5) return '👨';
    if (id === 1193) return '👶';
    return '👤';
  }

  _categoryIcon(name) {
    const n = name.toLowerCase();
    if (n.includes('vêtement')) return '👚';
    if (n.includes('chaussure')) return '👠';
    if (n.includes('sac')) return '👜';
    if (n.includes('accessoire')) return '💍';
    if (n.includes('beauté')) return '💄';
    if (n.includes('sport')) return '🏃';
    return '📦';
  }

  _conditionShort(label) {
    const l = label.toLowerCase();
    if (l.includes('étiquette') || l.includes('tag')) return 'Neuf+tag';
    if (l.includes('neuf')) return 'Neuf';
    if (l.includes('très')) return 'Très bon';
    if (l.includes('bon')) return 'Bon';
    if (l.includes('satisf')) return 'Satisf.';
    return label.slice(0, 10);
  }

  _conditionIcon(id) {
    const icons = { 6: '🏷️', 1: '✨', 2: '👍', 3: '👌', 4: '🔧' };
    return icons[id] || '📋';
  }
}

// Singleton instance
export const liveCatalog = new LiveCatalog();
