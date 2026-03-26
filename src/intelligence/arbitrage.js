import { createLogger } from '../utils/logger.js';

const log = createLogger('arbitrage');

/**
 * ArbitrageDetector - Cross-country price comparison.
 *
 * Detects when the same item (by title/brand/size similarity)
 * is listed at very different prices across countries.
 *
 * Example: Nike Air Max 90 at 25€ in DE but selling for 60€ in FR
 * → opportunity to buy in DE and resell in FR.
 */
export class ArbitrageDetector {
  constructor() {
    // Fingerprint → {country: {price, item}}
    this.catalog = new Map();
    this.opportunities = [];
    this.stats = { compared: 0, opportunities: 0 };
  }

  /**
   * Process an item and check for arbitrage opportunities.
   * Returns opportunity object if found, null otherwise.
   */
  checkItem(item, country) {
    this.stats.compared++;
    const fp = this.fingerprint(item);
    if (!fp) return null;

    if (!this.catalog.has(fp)) {
      this.catalog.set(fp, {});
    }

    const entries = this.catalog.get(fp);

    // Store/update this country's price
    const existing = entries[country];
    if (!existing || item.price < existing.price) {
      entries[country] = {
        price: item.price,
        id: item.id,
        title: item.title,
        url: item.url,
        seller: item.seller?.login,
        timestamp: Date.now(),
      };
    }

    // Compare with other countries
    const countries = Object.keys(entries).filter(c => c !== country);
    let bestOpportunity = null;

    for (const otherCountry of countries) {
      const other = entries[otherCountry];
      if (!other) continue;

      // Skip stale entries (>1h old)
      if (Date.now() - other.timestamp > 3600_000) continue;

      const priceDiff = Math.abs(item.price - other.price);
      const pctDiff = Math.round((priceDiff / Math.max(item.price, other.price)) * 100);

      // Only flag if >25% difference and >5€ absolute difference
      if (pctDiff >= 25 && priceDiff >= 5) {
        const cheapCountry = item.price < other.price ? country : otherCountry;
        const cheapPrice = Math.min(item.price, other.price);
        const expensiveCountry = item.price >= other.price ? country : otherCountry;
        const expensivePrice = Math.max(item.price, other.price);

        const opp = {
          fingerprint: fp,
          title: item.title,
          brand: item.brand,
          buy: {
            country: cheapCountry,
            price: cheapPrice,
            url: cheapCountry === country ? item.url : other.url,
            seller: cheapCountry === country ? item.seller?.login : other.seller,
          },
          sell: {
            country: expensiveCountry,
            price: expensivePrice,
          },
          profit: Math.round((expensivePrice - cheapPrice) * 100) / 100,
          profitPct: pctDiff,
          timestamp: new Date().toISOString(),
        };

        bestOpportunity = opp;
        this.stats.opportunities++;
        this.opportunities.unshift(opp);
        if (this.opportunities.length > 50) this.opportunities.pop();

        log.info(`ARBITRAGE: "${item.title}" ${cheapPrice}€ (${cheapCountry}) vs ${expensivePrice}€ (${expensiveCountry}) = +${pctDiff}%`);
      }
    }

    // Cleanup old entries (>2h)
    if (Math.random() < 0.01) this.cleanup();

    return bestOpportunity;
  }

  /**
   * Create a fuzzy fingerprint for cross-listing matching.
   * Normalizes title to match same item across countries.
   */
  fingerprint(item) {
    if (!item.brand || !item.title) return null;

    const brand = item.brand.toLowerCase().trim();
    const title = item.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract key words (brand + model-like words + size)
    const words = title.split(' ').filter(w => w.length > 2);
    const key = words.slice(0, 5).join('-');
    const size = (item.size || '').toLowerCase().replace(/\s/g, '');

    return `${brand}|${key}|${size}`;
  }

  cleanup() {
    const cutoff = Date.now() - 2 * 3600_000;
    for (const [fp, entries] of this.catalog) {
      for (const country of Object.keys(entries)) {
        if (entries[country].timestamp < cutoff) delete entries[country];
      }
      if (Object.keys(entries).length === 0) this.catalog.delete(fp);
    }
  }

  getOpportunities(limit = 20) {
    return this.opportunities.slice(0, limit);
  }

  getStats() {
    return {
      ...this.stats,
      catalogSize: this.catalog.size,
      recentOpportunities: this.opportunities.slice(0, 10),
    };
  }
}
