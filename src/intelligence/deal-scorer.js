import { createLogger } from '../utils/logger.js';

const log = createLogger('deal-scorer');

/**
 * DealScorer - Smart deal detection using market price analysis.
 *
 * HOW IT WORKS:
 * 1. Tracks prices of all scraped items by brand+category+condition (and brand+size)
 * 2. Builds rolling market averages (median, p25, p75)
 * 3. Scores each new item: price vs market median = deal score
 * 4. Factors in seller rating, item age, and condition
 * 5. Provides a "confidence" score based on available data points
 * 6. Maintains price history per item for drop detection
 * 7. Supports configurable thresholds via dashboard API
 *
 * DEAL SCORE (0-100):
 *   100 = item at 20% of market median (incredible deal)
 *    80 = item at 40% of market median (great deal)
 *    60 = item at 60% of market median (good deal)
 *    50 = item at market median (fair price)
 *    20 = item at 150% of market median (overpriced)
 *
 * CONFIDENCE (0-100):
 *   Based on how many data points exist for the brand+size segment.
 *   <5 samples = low confidence, 5-20 = medium, 20+ = high.
 *
 * TREND DETECTION:
 *   - Price drops across same seller's relists
 *   - Market trend for a brand/category (rising/falling)
 */

// Default scoring thresholds — can be overridden via setThresholds()
const DEFAULT_THRESHOLDS = {
  // Price ratio breakpoints (item price / market median)
  // Each entry: [maxRatio, score]
  ratioBreakpoints: [
    [0.20, 100],
    [0.40, 90],
    [0.60, 80],
    [0.75, 70],
    [0.90, 60],
    [1.10, 50],
    [1.30, 35],
    [1.50, 20],
  ],
  defaultScore: 10, // score if ratio exceeds all breakpoints

  // Bonus/penalty weights (added to base score, clamped 0-100)
  sellerRatingWeight: 5,       // max +5 for 5-star seller
  sellerRatingThreshold: 4.0,  // only award bonus above this rating
  itemAgePenaltyPerHour: 0.5,  // -0.5 per hour old (max -10)
  itemAgeMaxPenalty: 10,
  conditionBonus: {            // bonus by condition keyword
    'new_with_tags': 5,
    'new_without_tags': 3,
    'very_good': 1,
    'good': 0,
    'satisfactory': -3,
  },

  // Minimum samples before scoring (below this → "Nouveau" label)
  minSamplesForScore: 3,

  // Label thresholds: [minScore, label, color]
  labels: [
    [90, 'PEPITE', '#f59e0b'],
    [75, 'Super deal', '#22c55e'],
    [60, 'Bon prix', '#3b82f6'],
    [45, 'Prix correct', '#94a3b8'],
    [30, 'Au-dessus', '#f97316'],
    [0, 'Cher', '#ef4444'],
  ],
};

export class DealScorer {
  constructor() {
    // Market data: key -> price array (last 500 prices per segment)
    // Key format: "brand:category:condition" or "brand:size:*" etc.
    this.marketData = new Map();
    this.maxSamplesPerSegment = 500;

    // Brand+size specific price history for richer market intel
    // Key: "brand:size" -> [{price, timestamp}]
    this.brandSizeHistory = new Map();
    this.maxBrandSizeHistory = 200;

    // Per-item price history: itemId -> [{price, timestamp}]
    this.priceHistory = new Map();
    this.maxHistoryPerItem = 50;

    // Per-seller average price tracking
    this.sellerStats = new Map();

    // Configurable thresholds (can be updated at runtime via API)
    this.thresholds = structuredClone(DEFAULT_THRESHOLDS);

    // Global stats
    this.stats = {
      itemsScored: 0,
      dealsFound: 0,
      avgDealScore: 0,
      topDeals: [], // last 20 best deals
      marketSegments: 0,
    };

    // Cap on map sizes to prevent unbounded memory growth
    this.maxMarketSegments = 5000;
    this.maxTrackedItems = 10000;
    this.maxTrackedSellers = 5000;

    // Periodic cleanup every 15 minutes
    this.cleanupTimer = setInterval(() => this.cleanupMaps(), 15 * 60_000);
  }

  /**
   * Prune maps that have grown too large to prevent memory leaks.
   */
  cleanupMaps() {
    // Prune priceHistory: remove items not updated in the last 2 hours
    if (this.priceHistory.size > this.maxTrackedItems) {
      const cutoff = Date.now() - 2 * 3600_000;
      for (const [id, history] of this.priceHistory) {
        const last = history[history.length - 1];
        if (last && last.timestamp < cutoff) {
          this.priceHistory.delete(id);
        }
      }
    }

    // Prune sellerStats: keep only the most active sellers
    if (this.sellerStats.size > this.maxTrackedSellers) {
      const entries = [...this.sellerStats.entries()];
      entries.sort((a, b) => b[1].totalItems - a[1].totalItems);
      this.sellerStats = new Map(entries.slice(0, Math.floor(this.maxTrackedSellers * 0.8)));
    }

    // Prune marketData: remove smallest segments
    if (this.marketData.size > this.maxMarketSegments) {
      const entries = [...this.marketData.entries()];
      entries.sort((a, b) => b[1].length - a[1].length);
      this.marketData = new Map(entries.slice(0, Math.floor(this.maxMarketSegments * 0.8)));
    }

    log.debug(`Cleanup: ${this.priceHistory.size} items, ${this.sellerStats.size} sellers, ${this.marketData.size} segments`);
  }

  // ─── Configurable Thresholds ──────────────────────────────

  /**
   * Update scoring thresholds at runtime.
   * Accepts a partial object — only provided keys are overwritten.
   */
  setThresholds(partial) {
    if (!partial || typeof partial !== 'object') return;

    // Merge top-level scalars
    for (const key of Object.keys(partial)) {
      if (key === 'ratioBreakpoints' && Array.isArray(partial.ratioBreakpoints)) {
        this.thresholds.ratioBreakpoints = partial.ratioBreakpoints;
      } else if (key === 'conditionBonus' && typeof partial.conditionBonus === 'object') {
        Object.assign(this.thresholds.conditionBonus, partial.conditionBonus);
      } else if (key === 'labels' && Array.isArray(partial.labels)) {
        this.thresholds.labels = partial.labels;
      } else if (key in this.thresholds) {
        this.thresholds[key] = partial[key];
      }
    }

    log.info(`Thresholds updated: ${JSON.stringify(partial)}`);
  }

  /**
   * Get current thresholds (for dashboard display / persistence).
   */
  getThresholds() {
    return structuredClone(this.thresholds);
  }

  /**
   * Reset thresholds to defaults.
   */
  resetThresholds() {
    this.thresholds = structuredClone(DEFAULT_THRESHOLDS);
    log.info('Thresholds reset to defaults');
  }

  // ─── Core Scoring ─────────────────────────────────────────

  /**
   * Score an item and enrich it with deal intelligence.
   * Returns the item with added fields: dealScore, marketMedian, dealLabel,
   * priceVsMarket, confidence, etc.
   */
  scoreItem(item) {
    this.stats.itemsScored++;

    // Record price in market data
    this.recordMarketPrice(item);

    // Record in brand+size history
    this.recordBrandSizePrice(item);

    // Record in item history
    this.recordPriceHistory(item);

    // Record seller stats
    this.recordSellerStats(item);

    // Calculate deal score
    const score = this.calculateDealScore(item);

    // Enrich item
    item.dealScore = score.score;
    item.dealLabel = score.label;
    item.dealColor = score.color;
    item.marketMedian = score.median;
    item.marketP25 = score.p25;
    item.priceVsMarket = score.priceVsMarket; // e.g. "-35%" or "+12%"
    item.marketSamples = score.samples;
    item.confidence = score.confidence;
    item.confidenceLabel = score.confidenceLabel;
    item.sellerAvgPrice = this.getSellerAvgPrice(item.seller?.id);

    // Track top deals
    if (score.score >= 70) {
      this.stats.dealsFound++;
      this.stats.topDeals.unshift({
        id: item.id,
        title: item.title,
        price: item.price,
        brand_title: item.brand || '',
        size_title: item.size || '',
        photo: item.photo || '',
        url: item.url || '',
        currency: item.currency || 'EUR',
        score: score.score,
        confidence: score.confidence,
        label: score.label,
        market_price: score.median,
        discount_percent: score.median > 0 ? Math.round((1 - item.price / score.median) * 100) : 0,
        country: item.country || '',
        created_at_ts: item.scrapedAt ? Math.floor(new Date(item.scrapedAt).getTime() / 1000) : undefined,
        timestamp: new Date().toISOString(),
      });
      if (this.stats.topDeals.length > 50) this.stats.topDeals.pop();
    }

    // Running average
    this.stats.avgDealScore = Math.round(
      (this.stats.avgDealScore * (this.stats.itemsScored - 1) + score.score) / this.stats.itemsScored
    );
    this.stats.marketSegments = this.marketData.size;

    return item;
  }

  /**
   * Calculate deal score based on market comparison + seller/age/condition factors.
   */
  calculateDealScore(item) {
    const segments = this.getSegmentKeys(item);
    let bestMatch = { prices: [], key: '' };

    // Find best matching segment with enough data
    for (const key of segments) {
      const prices = this.marketData.get(key);
      if (prices && prices.length > bestMatch.prices.length) {
        bestMatch = { prices, key };
      }
    }

    // Also check brand+size history for confidence
    const brandSizeKey = this.getBrandSizeKey(item);
    const brandSizePrices = this.brandSizeHistory.get(brandSizeKey);
    const brandSizeSamples = brandSizePrices ? brandSizePrices.length : 0;

    // Total samples = max of segment samples and brand+size samples
    const totalSamples = Math.max(bestMatch.prices.length, brandSizeSamples);

    // Calculate confidence (0-100) based on data points
    const confidence = this.calculateConfidence(totalSamples);

    if (bestMatch.prices.length < this.thresholds.minSamplesForScore) {
      return {
        score: 50,
        label: 'Nouveau',
        color: '#94a3b8',
        median: null,
        p25: null,
        priceVsMarket: null,
        samples: totalSamples,
        confidence,
        confidenceLabel: confidence < 30 ? 'Faible' : confidence < 60 ? 'Moyen' : 'Fort',
      };
    }

    const sorted = [...bestMatch.prices].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p25 = sorted[Math.floor(sorted.length * 0.25)];
    const p75 = sorted[Math.floor(sorted.length * 0.75)];

    const ratio = item.price / median; // <1 = cheaper than median
    const pctDiff = Math.round((1 - ratio) * 100); // positive = cheaper

    // Base score from ratio breakpoints
    let baseScore = this.thresholds.defaultScore;
    for (const [maxRatio, score] of this.thresholds.ratioBreakpoints) {
      if (ratio <= maxRatio) {
        baseScore = score;
        break;
      }
    }

    // ── Bonus / penalty adjustments ──

    let adjustment = 0;

    // Seller rating bonus
    const sellerRating = item.seller?.rating || 0;
    if (sellerRating >= this.thresholds.sellerRatingThreshold) {
      // Scale: 4.0->0, 5.0->max weight
      const ratingBonus = ((sellerRating - this.thresholds.sellerRatingThreshold) /
        (5 - this.thresholds.sellerRatingThreshold)) * this.thresholds.sellerRatingWeight;
      adjustment += ratingBonus;
    }

    // Item age penalty (older items = slightly less attractive)
    if (item.createdAt) {
      const ageMs = Date.now() - new Date(item.createdAt).getTime();
      const ageHours = ageMs / (1000 * 60 * 60);
      const agePenalty = Math.min(
        ageHours * this.thresholds.itemAgePenaltyPerHour,
        this.thresholds.itemAgeMaxPenalty,
      );
      adjustment -= agePenalty;
    }

    // Condition bonus
    const condStr = (item.condition || '').toLowerCase().replace(/\s+/g, '_');
    const condBonus = this.thresholds.conditionBonus[condStr];
    if (condBonus !== undefined) {
      adjustment += condBonus;
    }

    // Final score clamped to 0-100
    const score = Math.max(0, Math.min(100, Math.round(baseScore + adjustment)));

    // Label and color from thresholds
    let label = 'Cher';
    let color = '#ef4444';
    for (const [minScore, lbl, clr] of this.thresholds.labels) {
      if (score >= minScore) {
        label = lbl;
        color = clr;
        break;
      }
    }

    return {
      score,
      label,
      color,
      median: Math.round(median * 100) / 100,
      p25: Math.round(p25 * 100) / 100,
      priceVsMarket: pctDiff > 0 ? `-${pctDiff}%` : `+${Math.abs(pctDiff)}%`,
      samples: totalSamples,
      confidence,
      confidenceLabel: confidence < 30 ? 'Faible' : confidence < 60 ? 'Moyen' : 'Fort',
    };
  }

  /**
   * Compute confidence score (0-100) from sample count.
   * Uses a logarithmic curve: ramps up quickly from 0-20 samples, then plateaus.
   */
  calculateConfidence(sampleCount) {
    if (sampleCount <= 0) return 0;
    if (sampleCount >= 50) return 100;
    // Logarithmic: confidence = min(100, 25 * ln(samples + 1))
    return Math.min(100, Math.round(25 * Math.log(sampleCount + 1)));
  }

  // ─── Market Data Recording ────────────────────────────────

  /**
   * Record a price observation in market segments.
   */
  recordMarketPrice(item) {
    const keys = this.getSegmentKeys(item);
    for (const key of keys) {
      if (!this.marketData.has(key)) this.marketData.set(key, []);
      const arr = this.marketData.get(key);
      arr.push(item.price);
      if (arr.length > this.maxSamplesPerSegment) arr.shift();
    }
  }

  /**
   * Record price in brand+size specific history (for confidence tracking).
   */
  recordBrandSizePrice(item) {
    const key = this.getBrandSizeKey(item);
    if (!key) return;

    if (!this.brandSizeHistory.has(key)) this.brandSizeHistory.set(key, []);
    const arr = this.brandSizeHistory.get(key);
    arr.push({ price: item.price, timestamp: Date.now() });
    if (arr.length > this.maxBrandSizeHistory) arr.shift();
  }

  /**
   * Get segment keys for an item (from specific to general).
   */
  getSegmentKeys(item) {
    const brand = (item.brand || 'unknown').toLowerCase().replace(/\s+/g, '-');
    const cat = item.categoryId || item.catalogId || '*';
    const cond = (item.condition || '*').toLowerCase().replace(/\s+/g, '-');
    const size = (item.size || '*').toLowerCase().replace(/\s+/g, '-');

    return [
      `${brand}:${cat}:${cond}`,   // Most specific: Nike + Shoes + New
      `${brand}:${cat}:*`,          // Brand + Category
      `${brand}:*:${cond}`,         // Brand + Condition
      `${brand}:sz:${size}`,        // Brand + Size
      `${brand}:*:*`,               // Brand only (fallback)
    ];
  }

  /**
   * Get brand+size key for confidence tracking.
   */
  getBrandSizeKey(item) {
    const brand = (item.brand || '').toLowerCase().replace(/\s+/g, '-');
    const size = (item.size || '').toLowerCase().replace(/\s+/g, '-');
    if (!brand) return null;
    return `${brand}:${size || '*'}`;
  }

  /**
   * Track per-item price changes.
   */
  recordPriceHistory(item) {
    if (!this.priceHistory.has(item.id)) {
      this.priceHistory.set(item.id, []);
    }
    const history = this.priceHistory.get(item.id);
    const last = history[history.length - 1];

    // Only record if price changed or first observation
    if (!last || last.price !== item.price) {
      history.push({ price: item.price, timestamp: Date.now() });
      if (history.length > this.maxHistoryPerItem) history.shift();

      // Detect price drop
      if (last && item.price < last.price) {
        const dropPct = Math.round(((last.price - item.price) / last.price) * 100);
        item.priceDrop = dropPct;
        item.previousPrice = last.price;
        log.debug(`Price drop: ${item.title} ${last.price}EUR -> ${item.price}EUR (-${dropPct}%)`);
      }
    }
  }

  /**
   * Track seller pricing behavior.
   */
  recordSellerStats(item) {
    const sellerId = item.seller?.id;
    if (!sellerId) return;

    if (!this.sellerStats.has(sellerId)) {
      this.sellerStats.set(sellerId, { prices: [], totalItems: 0, login: item.seller.login });
    }
    const stats = this.sellerStats.get(sellerId);
    stats.prices.push(item.price);
    stats.totalItems++;
    if (stats.prices.length > 100) stats.prices.shift();
  }

  getSellerAvgPrice(sellerId) {
    if (!sellerId) return null;
    const stats = this.sellerStats.get(sellerId);
    if (!stats || stats.prices.length === 0) return null;
    return Math.round(stats.prices.reduce((a, b) => a + b, 0) / stats.prices.length * 100) / 100;
  }

  getPriceHistory(itemId) {
    return this.priceHistory.get(itemId) || [];
  }

  // ─── Brand+Size Market Data ───────────────────────────────

  /**
   * Get price history for a brand+size combo (for dashboard charts).
   */
  getBrandSizeData(brand, size) {
    const key = `${(brand || '').toLowerCase().replace(/\s+/g, '-')}:${(size || '*').toLowerCase().replace(/\s+/g, '-')}`;
    const history = this.brandSizeHistory.get(key);
    if (!history || history.length === 0) return null;

    const prices = history.map(h => h.price);
    const sorted = [...prices].sort((a, b) => a - b);

    return {
      brand,
      size: size || 'all',
      samples: prices.length,
      confidence: this.calculateConfidence(prices.length),
      min: sorted[0],
      p25: sorted[Math.floor(sorted.length * 0.25)],
      median: sorted[Math.floor(sorted.length / 2)],
      p75: sorted[Math.floor(sorted.length * 0.75)],
      max: sorted[sorted.length - 1],
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length * 100) / 100,
      history: history.slice(-50), // last 50 data points for charting
    };
  }

  /**
   * Get market overview for a brand.
   */
  getBrandMarketData(brand) {
    const key = `${brand.toLowerCase().replace(/\s+/g, '-')}:*:*`;
    const prices = this.marketData.get(key);
    if (!prices || prices.length < 3) return null;

    const sorted = [...prices].sort((a, b) => a - b);
    return {
      brand,
      samples: prices.length,
      confidence: this.calculateConfidence(prices.length),
      min: sorted[0],
      p25: sorted[Math.floor(sorted.length * 0.25)],
      median: sorted[Math.floor(sorted.length / 2)],
      p75: sorted[Math.floor(sorted.length * 0.75)],
      max: sorted[sorted.length - 1],
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length * 100) / 100,
    };
  }

  // ─── Stats & Getters ──────────────────────────────────────

  getStats() {
    return {
      ...this.stats,
      marketSegments: this.marketData.size,
      brandSizeSegments: this.brandSizeHistory.size,
      trackedItems: this.priceHistory.size,
      trackedSellers: this.sellerStats.size,
    };
  }

  /**
   * Get top deals found so far.
   */
  getTopDeals(limit = 20) {
    return this.stats.topDeals.slice(0, limit);
  }
}
