import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { createLogger } from './logger.js';

const log = createLogger('exporter');

/**
 * DataExporter - Export scraped items to CSV/JSON with statistics and filtering.
 *
 * Supports:
 * - Auto-export on a timer
 * - Manual export via dashboard API (POST /api/export)
 * - Filtered export: date range, brand, price range, deal score
 * - CSV and JSON formats
 */
export class DataExporter {
  constructor(config) {
    this.config = config.export;
    this.items = [];        // All items collected
    this.sessionStats = []; // Periodic snapshots
    this.exportTimer = null;
    this.lastExportCount = 0; // Track last export size for API response
  }

  /**
   * Add item to collection (capped at 10000 to prevent memory leaks).
   */
  addItem(item) {
    this.items.push({ ...item, exportedAt: new Date().toISOString() });
    if (this.items.length > 10000) {
      // Export and reset when cap is reached
      this.exportAll();
      this.items = this.items.slice(-1000); // keep last 1000
    }
  }

  /**
   * Add batch of items.
   */
  addItems(items) {
    items.forEach(i => this.addItem(i));
  }

  /**
   * Start auto-export if configured.
   */
  startAutoExport() {
    if (!this.config.autoExport) return;

    this.exportTimer = setInterval(() => {
      this.exportAll();
    }, this.config.intervalMs);

    log.info(`Auto-export started (every ${this.config.intervalMs / 1000}s)`);
  }

  /**
   * Export all collected items (no filters).
   */
  exportAll() {
    if (this.items.length === 0) {
      log.debug('Nothing to export');
      return null;
    }

    mkdirSync(this.config.dir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    let path;
    if (this.config.format === 'csv') {
      path = `${this.config.dir}/items-${timestamp}.csv`;
      writeFileSync(path, this.toCSV(this.items));
    } else {
      path = `${this.config.dir}/items-${timestamp}.json`;
      writeFileSync(path, JSON.stringify(this.items, null, 2));
    }

    this.lastExportCount = this.items.length;
    log.info(`Exported ${this.items.length} items to ${path}`);
    return path;
  }

  /**
   * Export items with filters applied. Called from the dashboard API.
   *
   * @param {Object} filters - Filter criteria
   * @param {string} [filters.dateFrom] - ISO date string, include items scraped after this
   * @param {string} [filters.dateTo] - ISO date string, include items scraped before this
   * @param {string} [filters.brand] - Brand name filter (case-insensitive substring match)
   * @param {number} [filters.priceMin] - Minimum price
   * @param {number} [filters.priceMax] - Maximum price
   * @param {number} [filters.minDealScore] - Minimum deal score (0-100)
   * @param {string} [filters.country] - Country code filter
   * @param {string} format - 'csv' or 'json'
   * @returns {string|null} Path to exported file, or null if nothing to export
   */
  exportFiltered(filters = {}, format = 'json') {
    let filtered = [...this.items];

    // Apply date range filter
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom).getTime();
      filtered = filtered.filter(item => {
        const t = new Date(item.scrapedAt || item.exportedAt).getTime();
        return t >= from;
      });
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo).getTime();
      filtered = filtered.filter(item => {
        const t = new Date(item.scrapedAt || item.exportedAt).getTime();
        return t <= to;
      });
    }

    // Apply brand filter (case-insensitive substring)
    if (filters.brand) {
      const brandLower = filters.brand.toLowerCase();
      filtered = filtered.filter(item =>
        (item.brand || '').toLowerCase().includes(brandLower)
      );
    }

    // Apply price range filter
    if (filters.priceMin !== undefined && filters.priceMin !== null) {
      filtered = filtered.filter(item => item.price >= filters.priceMin);
    }
    if (filters.priceMax !== undefined && filters.priceMax !== null) {
      filtered = filtered.filter(item => item.price <= filters.priceMax);
    }

    // Apply deal score filter
    if (filters.minDealScore !== undefined && filters.minDealScore !== null) {
      filtered = filtered.filter(item => (item.dealScore || 0) >= filters.minDealScore);
    }

    // Apply country filter
    if (filters.country) {
      filtered = filtered.filter(item => item.country === filters.country);
    }

    if (filtered.length === 0) {
      log.debug('Nothing to export after filtering');
      this.lastExportCount = 0;
      return null;
    }

    mkdirSync(this.config.dir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    let path;
    if (format === 'csv') {
      path = `${this.config.dir}/items-filtered-${timestamp}.csv`;
      writeFileSync(path, this.toCSV(filtered));
    } else {
      path = `${this.config.dir}/items-filtered-${timestamp}.json`;
      writeFileSync(path, JSON.stringify(filtered, null, 2));
    }

    this.lastExportCount = filtered.length;
    log.info(`Filtered export: ${filtered.length} items to ${path} (filters: ${JSON.stringify(filters)})`);
    return path;
  }

  /**
   * Export current statistics.
   */
  exportStats(stats) {
    mkdirSync(this.config.dir, { recursive: true });
    const path = `${this.config.dir}/stats-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    writeFileSync(path, JSON.stringify(stats, null, 2));
    return path;
  }

  /**
   * Convert items array to CSV string.
   * Includes deal scoring columns, country, and description.
   */
  toCSV(items) {
    if (items.length === 0) return '';

    const headers = [
      'id', 'title', 'description', 'price', 'currency', 'brand', 'size', 'condition',
      'seller_login', 'seller_rating', 'seller_reviews',
      'dealScore', 'dealLabel', 'confidence', 'marketMedian', 'priceVsMarket',
      'country', 'countryFlag',
      'url', 'photo', 'createdAt', 'scrapedAt',
    ];

    const rows = items.map(item => [
      item.id,
      csvEscape(item.title),
      csvEscape(item.description),
      item.price,
      item.currency || 'EUR',
      csvEscape(item.brand),
      csvEscape(item.size),
      csvEscape(item.condition),
      csvEscape(item.seller?.login),
      item.seller?.rating,
      item.seller?.reviewCount,
      item.dealScore || '',
      csvEscape(item.dealLabel),
      item.confidence || '',
      item.marketMedian || '',
      csvEscape(item.priceVsMarket),
      item.country || '',
      item.countryFlag || '',
      item.url,
      item.photo || item.photos?.[0] || '',
      item.createdAt,
      item.scrapedAt,
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Get collection stats.
   */
  getStats() {
    const prices = this.items.map(i => i.price).filter(Boolean);
    const brands = {};
    const countries = {};
    this.items.forEach(i => {
      if (i.brand) brands[i.brand] = (brands[i.brand] || 0) + 1;
      if (i.country) countries[i.country] = (countries[i.country] || 0) + 1;
    });

    return {
      totalItems: this.items.length,
      avgPrice: prices.length ? (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2) : 0,
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      topBrands: Object.entries(brands).sort((a, b) => b[1] - a[1]).slice(0, 10),
      countryCounts: countries,
      lastExport: this.config.dir,
      lastExportCount: this.lastExportCount,
    };
  }

  stop() {
    if (this.exportTimer) clearInterval(this.exportTimer);
  }
}

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// CLI mode
if (process.argv[1]?.endsWith('exporter.js')) {
  const { config } = await import('../config.js');
  const exporter = new DataExporter(config);

  // Load existing items if any
  const dir = config.export.dir;
  if (existsSync(dir)) {
    const { readdirSync } = await import('fs');
    const files = readdirSync(dir).filter(f => f.endsWith('.json') && f.startsWith('items-'));
    for (const file of files) {
      try {
        const data = JSON.parse(readFileSync(`${dir}/${file}`, 'utf-8'));
        if (Array.isArray(data)) exporter.items.push(...data);
      } catch { /* skip */ }
    }
  }

  const stats = exporter.getStats();
  console.log('\nCollection Statistics:');
  console.log(`  Total items: ${stats.totalItems}`);
  console.log(`  Avg price: ${stats.avgPrice}EUR`);
  console.log(`  Price range: ${stats.minPrice}EUR - ${stats.maxPrice}EUR`);
  console.log(`  Top brands:`);
  stats.topBrands.forEach(([brand, count]) => {
    console.log(`    ${brand}: ${count}`);
  });
}
