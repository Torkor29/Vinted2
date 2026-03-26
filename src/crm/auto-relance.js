import { createLogger } from '../utils/logger.js';
import { AutoPricing } from './pricing.js';
import { STATUSES } from './inventory.js';

const log = createLogger('relance');

/**
 * Auto-Relance — Baisse automatique des prix pour les invendus.
 *
 * Vérifie toutes les heures les articles en vente.
 * Si un article dépasse les paliers configurés → baisse le prix automatiquement.
 *
 * Paliers par défaut :
 *  7 jours  → -5%
 *  14 jours → -10%
 *  21 jours → -15%
 *  30 jours → -20%
 */
export class AutoRelance {
  constructor(inventory, notifier = null, telegramBot = null, config = {}) {
    this.inventory = inventory;
    this.notifier = notifier;
    this.telegramBot = telegramBot;
    this.pricing = new AutoPricing(config);

    this.config = {
      enabled: config.enabled ?? true,
      checkIntervalMs: config.checkIntervalMs || 60 * 60 * 1000, // 1h
      tiers: config.tiers || [
        { days: 7, discountPercent: 5 },
        { days: 14, discountPercent: 10 },
        { days: 21, discountPercent: 15 },
        { days: 30, discountPercent: 20 },
      ],
      maxRelances: config.maxRelances || 4,
    };

    this.timer = null;
    this.relanceLog = []; // Last 50 relances
  }

  /**
   * Start the auto-relance timer.
   */
  start() {
    if (!this.config.enabled) {
      log.info('Auto-relance désactivée');
      return;
    }

    log.info(`Auto-relance activée — vérification toutes les ${this.config.checkIntervalMs / 60000}min`);
    log.info(`Paliers : ${this.config.tiers.map(t => `${t.days}j→-${t.discountPercent}%`).join(', ')}`);

    // First check after 5 minutes (let the bot warm up)
    setTimeout(() => this.check(), 5 * 60_000);

    this.timer = setInterval(() => this.check(), this.config.checkIntervalMs);
  }

  /**
   * Run a relance check on all items in vente.
   */
  async check() {
    const items = this.inventory.getAll({ status: STATUSES.EN_VENTE });
    let relanced = 0;

    for (const item of items) {
      // Max relances reached
      if (item.relanceCount >= this.config.maxRelances) continue;

      const result = this.pricing.calculateRelancePrice(item, this.config.tiers);
      if (!result) continue;

      // Apply the price drop
      try {
        this.inventory.updatePrice(item.id, result.newPrice, 'relance');

        relanced++;
        const record = {
          itemId: item.id,
          title: item.title,
          oldPrice: result.previousPrice,
          newPrice: result.newPrice,
          discount: result.discount,
          daysSinceListed: result.daysSinceListed,
          relanceNumber: item.relanceCount,
          date: new Date().toISOString(),
        };
        this.relanceLog.push(record);
        if (this.relanceLog.length > 50) this.relanceLog.shift();

        log.info(`Relance #${item.relanceCount}: "${item.title}" ${result.previousPrice}€ → ${result.newPrice}€ (-${result.discount}%, ${result.daysSinceListed}j)`);

        // Notify
        if (this.notifier) {
          await this.notifier.notify('priceDrop', {
            title: `📉 Relance: ${item.title} — ${result.previousPrice}€ → ${result.newPrice}€`,
            item: {
              ...item,
              previousPrice: result.previousPrice,
              price: result.newPrice,
              dropPercent: result.discount,
            },
          }).catch(() => {});
        }

        // Telegram
        if (this.telegramBot) {
          const text = [
            `📉 <b>Relance #${item.relanceCount}</b>`,
            ``,
            `${item.title}`,
            `${result.previousPrice}€ → <b>${result.newPrice}€</b> (-${result.discount}%)`,
            `En vente depuis ${result.daysSinceListed} jours`,
          ].join('\n');
          await this.telegramBot.sendToTopic('stock', text).catch(() => {});
        }
      } catch (error) {
        log.error(`Relance failed for #${item.id}: ${error.message}`);
      }
    }

    if (relanced > 0) {
      log.info(`Auto-relance: ${relanced} article(s) relancé(s)`);
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getStats() {
    return {
      enabled: this.config.enabled,
      tiers: this.config.tiers,
      maxRelances: this.config.maxRelances,
      recentRelances: this.relanceLog.slice(-10),
      totalRelances: this.relanceLog.length,
    };
  }
}
