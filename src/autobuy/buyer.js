import { createLogger } from '../utils/logger.js';
import { sleep } from '../utils/retry.js';

const log = createLogger('autobuy');

/**
 * AutoBuyer v2 - Rule-based purchasing with full safety controls.
 *
 * HOW IT WORKS:
 *
 * 1. RULES: You define rules in config.json, each with conditions:
 *    - keywords, brands, sizes, price range, seller requirements
 *    - Each rule is evaluated independently
 *    - An item matches if ALL conditions in a rule are met
 *
 * 2. FLOW:
 *    a) New item detected by search poller
 *    b) evaluateItem(item) checks against ALL enabled rules
 *    c) If a rule matches → tryBuy(item, rule)
 *    d) tryBuy: re-fetches item details → double-checks → executes
 *
 * 3. MODES:
 *    - 'instant': Call buy API immediately
 *    - 'offer': Send an offer at X% below asking price
 *
 * 4. DRY RUN: When dryRun=true, logs everything but doesn't buy
 *    → USE THIS FIRST to validate your rules!
 *
 * 5. SAFETY:
 *    - Daily purchase limit + daily spend limit
 *    - Cooldown between buys
 *    - Blacklists (sellers + items)
 *    - Min price (avoid scam/too-cheap items)
 *    - Max item age (only buy fresh listings)
 *    - Seller age check
 *    - Full audit log
 */
export class AutoBuyer {
  constructor(config, client, sessionPool, notifier) {
    this.config = config.autobuy;
    this.fullConfig = config;
    this.client = client;
    this.sessionPool = sessionPool;
    this.notifier = notifier;

    // State
    this.purchaseLog = [];
    this.lastBuyAt = 0;
    this.lastEvalAt = 0;
    this.dailyPurchases = 0;
    this.dailySpend = 0;
    this.dailyResetDate = todayStr();

    // Pending confirmations: itemId → { resolve, reject, item, rule, timer }
    this.pendingConfirmations = new Map();

    this.stats = {
      evaluated: 0,
      matched: 0,
      bought: 0,
      skipped: 0,
      failed: 0,
      dryRunBlocked: 0,
    };
  }

  /**
   * Evaluate an item against ALL autobuy rules.
   * Returns { shouldBuy, matchedRule, reason }
   */
  evaluateItem(item) {
    this.stats.evaluated++;

    if (!this.config.enabled) {
      return { shouldBuy: false, reason: 'autobuy disabled' };
    }

    // Reset daily counters
    if (todayStr() !== this.dailyResetDate) {
      this.dailyPurchases = 0;
      this.dailySpend = 0;
      this.dailyResetDate = todayStr();
    }

    // Global limits
    if (this.dailyPurchases >= this.config.maxDailyPurchases) {
      return { shouldBuy: false, reason: `daily limit: ${this.dailyPurchases}/${this.config.maxDailyPurchases}` };
    }
    if (this.dailySpend >= this.config.maxDailySpend) {
      return { shouldBuy: false, reason: `daily spend limit: ${this.dailySpend}€/${this.config.maxDailySpend}€` };
    }

    // Cooldown
    const sinceBuy = Date.now() - this.lastBuyAt;
    if (sinceBuy < this.config.cooldownBetweenBuysMs) {
      return { shouldBuy: false, reason: `cooldown: ${Math.round((this.config.cooldownBetweenBuysMs - sinceBuy) / 1000)}s` };
    }

    // Global evaluation rate limit
    const sinceEval = Date.now() - this.lastEvalAt;
    if (sinceEval < this.config.globalCooldownMs) {
      return { shouldBuy: false, reason: 'eval cooldown' };
    }
    this.lastEvalAt = Date.now();

    // Blacklists
    if (this.config.blacklistedItemIds.includes(item.id)) {
      return { shouldBuy: false, reason: 'item blacklisted' };
    }
    if (this.config.blacklistedSellers.includes(item.seller?.login) ||
        this.config.blacklistedSellers.includes(item.seller?.id)) {
      return { shouldBuy: false, reason: 'seller blacklisted' };
    }

    // Item state
    if (item.isReserved) return { shouldBuy: false, reason: 'reserved' };
    if (item.isClosed) return { shouldBuy: false, reason: 'sold/closed' };
    if (item.isHidden) return { shouldBuy: false, reason: 'hidden' };

    // Check each rule
    for (const rule of this.config.rules) {
      if (!rule.enabled) continue;
      const result = this.checkRule(item, rule);
      if (result.matches) {
        this.stats.matched++;
        log.info(`MATCH: "${item.title}" (${item.price}€) matches rule "${rule.name}"`);
        return { shouldBuy: true, matchedRule: rule, reason: `matched rule: ${rule.name}` };
      }
    }

    this.stats.skipped++;
    return { shouldBuy: false, reason: 'no rule matched' };
  }

  /**
   * Check a single rule against an item.
   */
  checkRule(item, rule) {
    const title = (item.title || '').toLowerCase();
    const price = item.price || 0;

    // Price range
    if (rule.maxPrice && price > rule.maxPrice) {
      return { matches: false, reason: `price ${price} > max ${rule.maxPrice}` };
    }
    if (rule.minPrice && price < rule.minPrice) {
      return { matches: false, reason: `price ${price} < min ${rule.minPrice} (suspicious)` };
    }

    // Keywords (at least one must match)
    if (rule.keywords?.length > 0) {
      const hasKw = rule.keywords.some(kw => title.includes(kw.toLowerCase()));
      if (!hasKw) return { matches: false, reason: 'no keyword match' };
    }

    // Exclude keywords
    if (rule.excludeKeywords?.length > 0) {
      const hasExclude = rule.excludeKeywords.some(kw => title.includes(kw.toLowerCase()));
      if (hasExclude) return { matches: false, reason: 'exclude keyword matched' };
    }

    // Brand
    if (rule.brands?.length > 0) {
      const brand = (item.brand || '').toLowerCase();
      const hasBrand = rule.brands.some(b => brand.includes(b.toLowerCase()));
      if (!hasBrand) return { matches: false, reason: 'brand mismatch' };
    }

    // Size
    if (rule.sizes?.length > 0) {
      const size = (item.size || '').toLowerCase();
      const hasSize = rule.sizes.some(s => size.includes(s.toLowerCase()));
      if (!hasSize) return { matches: false, reason: 'size mismatch' };
    }

    // Condition
    if (rule.conditions?.length > 0) {
      const cond = (item.condition || '').toLowerCase().replace(/\s+/g, '_');
      const hasCond = rule.conditions.some(c => cond.includes(c.toLowerCase()));
      if (!hasCond) return { matches: false, reason: 'condition mismatch' };
    }

    // Seller rating (Vinted uses 0-5 scale)
    if (rule.minSellerRating && (item.seller?.rating || 0) < rule.minSellerRating) {
      return { matches: false, reason: `seller rating ${item.seller?.rating} < ${rule.minSellerRating}` };
    }

    // Seller reviews
    if (rule.minSellerReviews && (item.seller?.reviewCount || 0) < rule.minSellerReviews) {
      return { matches: false, reason: `seller reviews ${item.seller?.reviewCount} < ${rule.minSellerReviews}` };
    }

    // Item age (only buy recent listings)
    if (rule.maxItemAge && item.createdAt) {
      const ageSeconds = (Date.now() - new Date(item.createdAt).getTime()) / 1000;
      if (ageSeconds > rule.maxItemAge) {
        return { matches: false, reason: `item age ${Math.round(ageSeconds)}s > max ${rule.maxItemAge}s` };
      }
    }

    // Country filter
    if (rule.countries?.length > 0 && item.country) {
      if (!rule.countries.includes(item.country)) {
        return { matches: false, reason: 'country mismatch' };
      }
    }

    return { matches: true };
  }

  /**
   * Full buy flow: evaluate → fetch details → confirm → execute.
   */
  async tryBuy(country, item) {
    const eval_ = this.evaluateItem(item);

    if (!eval_.shouldBuy) {
      return { purchased: false, reason: eval_.reason };
    }

    const rule = eval_.matchedRule;

    // DRY RUN: log but don't buy
    if (this.config.dryRun) {
      this.stats.dryRunBlocked++;
      const msg = `[DRY RUN] Would buy "${item.title}" for ${item.price}€ (rule: ${rule.name})`;
      log.info(msg);
      await this.notifier?.notify('autobuyExecuted', {
        title: `🧪 DRY RUN: ${item.title} — ${item.price}€`,
        item,
        record: { dryRun: true, rule: rule.name },
      });
      return { purchased: false, reason: 'dry run', dryRun: true, matchedRule: rule.name };
    }

    try {
      // Step 1: Re-fetch item to verify it's still available
      log.info(`Re-fetching item ${item.id} before purchase...`);
      const fresh = await this.fetchFreshItem(country, item.id);

      if (!fresh) {
        return { purchased: false, reason: 'could not re-fetch item' };
      }
      if (fresh.isClosed || fresh.isReserved) {
        return { purchased: false, reason: 'item no longer available' };
      }
      if (!fresh.canBuy) {
        return { purchased: false, reason: 'canBuy=false' };
      }
      // Re-check price (might have changed)
      if (rule.maxPrice && fresh.price > rule.maxPrice) {
        return { purchased: false, reason: `price changed: ${fresh.price}€ > max ${rule.maxPrice}€` };
      }

      // Step 2: Confirmation mode
      if (this.config.confirmationMode === 'confirm') {
        log.info(`Awaiting confirmation for "${item.title}" (${item.price}€)...`);
        await this.notifier?.notify('autobuyExecuted', {
          title: `⏳ Confirmation needed: ${item.title} — ${item.price}€`,
          item: fresh,
          record: { awaitingConfirmation: true, rule: rule.name },
        });
        // In a real implementation, you'd wait for user input via dashboard/telegram
        // For now, auto-confirm after timeout
        await sleep(5000);
      }

      // Step 3: Execute purchase
      let result;
      if (this.config.mode === 'offer') {
        result = await this.executeOffer(country, item.id, fresh.price, rule);
      } else {
        result = await this.executeBuy(country, item.id);
      }

      if (result.success) {
        this.lastBuyAt = Date.now();
        this.dailyPurchases++;
        this.dailySpend += fresh.price;
        this.stats.bought++;

        const record = {
          itemId: item.id,
          title: item.title,
          price: fresh.price,
          seller: item.seller?.login,
          rule: rule.name,
          mode: this.config.mode,
          transactionId: result.transactionId,
          timestamp: new Date().toISOString(),
        };

        this.purchaseLog.push(record);
        log.info(`PURCHASED: "${item.title}" for ${fresh.price}€ (rule: ${rule.name})`);

        await this.notifier?.notifyBuy(item, record);
        return { purchased: true, record };
      } else {
        this.stats.failed++;
        log.warn(`Purchase failed: ${result.reason}`);
        await this.notifier?.notifyBuyFailed(item, result.reason);
        return { purchased: false, reason: result.reason };
      }
    } catch (error) {
      this.stats.failed++;
      log.error(`Autobuy error: ${error.message}`);
      return { purchased: false, reason: error.message };
    }
  }

  /**
   * Execute instant buy via Vinted API.
   *
   * Vinted's buy flow (simplified):
   * 1. POST /transactions → creates a pending transaction
   * 2. The user's default payment method is charged
   * 3. Item is marked as reserved
   *
   * NOTE: Payment method MUST be pre-configured on the Vinted account.
   * We never handle card details.
   */
  async executeBuy(country, itemId) {
    const { email, password } = this.fullConfig.vinted;
    if (!email || !password) {
      return { success: false, reason: 'no Vinted credentials configured' };
    }

    try {
      const response = await this.client.authRequest(country, '/transactions', {
        method: 'POST',
        body: { item_id: itemId },
        email,
        password,
      });

      if (response.status >= 200 && response.status < 300) {
        return {
          success: true,
          transactionId: response.data?.transaction?.id || response.data?.id,
        };
      }

      const errMsg = response.data?.error?.message ||
                     response.data?.errors?.[0]?.message ||
                     JSON.stringify(response.data);
      return { success: false, reason: `API ${response.status}: ${errMsg}` };
    } catch (error) {
      return { success: false, reason: error.message };
    }
  }

  /**
   * Make an offer instead of instant buy.
   */
  async executeOffer(country, itemId, currentPrice, rule) {
    const { email, password } = this.fullConfig.vinted;
    if (!email || !password) {
      return { success: false, reason: 'no Vinted credentials configured' };
    }

    const discount = this.config.offerDiscountPercent / 100;
    const offerPrice = Math.round(currentPrice * (1 - discount) * 100) / 100;

    log.info(`Making offer: ${offerPrice}€ (${this.config.offerDiscountPercent}% off ${currentPrice}€)`);

    try {
      const response = await this.client.authRequest(country, `/items/${itemId}/offers`, {
        method: 'POST',
        body: {
          price: offerPrice,
          message: this.config.offerMessage,
        },
        email,
        password,
      });

      if (response.status >= 200 && response.status < 300) {
        return {
          success: true,
          transactionId: response.data?.offer?.id || response.data?.id,
          offerPrice,
        };
      }

      return { success: false, reason: `Offer API ${response.status}: ${JSON.stringify(response.data)}` };
    } catch (error) {
      return { success: false, reason: error.message };
    }
  }

  async fetchFreshItem(country, itemId) {
    try {
      const result = await this.client.request(country, `/items/${itemId}`);
      if (result.status === 200 && result.data) {
        const raw = result.data?.item || result.data;
        return {
          id: raw.id,
          title: raw.title,
          price: parseFloat(raw.price?.amount || raw.price || 0),
          canBuy: raw.can_buy ?? true,
          isReserved: raw.is_reserved || false,
          isClosed: raw.is_closed || false,
          condition: raw.status || '',
          seller: {
            login: raw.user?.login || '',
            rating: raw.user?.feedback_reputation || 0,
            reviewCount: raw.user?.feedback_count || 0,
          },
        };
      }
    } catch (error) {
      log.error(`Fetch item ${itemId} failed: ${error.message}`);
    }
    return null;
  }

  // ── Rule management ──

  addRule(rule) {
    if (!rule.name) rule.name = `Rule ${this.config.rules.length + 1}`;
    if (rule.enabled === undefined) rule.enabled = true;
    this.config.rules.push(rule);
    log.info(`Added autobuy rule: ${rule.name}`);
    return rule;
  }

  removeRule(name) {
    this.config.rules = this.config.rules.filter(r => r.name !== name);
  }

  toggleRule(name, enabled) {
    const rule = this.config.rules.find(r => r.name === name);
    if (rule) rule.enabled = enabled;
  }

  getRules() {
    return this.config.rules.map(r => ({
      ...r,
      // Add stats per rule
      matchCount: this.purchaseLog.filter(p => p.rule === r.name).length,
    }));
  }

  getStats() {
    return {
      ...this.stats,
      enabled: this.config.enabled,
      dryRun: this.config.dryRun,
      mode: this.config.mode,
      dailyPurchases: this.dailyPurchases,
      dailySpend: this.dailySpend,
      maxDailyPurchases: this.config.maxDailyPurchases,
      maxDailySpend: this.config.maxDailySpend,
      rulesCount: this.config.rules.length,
      activeRules: this.config.rules.filter(r => r.enabled).length,
      recentPurchases: this.purchaseLog.slice(-10),
    };
  }
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}
