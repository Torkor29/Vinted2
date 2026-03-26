import { createLogger } from '../utils/logger.js';

const log = createLogger('pricing');

/**
 * Auto-Pricing — Calcule le prix de revente optimal.
 *
 * Utilise les données du deal-scorer (marketMedian) pour fixer un prix
 * intelligent basé sur la stratégie choisie.
 */

const STRATEGIES = {
  aggressive: { label: 'Agressive', multiplier: 0.95, description: 'Médiane -5% (vente rapide)' },
  balanced: { label: 'Équilibrée', multiplier: 1.00, description: 'Médiane du marché (défaut)' },
  premium: { label: 'Premium', multiplier: 1.15, description: 'Médiane +15% (marge max)' },
  custom: { label: 'Custom', multiplier: 1.00, description: 'Marge fixe sur prix d\'achat' },
};

export { STRATEGIES };

export class AutoPricing {
  constructor(config = {}) {
    this.strategy = config.strategy || 'balanced';
    this.defaultMarginPercent = config.defaultMarginPercent || 30;
    this.minMarginPercent = config.minMarginPercent || 10;
    this.platformFeePercent = config.platformFeePercent || 5;
    this.shippingEstimate = config.shippingEstimate || 3;
  }

  /**
   * Calculate optimal resale price for an item.
   * @param {Object} item - Item with purchasePrice, marketMedian, etc.
   * @param {string} strategy - 'aggressive' | 'balanced' | 'premium' | 'custom'
   * @returns {{ price, breakdown, strategy }}
   */
  calculate(item, strategy = null) {
    const strat = strategy || this.strategy;
    const purchasePrice = item.purchasePrice || item.price || 0;
    const marketMedian = item.marketMedian || 0;

    let targetPrice;
    let method;

    if (strat === 'custom' || !marketMedian) {
      // No market data → use fixed margin
      targetPrice = purchasePrice * (1 + this.defaultMarginPercent / 100);
      method = `Prix achat + ${this.defaultMarginPercent}%`;
    } else {
      const mult = STRATEGIES[strat]?.multiplier || 1.0;
      targetPrice = marketMedian * mult;
      method = `Médiane ${marketMedian}€ × ${mult} (${STRATEGIES[strat]?.label})`;
    }

    // Calculate floor price (minimum to not lose money)
    const totalCosts = purchasePrice + this.shippingEstimate;
    const floorPrice = totalCosts / (1 - this.platformFeePercent / 100) * (1 + this.minMarginPercent / 100);

    // Ensure we're above floor
    if (targetPrice < floorPrice) {
      targetPrice = floorPrice;
      method += ` → relevé au plancher (${Math.round(floorPrice)}€)`;
    }

    // Round to nearest .50 or .00 (pricing psychology)
    targetPrice = Math.ceil(targetPrice * 2) / 2;

    // Breakdown
    const platformFees = targetPrice * (this.platformFeePercent / 100);
    const netAfterFees = targetPrice - platformFees - this.shippingEstimate;
    const netProfit = netAfterFees - purchasePrice;
    const marginPercent = purchasePrice > 0 ? Math.round((netProfit / purchasePrice) * 100) : 0;

    return {
      price: Math.round(targetPrice * 100) / 100,
      breakdown: {
        purchasePrice,
        marketMedian,
        targetPrice: Math.round(targetPrice * 100) / 100,
        platformFees: Math.round(platformFees * 100) / 100,
        shippingEstimate: this.shippingEstimate,
        netAfterFees: Math.round(netAfterFees * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100,
        marginPercent,
      },
      strategy: strat,
      method,
    };
  }

  /**
   * Calculate relance price (reduced price after X days without sale).
   * @param {Object} item - Inventory item
   * @param {Object[]} tiers - Array of { days, discountPercent }
   * @returns {{ newPrice, discount, tier } | null}
   */
  calculateRelancePrice(item, tiers = null) {
    const defaultTiers = [
      { days: 7, discountPercent: 5 },
      { days: 14, discountPercent: 10 },
      { days: 21, discountPercent: 15 },
      { days: 30, discountPercent: 20 },
    ];

    const t = tiers || defaultTiers;
    const listedDate = new Date(item.resaleDate || item.createdAt);
    const daysSinceListed = (Date.now() - listedDate.getTime()) / (1000 * 60 * 60 * 24);

    // Find the applicable tier (highest days that we've exceeded)
    let applicableTier = null;
    for (const tier of t) {
      if (daysSinceListed >= tier.days) {
        applicableTier = tier;
      }
    }

    if (!applicableTier) return null;

    // Calculate from ORIGINAL resale price (not current, to avoid compounding)
    const basePrice = item.originalResalePrice || item.resalePrice;
    const discount = applicableTier.discountPercent;
    const newPrice = Math.round(basePrice * (1 - discount / 100) * 2) / 2; // Round to .50

    // Don't go below purchase price + minimal margin
    const floor = item.purchasePrice * 1.05;
    if (newPrice < floor) return null; // Would lose money

    // Only relance if price actually changes
    if (newPrice >= item.resalePrice) return null;

    return {
      newPrice,
      discount,
      tier: applicableTier,
      daysSinceListed: Math.floor(daysSinceListed),
      previousPrice: item.resalePrice,
    };
  }
}
