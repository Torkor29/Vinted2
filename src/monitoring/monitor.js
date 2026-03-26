import { createLogger } from '../utils/logger.js';
import { sleep } from '../utils/retry.js';

const log = createLogger('monitor');

/**
 * VintedMonitor - Watches sellers, tracks price drops, manages watchlists.
 *
 * Features:
 * - Seller watch: poll a seller's listings for new items
 * - Watchlist: track specific items for price drops / sold status
 * - Price history: store price over time for watched items
 * - Favorites sync: track favorite items for changes
 */
export class VintedMonitor {
  constructor(config, client, notifier) {
    this.config = config.monitoring;
    this.fullConfig = config;
    this.client = client;
    this.notifier = notifier;

    // Price history: itemId → [{ price, timestamp }]
    this.priceHistory = new Map();
    // Watched item cache: itemId → last known state
    this.watchedItems = new Map();
    // Seller last seen items: sellerId → Set<itemId>
    this.sellerKnownItems = new Map();

    this.running = false;
    this.stats = {
      priceDropsDetected: 0,
      sellerNewListings: 0,
      itemsSold: 0,
      checksPerformed: 0,
    };
  }

  /**
   * Start monitoring loop.
   */
  async start() {
    this.running = true;
    log.info(`Monitor started (${this.config.sellers.length} sellers, ${this.config.watchlist.length} watchlist items)`);

    while (this.running) {
      try {
        await Promise.all([
          this.checkSellers(),
          this.checkWatchlist(),
        ]);
      } catch (error) {
        log.error(`Monitor cycle error: ${error.message}`);
      }

      if (this.running) {
        await sleep(this.config.monitorIntervalMs);
      }
    }
  }

  stop() {
    this.running = false;
  }

  // ── Seller Monitoring ──

  async checkSellers() {
    for (const seller of this.config.sellers) {
      if (!this.running) break;
      try {
        await this.checkSeller(seller);
        this.stats.checksPerformed++;
      } catch (error) {
        log.error(`Failed to check seller ${seller.id || seller.username}: ${error.message}`);
      }
      // Small delay between seller checks to be gentle
      await sleep(1500);
    }
  }

  async checkSeller(seller) {
    const country = seller.country || this.fullConfig.countries[0];
    const sellerId = seller.id || seller.username;

    // Fetch seller's items
    const result = await this.client.request(country, `/users/${sellerId}/items`, {
      params: { per_page: 20, order: 'newest_first' },
    });

    if (result.status !== 200 || !result.data) return;

    const items = result.data?.items || result.data?.user_items || [];
    const currentIds = new Set(items.map(i => i.id));

    if (!this.sellerKnownItems.has(sellerId)) {
      // First check: just store, don't alert
      this.sellerKnownItems.set(sellerId, currentIds);
      log.debug(`Seller ${sellerId}: initialized with ${currentIds.size} items`);
      return;
    }

    const known = this.sellerKnownItems.get(sellerId);
    const newItems = items.filter(i => !known.has(i.id));

    if (newItems.length > 0) {
      this.stats.sellerNewListings += newItems.length;
      log.info(`Seller ${sellerId}: ${newItems.length} new listings`);

      for (const item of newItems) {
        const normalized = {
          id: item.id,
          title: item.title,
          price: parseFloat(item.price?.amount || item.price || 0),
          brand: item.brand_title || '',
          url: item.url || '',
          photo: item.photo?.url || '',
          seller: { login: sellerId },
        };

        await this.notifier.notify('sellerNewListing', {
          title: `New from ${seller.name || sellerId}: ${normalized.title}`,
          item: normalized,
          seller,
        });
      }
    }

    this.sellerKnownItems.set(sellerId, currentIds);
  }

  // ── Watchlist / Price Drop ──

  async checkWatchlist() {
    for (const itemId of this.config.watchlist) {
      if (!this.running) break;
      try {
        await this.checkWatchedItem(itemId);
        this.stats.checksPerformed++;
      } catch (error) {
        log.error(`Failed to check item ${itemId}: ${error.message}`);
      }
      await sleep(1000);
    }
  }

  async checkWatchedItem(itemId) {
    const country = this.fullConfig.countries[0];
    const result = await this.client.request(country, `/items/${itemId}`);

    if (result.status !== 200 || !result.data) return;

    const raw = result.data?.item || result.data;
    const currentPrice = parseFloat(raw.price?.amount || raw.price || 0);
    const isSold = raw.is_closed || raw.status === 'sold';

    // Store price history
    if (!this.priceHistory.has(itemId)) {
      this.priceHistory.set(itemId, []);
    }
    this.priceHistory.get(itemId).push({ price: currentPrice, timestamp: Date.now() });

    const prev = this.watchedItems.get(itemId);

    if (prev) {
      // Check price drop
      if (currentPrice < prev.price) {
        const dropPercent = ((prev.price - currentPrice) / prev.price * 100).toFixed(1);

        if (dropPercent >= this.config.priceDropThresholdPercent) {
          this.stats.priceDropsDetected++;
          log.info(`Price drop on item ${itemId}: ${prev.price}€ → ${currentPrice}€ (-${dropPercent}%)`);

          await this.notifier.notify('priceDrop', {
            title: `Price Drop: ${raw.title} (-${dropPercent}%)`,
            item: {
              id: itemId,
              title: raw.title,
              price: currentPrice,
              previousPrice: prev.price,
              dropPercent: +dropPercent,
              url: raw.url || '',
              photo: raw.photo?.url || '',
            },
          });
        }
      }

      // Check if sold
      if (isSold && !prev.isSold) {
        this.stats.itemsSold++;
        await this.notifier.notify('itemSold', {
          title: `Sold: ${raw.title}`,
          item: { id: itemId, title: raw.title, price: currentPrice },
        });
      }
    }

    this.watchedItems.set(itemId, {
      price: currentPrice,
      isSold,
      title: raw.title,
      lastChecked: Date.now(),
    });
  }

  // ── API ──

  addSellerWatch(seller) {
    this.config.sellers.push(seller);
    log.info(`Added seller watch: ${seller.id || seller.username}`);
  }

  removeSellerWatch(sellerId) {
    this.config.sellers = this.config.sellers.filter(s => (s.id || s.username) !== sellerId);
    this.sellerKnownItems.delete(sellerId);
  }

  addToWatchlist(itemId) {
    if (!this.config.watchlist.includes(itemId)) {
      this.config.watchlist.push(itemId);
      log.info(`Added item ${itemId} to watchlist`);
    }
  }

  removeFromWatchlist(itemId) {
    this.config.watchlist = this.config.watchlist.filter(id => id !== itemId);
    this.watchedItems.delete(itemId);
    this.priceHistory.delete(itemId);
  }

  getPriceHistory(itemId) {
    return this.priceHistory.get(itemId) || [];
  }

  getStats() {
    return {
      ...this.stats,
      watchedSellers: this.config.sellers.length,
      watchlistSize: this.config.watchlist.length,
      trackedPrices: this.priceHistory.size,
    };
  }
}
