import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { createLogger } from '../utils/logger.js';

const log = createLogger('crm');

/**
 * CRM Inventory — Gestion complète du cycle de vie post-achat.
 *
 * Pipeline :  ACHETÉ → EXPÉDIÉ → REÇU → EN_VENTE → VENDU
 *                                          ↓
 *                                      RELANCÉ (baisse prix auto)
 *
 * Persistance : JSON sur disque (data/inventory.json)
 * Rechargé au démarrage, sauvé à chaque modification.
 */

const STATUSES = {
  ACHETE: 'achete',
  EXPEDIE: 'expedie',
  RECU: 'recu',
  EN_VENTE: 'en_vente',
  VENDU: 'vendu',
  ANNULE: 'annule',
};

const STATUS_LABELS = {
  achete: '📦 Acheté',
  expedie: '🚚 Expédié',
  recu: '✅ Reçu',
  en_vente: '🏷️ En vente',
  vendu: '💰 Vendu',
  annule: '❌ Annulé',
};

const STATUS_COLORS = {
  achete: '#f59e0b',
  expedie: '#3b82f6',
  recu: '#8b5cf6',
  en_vente: '#10b981',
  vendu: '#06d6a0',
  annule: '#ef4444',
};

// Valid transitions
const TRANSITIONS = {
  achete: ['expedie', 'recu', 'annule'],
  expedie: ['recu', 'annule'],
  recu: ['en_vente', 'annule'],
  en_vente: ['vendu', 'annule'],
  vendu: [],
  annule: [],
};

export { STATUSES, STATUS_LABELS, STATUS_COLORS, TRANSITIONS };

export class CRMInventory {
  constructor(config = {}) {
    this.config = {
      dataDir: config.dataDir || 'data',
      defaultMarginPercent: config.defaultMarginPercent || 30,
      platformFeePercent: config.platformFeePercent || 5,
      shippingCostDefault: config.shippingCostDefault || 3,
      autoSaveDebounceMs: 2000,
      ...config,
    };

    this.dataPath = resolve(this.config.dataDir, 'inventory.json');
    this.items = new Map(); // id → InventoryItem
    this.nextId = 1;
    this.saveTimer = null;

    // Stats
    this.stats = {
      totalPurchases: 0,
      totalSold: 0,
      totalRevenue: 0,
      totalCost: 0,
      totalProfit: 0,
    };

    this.load();
  }

  /**
   * Add a new purchase to inventory.
   * Called automatically when autobuy succeeds (or dry run).
   */
  addPurchase(item, record = {}) {
    const id = this.nextId++;

    const entry = {
      id,
      vintedItemId: item.id,
      title: item.title || '',
      brand: item.brand || '',
      size: item.size || '',
      condition: item.condition || '',
      description: item.description || '',
      photo: item.photo || '',
      photos: item.photos || [],
      url: item.url || '',
      country: item.country || 'fr',

      // Purchase info
      purchasePrice: item.price || 0,
      purchaseCurrency: item.currency || 'EUR',
      purchaseDate: new Date().toISOString(),
      seller: item.seller?.login || '',
      sellerRating: item.seller?.rating || 0,
      transactionId: record.transactionId || null,
      autobuyRule: record.rule || record.matchedRule || null,
      dryRun: record.dryRun || false,

      // Deal info at time of purchase
      dealScore: item.dealScore || 0,
      dealLabel: item.dealLabel || '',
      marketMedian: item.marketMedian || 0,

      // Status
      status: STATUSES.ACHETE,
      statusHistory: [
        { status: STATUSES.ACHETE, date: new Date().toISOString(), note: 'Achat initial' },
      ],

      // Resale info
      resalePrice: 0,          // Target resale price (auto-calculated or manual)
      resalePriceEffective: 0, // Actual sale price
      resaleChannel: '',       // vinted, vestiaire, depop, ebay, other
      resaleUrl: '',           // URL of the resale listing
      resaleDate: null,        // When listed for sale
      soldDate: null,          // When sold

      // Costs
      shippingInbound: this.config.shippingCostDefault,
      shippingOutbound: 0,
      platformFees: 0,
      otherFees: 0,

      // Calculated
      netProfit: 0,
      marginPercent: 0,
      daysInStock: 0,

      // Relance
      relanceCount: 0,
      lastRelanceDate: null,
      originalResalePrice: 0,

      // Notes
      notes: '',
      tags: [],

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Auto-calculate resale price
    if (item.marketMedian && item.marketMedian > 0) {
      entry.resalePrice = Math.round(item.marketMedian * 100) / 100;
    } else {
      entry.resalePrice = Math.round(item.price * (1 + this.config.defaultMarginPercent / 100) * 100) / 100;
    }
    entry.originalResalePrice = entry.resalePrice;

    this.items.set(id, entry);
    this.stats.totalPurchases++;
    this.stats.totalCost += entry.purchasePrice;

    this.scheduleSave();

    log.info(`CRM: Ajouté #${id} "${entry.title}" — acheté ${entry.purchasePrice}€, revente cible ${entry.resalePrice}€`);

    return entry;
  }

  /**
   * Add a purchase manually (from dashboard — paste Vinted URL).
   */
  addManual({ title, brand, size, condition, price, photo, url, notes }) {
    return this.addPurchase(
      { title, brand, size, condition, price, photo, photos: photo ? [photo] : [], url },
      { rule: 'manual' },
    );
  }

  /**
   * Update the status of an inventory item.
   */
  updateStatus(id, newStatus, note = '') {
    const item = this.items.get(id);
    if (!item) throw new Error(`Item #${id} not found`);

    const allowed = TRANSITIONS[item.status];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Cannot transition from ${item.status} to ${newStatus}. Allowed: ${allowed.join(', ')}`);
    }

    const oldStatus = item.status;
    item.status = newStatus;
    item.statusHistory.push({
      status: newStatus,
      date: new Date().toISOString(),
      note: note || `${STATUS_LABELS[oldStatus]} → ${STATUS_LABELS[newStatus]}`,
    });
    item.updatedAt = new Date().toISOString();

    // Side effects
    if (newStatus === STATUSES.EN_VENTE) {
      item.resaleDate = new Date().toISOString();
    }

    if (newStatus === STATUSES.VENDU) {
      item.soldDate = new Date().toISOString();
      this.calculateProfit(item);
      this.stats.totalSold++;
      this.stats.totalRevenue += item.resalePriceEffective || item.resalePrice;
      this.stats.totalProfit += item.netProfit;
    }

    this.scheduleSave();
    log.info(`CRM: #${id} "${item.title}" — ${STATUS_LABELS[oldStatus]} → ${STATUS_LABELS[newStatus]}`);

    return item;
  }

  /**
   * Mark as sold with actual sale price.
   */
  markSold(id, salePrice, channel = '') {
    const item = this.items.get(id);
    if (!item) throw new Error(`Item #${id} not found`);

    item.resalePriceEffective = salePrice;
    if (channel) item.resaleChannel = channel;

    // Handle direct transition from any status to vendu
    if (item.status !== 'en_vente') {
      // Force transition through intermediate states
      item.statusHistory.push({ status: 'en_vente', date: new Date().toISOString(), note: 'auto' });
    }

    return this.updateStatus(id, STATUSES.VENDU, `Vendu ${salePrice}€${channel ? ` sur ${channel}` : ''}`);
  }

  /**
   * Update resale price.
   */
  updatePrice(id, newPrice, reason = 'manual') {
    const item = this.items.get(id);
    if (!item) throw new Error(`Item #${id} not found`);

    const oldPrice = item.resalePrice;
    item.resalePrice = newPrice;
    item.updatedAt = new Date().toISOString();

    if (reason === 'relance') {
      item.relanceCount++;
      item.lastRelanceDate = new Date().toISOString();
    }

    this.scheduleSave();
    log.info(`CRM: #${id} prix ${oldPrice}€ → ${newPrice}€ (${reason})`);

    return item;
  }

  /**
   * Calculate net profit for an item.
   */
  calculateProfit(item) {
    const salePrice = item.resalePriceEffective || item.resalePrice;
    const platformFees = salePrice * (this.config.platformFeePercent / 100);
    item.platformFees = Math.round(platformFees * 100) / 100;

    item.netProfit = Math.round((
      salePrice
      - item.purchasePrice
      - item.shippingInbound
      - item.shippingOutbound
      - item.platformFees
      - item.otherFees
    ) * 100) / 100;

    item.marginPercent = item.purchasePrice > 0
      ? Math.round((item.netProfit / item.purchasePrice) * 100)
      : 0;

    // Days in stock
    const start = new Date(item.purchaseDate);
    const end = item.soldDate ? new Date(item.soldDate) : new Date();
    item.daysInStock = Math.floor((end - start) / (1000 * 60 * 60 * 24));

    return item;
  }

  /**
   * Get all items, optionally filtered.
   */
  getAll(filters = {}) {
    let items = [...this.items.values()];

    if (filters.status) items = items.filter(i => i.status === filters.status);
    if (filters.brand) items = items.filter(i => i.brand.toLowerCase().includes(filters.brand.toLowerCase()));
    if (filters.channel) items = items.filter(i => i.resaleChannel === filters.channel);
    if (filters.dryRun !== undefined) items = items.filter(i => i.dryRun === filters.dryRun);

    // Sort by date (newest first)
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return items;
  }

  getById(id) {
    return this.items.get(id) || null;
  }

  delete(id) {
    const item = this.items.get(id);
    if (!item) return false;
    this.items.delete(id);
    this.scheduleSave();
    return true;
  }

  /**
   * Get items that need relance (in vente > X days, not relanced recently).
   */
  getItemsToRelance(maxDays = 7) {
    const now = Date.now();
    return [...this.items.values()].filter(item => {
      if (item.status !== STATUSES.EN_VENTE) return false;
      const listedDate = new Date(item.resaleDate || item.createdAt);
      const daysSinceListed = (now - listedDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceListed >= maxDays;
    });
  }

  /**
   * Get full stats.
   */
  getStats() {
    const items = [...this.items.values()];
    const byStatus = {};
    for (const s of Object.values(STATUSES)) {
      byStatus[s] = items.filter(i => i.status === s).length;
    }

    const sold = items.filter(i => i.status === STATUSES.VENDU);
    const inStock = items.filter(i => !['vendu', 'annule'].includes(i.status));
    const enVente = items.filter(i => i.status === STATUSES.EN_VENTE);

    const totalInvested = inStock.reduce((s, i) => s + i.purchasePrice, 0);
    const totalResaleValue = enVente.reduce((s, i) => s + i.resalePrice, 0);
    const totalProfit = sold.reduce((s, i) => s + i.netProfit, 0);
    const totalRevenue = sold.reduce((s, i) => s + (i.resalePriceEffective || i.resalePrice), 0);
    const avgMargin = sold.length > 0 ? Math.round(totalProfit / sold.length * 100) / 100 : 0;
    const avgDaysToSell = sold.length > 0 ? Math.round(sold.reduce((s, i) => s + i.daysInStock, 0) / sold.length) : 0;

    // Top profitable items
    const topProfitable = sold
      .sort((a, b) => b.netProfit - a.netProfit)
      .slice(0, 5)
      .map(i => ({ id: i.id, title: i.title, profit: i.netProfit, margin: i.marginPercent }));

    // By brand
    const byBrand = {};
    for (const item of sold) {
      const b = item.brand || 'Autre';
      if (!byBrand[b]) byBrand[b] = { count: 0, profit: 0, revenue: 0 };
      byBrand[b].count++;
      byBrand[b].profit += item.netProfit;
      byBrand[b].revenue += item.resalePriceEffective || item.resalePrice;
    }

    // Items needing relance
    const needRelance = this.getItemsToRelance(7).length;

    return {
      total: items.length,
      byStatus,
      inStock: inStock.length,
      enVente: enVente.length,
      sold: sold.length,
      totalInvested: Math.round(totalInvested * 100) / 100,
      totalResaleValue: Math.round(totalResaleValue * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      avgMargin,
      avgDaysToSell,
      needRelance,
      topProfitable,
      byBrand,
    };
  }

  // ── Persistence ──

  load() {
    try {
      if (existsSync(this.dataPath)) {
        const raw = JSON.parse(readFileSync(this.dataPath, 'utf-8'));
        this.nextId = raw.nextId || 1;
        for (const item of (raw.items || [])) {
          this.items.set(item.id, item);
        }
        this.recalcStats();
        log.info(`CRM: Loaded ${this.items.size} items from disk`);
      }
    } catch (error) {
      log.error(`CRM: Failed to load inventory: ${error.message}`);
    }
  }

  save() {
    try {
      mkdirSync(this.config.dataDir, { recursive: true });
      const data = {
        nextId: this.nextId,
        items: [...this.items.values()],
        savedAt: new Date().toISOString(),
      };
      writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      log.error(`CRM: Failed to save inventory: ${error.message}`);
    }
  }

  scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), this.config.autoSaveDebounceMs);
  }

  recalcStats() {
    const items = [...this.items.values()];
    this.stats.totalPurchases = items.length;
    this.stats.totalSold = items.filter(i => i.status === STATUSES.VENDU).length;
    this.stats.totalRevenue = items.filter(i => i.status === STATUSES.VENDU)
      .reduce((s, i) => s + (i.resalePriceEffective || 0), 0);
    this.stats.totalCost = items.reduce((s, i) => s + i.purchasePrice, 0);
    this.stats.totalProfit = items.filter(i => i.status === STATUSES.VENDU)
      .reduce((s, i) => s + i.netProfit, 0);
  }

  destroy() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.save(); // Final save
  }
}
