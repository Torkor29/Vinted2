import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';
import { getAllCatalogData } from '../data/vinted-catalog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const log = createLogger('dashboard');

/**
 * Dashboard - Real-time web UI for monitoring and control.
 *
 * Features:
 * - Live item feed (new items as they appear)
 * - Session pool status
 * - Autobuy stats + rule management
 * - Notification log
 * - Query management (add/remove/edit searches)
 * - Seller watch management
 * - Watchlist management
 * - Price history charts
 * - Export controls
 * - Proxy status
 */
export class Dashboard {
  constructor(config) {
    this.config = config.dashboard;
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIO(this.server, {
      cors: { origin: '*' },
      pingTimeout: 30000,
      pingInterval: 10000,
    });

    // References to other modules (set via setModules)
    this.modules = {};
    // Keep recent items server-side so new dashboard connections get history
    this.recentItems = [];
    this.maxRecentItems = 200;

    this.setupRoutes();
    this.setupSocket();
  }

  setModules({ sessionPool, search, autoBuyer, notifier, monitor, proxyManager, dealScorer, arbitrage, sniper }) {
    this.modules = { sessionPool, search, autoBuyer, notifier, monitor, proxyManager, dealScorer, arbitrage, sniper };
  }

  setupRoutes() {
    this.app.use(express.json());
    this.app.use(express.static(resolve(__dirname, 'public')));

    // ── API Routes ──

    // Bot start/stop control
    this.app.post('/api/bot/start', async (req, res) => {
      const sniper = this.modules.sniper;
      if (!sniper) return res.json({ ok: false, error: 'sniper not ready' });
      if (sniper.running) return res.json({ ok: false, error: 'already running' });
      if (!sniper.queries || sniper.queries.length === 0) {
        return res.json({ ok: false, error: 'no_queries', message: 'Ajoute au moins un filtre avant de lancer le bot' });
      }
      sniper.startBot();
      res.json({ ok: true, running: true, queries: sniper.queries.length });
    });
    this.app.post('/api/bot/stop', async (req, res) => {
      const sniper = this.modules.sniper;
      if (!sniper) return res.json({ ok: false });
      await sniper.stopBot();
      res.json({ ok: true, running: false });
    });
    this.app.get('/api/bot/status', (req, res) => {
      const sniper = this.modules.sniper;
      res.json({
        running: sniper?.running || false,
        queries: sniper?.queries?.length || 0,
        totalNewItems: sniper?.totalNewItems || 0,
        pollCycles: sniper?.pollCycles || 0,
      });
    });

    // Catalog data (genres, categories, brands, sizes, colors, conditions)
    this.app.get('/api/catalog', (req, res) => {
      res.json(getAllCatalogData());
    });

    // Brand search via Vinted API (returns correct brand IDs)
    this.app.get('/api/brands/search', async (req, res) => {
      const q = req.query.q;
      if (!q || q.length < 2) return res.json([]);
      try {
        const client = this.modules.sniper?.search?.client;
        const country = this.modules.sniper?.fullConfig?.countries?.[0] || 'fr';
        if (!client) return res.json(getAllCatalogData().brands.filter(b => b.label.toLowerCase().includes(q.toLowerCase())).slice(0, 20));
        const result = await client.request(country, '/catalog/brands', { params: { query: q, per_page: 20 } });
        const brands = (result?.brands || result?.data?.brands || []).map(b => ({ id: b.id, label: b.title || b.name || b.label }));
        res.json(brands.length ? brands : getAllCatalogData().brands.filter(b => b.label.toLowerCase().includes(q.toLowerCase())).slice(0, 20));
      } catch {
        // Fallback to local catalog
        res.json(getAllCatalogData().brands.filter(b => b.label.toLowerCase().includes(q.toLowerCase())).slice(0, 20));
      }
    });

    // Stats
    this.app.get('/api/stats', (req, res) => {
      res.json(this.getFullStats());
    });

    // Queries
    this.app.get('/api/queries', (req, res) => {
      res.json(this.modules.sniper?.queries || []);
    });
    this.app.post('/api/queries', (req, res) => {
      const query = req.body;
      // Tag dashboard queries with admin chatId for notification routing
      if (!query._chatId) {
        const tgConfig = this.modules.sniper?.fullConfig?.notifications?.telegram;
        if (tgConfig?.chatId) query._chatId = String(tgConfig.chatId);
      }
      this.modules.sniper?.queries.push(query);
      this.broadcast('queries:updated', this.modules.sniper?.queries);
      res.json({ ok: true, queries: this.modules.sniper?.queries });
    });
    this.app.delete('/api/queries/:index', (req, res) => {
      const idx = parseInt(req.params.index);
      const queries = this.modules.sniper?.queries;
      if (!queries || isNaN(idx) || idx < 0 || idx >= queries.length) {
        return res.json({ ok: false, error: 'invalid index' });
      }
      queries.splice(idx, 1);
      this.broadcast('queries:updated', queries);
      res.json({ ok: true });
    });

    // Autobuy rules
    this.app.get('/api/autobuy/rules', (req, res) => {
      res.json(this.modules.autoBuyer?.getRules() || []);
    });
    this.app.post('/api/autobuy/rules', (req, res) => {
      const rule = this.modules.autoBuyer?.addRule(req.body);
      res.json({ ok: true, rule });
    });
    this.app.delete('/api/autobuy/rules/:name', (req, res) => {
      this.modules.autoBuyer?.removeRule(req.params.name);
      res.json({ ok: true });
    });
    this.app.patch('/api/autobuy/rules/:name', (req, res) => {
      this.modules.autoBuyer?.toggleRule(req.params.name, req.body.enabled);
      res.json({ ok: true });
    });
    this.app.get('/api/autobuy/stats', (req, res) => {
      res.json(this.modules.autoBuyer?.getStats() || {});
    });

    // Sellers
    this.app.get('/api/sellers', (req, res) => {
      res.json(this.modules.monitor?.config?.sellers || []);
    });
    this.app.post('/api/sellers', (req, res) => {
      this.modules.monitor?.addSellerWatch(req.body);
      res.json({ ok: true });
    });
    this.app.delete('/api/sellers/:id', (req, res) => {
      this.modules.monitor?.removeSellerWatch(req.params.id);
      res.json({ ok: true });
    });

    // Watchlist
    this.app.get('/api/watchlist', (req, res) => {
      res.json(this.modules.monitor?.config?.watchlist || []);
    });
    this.app.post('/api/watchlist', (req, res) => {
      this.modules.monitor?.addToWatchlist(req.body.itemId);
      res.json({ ok: true });
    });
    this.app.delete('/api/watchlist/:id', (req, res) => {
      this.modules.monitor?.removeFromWatchlist(parseInt(req.params.id));
      res.json({ ok: true });
    });
    this.app.get('/api/watchlist/:id/history', (req, res) => {
      res.json(this.modules.monitor?.getPriceHistory(parseInt(req.params.id)) || []);
    });

    // Notifications
    this.app.get('/api/notifications', (req, res) => {
      res.json(this.modules.notifier?.getRecentNotifications() || []);
    });

    // Sessions
    this.app.get('/api/sessions', (req, res) => {
      res.json(this.modules.sessionPool?.getStats() || {});
    });

    // Proxies
    this.app.get('/api/proxies', (req, res) => {
      res.json(this.modules.proxyManager?.getStats() || {});
    });

    // Items (backlog for polling fallback)
    this.app.get('/api/items', (req, res) => {
      res.json(this.recentItems);
    });

    // Deal intelligence
    this.app.get('/api/deals/top', (req, res) => {
      res.json(this.modules.dealScorer?.getTopDeals(30) || []);
    });
    this.app.get('/api/deals/stats', (req, res) => {
      res.json(this.modules.dealScorer?.getStats() || {});
    });
    this.app.get('/api/deals/brand/:brand', (req, res) => {
      res.json(this.modules.dealScorer?.getBrandMarketData(req.params.brand) || null);
    });
    this.app.get('/api/deals/history/:itemId', (req, res) => {
      res.json(this.modules.dealScorer?.getPriceHistory(parseInt(req.params.itemId)) || []);
    });

    // Arbitrage
    this.app.get('/api/arbitrage', (req, res) => {
      res.json(this.modules.arbitrage?.getOpportunities(30) || []);
    });
    this.app.get('/api/arbitrage/stats', (req, res) => {
      res.json(this.modules.arbitrage?.getStats() || {});
    });

    // ── Image Search ──
    this.app.get('/api/image-search', (req, res) => {
      res.json(this.modules.imageSearch?.getStats() || { references: 0 });
    });
    this.app.get('/api/image-search/references', (req, res) => {
      res.json(this.modules.imageSearch?.getReferences() || []);
    });
    this.app.post('/api/image-search/reference', async (req, res) => {
      try {
        const { url, label } = req.body;
        if (!url) return res.status(400).json({ error: 'url required' });
        const id = `ref-${Date.now()}`;
        const result = await this.modules.imageSearch.addReference(id, url, label || '');
        res.json({ ok: true, ...result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    this.app.delete('/api/image-search/reference/:id', (req, res) => {
      this.modules.imageSearch?.removeReference(req.params.id);
      res.json({ ok: true });
    });
    this.app.post('/api/image-search/compare', async (req, res) => {
      try {
        const { itemPhotoUrl } = req.body;
        if (!itemPhotoUrl) return res.status(400).json({ error: 'itemPhotoUrl required' });
        const result = await this.modules.imageSearch.compareItem({ photo: itemPhotoUrl });
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    this.app.post('/api/image-search/threshold', (req, res) => {
      const { threshold } = req.body;
      if (this.modules.imageSearch && typeof threshold === 'number') {
        this.modules.imageSearch.threshold = Math.max(0.1, Math.min(1.0, threshold));
      }
      res.json({ ok: true, threshold: this.modules.imageSearch?.threshold });
    });

    // ── CRM Inventory ──
    this.app.get('/api/crm/inventory', (req, res) => {
      const filters = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.brand) filters.brand = req.query.brand;
      if (req.query.channel) filters.channel = req.query.channel;
      res.json(this.modules.crm?.getAll(filters) || []);
    });
    this.app.get('/api/crm/inventory/:id', (req, res) => {
      const item = this.modules.crm?.getById(parseInt(req.params.id));
      item ? res.json(item) : res.status(404).json({ error: 'not found' });
    });
    this.app.patch('/api/crm/inventory/:id/status', (req, res) => {
      try {
        const item = this.modules.crm.updateStatus(parseInt(req.params.id), req.body.status, req.body.note);
        this.broadcast('crm:updated', item);
        res.json({ ok: true, item });
      } catch (e) { res.status(400).json({ error: e.message }); }
    });
    this.app.patch('/api/crm/inventory/:id/price', (req, res) => {
      try {
        const item = this.modules.crm.updatePrice(parseInt(req.params.id), req.body.price, req.body.reason || 'manual');
        this.broadcast('crm:updated', item);
        res.json({ ok: true, item });
      } catch (e) { res.status(400).json({ error: e.message }); }
    });
    this.app.post('/api/crm/inventory/:id/sold', (req, res) => {
      try {
        const item = this.modules.crm.markSold(parseInt(req.params.id), req.body.price, req.body.channel);
        this.broadcast('crm:updated', item);
        res.json({ ok: true, item });
      } catch (e) { res.status(400).json({ error: e.message }); }
    });
    this.app.post('/api/crm/inventory', (req, res) => {
      try {
        const item = this.modules.crm.addManual(req.body);
        this.broadcast('crm:new', item);
        res.json({ ok: true, item });
      } catch (e) { res.status(400).json({ error: e.message }); }
    });
    this.app.delete('/api/crm/inventory/:id', (req, res) => {
      const ok = this.modules.crm?.delete(parseInt(req.params.id));
      res.json({ ok });
    });
    this.app.get('/api/crm/stats', (req, res) => {
      res.json(this.modules.crm?.getStats() || {});
    });
    this.app.get('/api/crm/relance', (req, res) => {
      const items = this.modules.crm?.getItemsToRelance(7) || [];
      res.json(items);
    });
    this.app.get('/api/crm/pricing/:id', (req, res) => {
      const item = this.modules.crm?.getById(parseInt(req.params.id));
      if (!item) return res.status(404).json({ error: 'not found' });
      const pricing = this.modules.autoPricing?.calculate(item);
      res.json(pricing || {});
    });

    // Favorites (stored server-side in memory)
    if (!this.favorites) this.favorites = new Set();
    this.app.get('/api/favorites', (req, res) => {
      const favItems = this.recentItems.filter(it => this.favorites.has(it.id));
      res.json(favItems);
    });
    this.app.post('/api/favorites/:id', (req, res) => {
      this.favorites.add(parseInt(req.params.id));
      res.json({ ok: true });
    });
    this.app.delete('/api/favorites/:id', (req, res) => {
      this.favorites.delete(parseInt(req.params.id));
      res.json({ ok: true });
    });

    // Autobuy credentials
    this.app.post('/api/autobuy/credentials', (req, res) => {
      const { email, password } = req.body;
      if (!email || !password) return res.json({ ok: false, error: 'Email et mot de passe requis' });
      // Store in config (runtime only, not written to disk for security)
      const sniper = this.modules.sniper;
      if (sniper?.fullConfig) {
        sniper.fullConfig.vinted = { email, password };
      }
      log.info(`Vinted credentials saved for ${email}`);
      res.json({ ok: true });
    });

    // Autobuy config update
    this.app.post('/api/autobuy/config', (req, res) => {
      const buyer = this.modules.autoBuyer;
      if (!buyer) return res.json({ ok: false, error: 'autobuy not ready' });
      const updates = req.body;
      if (updates.enabled !== undefined) buyer.config.enabled = updates.enabled;
      if (updates.dryRun !== undefined) buyer.config.dryRun = updates.dryRun;
      if (updates.mode !== undefined) buyer.config.mode = updates.mode;
      if (updates.maxDailyPurchases !== undefined) buyer.config.maxDailyPurchases = updates.maxDailyPurchases;
      if (updates.maxDailySpend !== undefined) buyer.config.maxDailySpend = updates.maxDailySpend;
      if (updates.cooldownBetweenBuysMs !== undefined) buyer.config.cooldownBetweenBuysMs = updates.cooldownBetweenBuysMs;
      log.info(`Autobuy config updated: ${JSON.stringify(updates)}`);
      res.json({ ok: true, config: buyer.config });
    });

    // Autobuy status (for populating UI)
    this.app.get('/api/autobuy/status', (req, res) => {
      const buyer = this.modules.autoBuyer;
      const sniper = this.modules.sniper;
      res.json({
        enabled: buyer?.config?.enabled || false,
        dryRun: buyer?.config?.dryRun ?? true,
        mode: buyer?.config?.mode || 'instant',
        maxDailyPurchases: buyer?.config?.maxDailyPurchases || 5,
        maxDailySpend: buyer?.config?.maxDailySpend || 200,
        cooldownSec: Math.round((buyer?.config?.cooldownBetweenBuysMs || 60000) / 1000),
        hasCredentials: !!(sniper?.fullConfig?.vinted?.email),
        stats: buyer?.getStats() || {},
      });
    });

    // Test notification
    this.app.post('/api/test-notification', async (req, res) => {
      await this.modules.notifier?.notify('newItem', {
        title: 'Test Notification',
        item: { title: 'Test Item', price: 42, brand: 'Test', url: 'https://vinted.fr' },
      });
      res.json({ ok: true });
    });

    // ── Test session (startup validation from dashboard) ──
    this.app.post('/api/test-session', async (req, res) => {
      const sniper = this.modules.sniper;
      if (!sniper) return res.json({ ok: false, error: 'sniper not ready' });
      const country = req.body?.country || null;
      const result = await sniper.testSession(country);
      res.json(result);
    });

    // ── Per-country stats ──
    this.app.get('/api/country-stats', (req, res) => {
      res.json(this.modules.sniper?.countryStats || {});
    });

    // ── Deal scorer: configurable thresholds ──
    this.app.get('/api/deals/thresholds', (req, res) => {
      res.json(this.modules.dealScorer?.getThresholds() || {});
    });
    this.app.post('/api/deals/thresholds', (req, res) => {
      const scorer = this.modules.dealScorer;
      if (!scorer) return res.json({ ok: false, error: 'deal scorer not ready' });
      scorer.setThresholds(req.body);
      res.json({ ok: true, thresholds: scorer.getThresholds() });
    });
    this.app.post('/api/deals/thresholds/reset', (req, res) => {
      const scorer = this.modules.dealScorer;
      if (!scorer) return res.json({ ok: false, error: 'deal scorer not ready' });
      scorer.resetThresholds();
      res.json({ ok: true, thresholds: scorer.getThresholds() });
    });

    // ── Deal scorer: brand+size market data ──
    this.app.get('/api/deals/brand-size/:brand/:size', (req, res) => {
      const data = this.modules.dealScorer?.getBrandSizeData(req.params.brand, req.params.size);
      res.json(data || null);
    });

    // ── Export: trigger export from dashboard with optional filters ──
    // ── Listing Generator ──
    this.app.post('/api/listing/generate', async (req, res) => {
      try {
        const { ListingGenerator } = await import('../crm/listing-generator.js');
        const gen = new ListingGenerator();
        const { input, condition, size, price, gender, extras } = req.body;
        if (!input) return res.json({ ok: false, error: 'input required (ex: "jogging nike gris")' });
        const result = gen.generate(input, { condition, size, price: price ? +price : undefined, gender, extras });
        res.json({ ok: true, ...result });
      } catch (error) {
        res.json({ ok: false, error: error.message });
      }
    });

    this.app.post('/api/export', (req, res) => {
      const exporter = this.modules.sniper?.exporter;
      if (!exporter) return res.json({ ok: false, error: 'exporter not ready' });

      const filters = req.body || {};
      // filters: { format, dateFrom, dateTo, brand, priceMin, priceMax, minDealScore }
      const format = filters.format || exporter.config.format || 'json';
      const path = exporter.exportFiltered(filters, format);
      res.json({ ok: !!path, path, itemsExported: exporter.lastExportCount || 0 });
    });
    this.app.get('/api/export/stats', (req, res) => {
      const exporter = this.modules.sniper?.exporter;
      res.json(exporter?.getStats() || {});
    });

    // SPA fallback
    this.app.get('*', (req, res) => {
      res.sendFile(resolve(__dirname, 'public', 'index.html'));
    });
  }

  setupSocket() {
    this.io.on('connection', (socket) => {
      log.info('Dashboard client connected');
      // Send current state on connect
      socket.emit('stats', this.getFullStats());
      // Send item backlog so new connections see history
      socket.emit('items:backlog', this.recentItems);

      socket.on('disconnect', () => {
        log.debug('Dashboard client disconnected');
      });
    });
  }

  /**
   * Broadcast event to all connected clients.
   */
  broadcast(event, data) {
    this.io.emit(event, data);
  }

  /**
   * Push a new item to connected dashboards.
   */
  pushNewItem(item) {
    this.recentItems.unshift(item);
    if (this.recentItems.length > this.maxRecentItems) this.recentItems.pop();
    this.broadcast('item:new', item);
  }

  /**
   * Push stats update.
   */
  pushStats() {
    this.broadcast('stats', this.getFullStats());
  }

  getFullStats() {
    return {
      sessions: this.modules.sessionPool?.getStats() || {},
      autobuy: this.modules.autoBuyer?.getStats() || {},
      monitor: this.modules.monitor?.getStats() || {},
      notifications: this.modules.notifier?.getStats() || {},
      proxies: this.modules.proxyManager?.getStats() || {},
      deals: this.modules.dealScorer?.getStats() || {},
      arbitrage: this.modules.arbitrage?.getStats() || {},
      queries: this.modules.sniper?.queries?.length || 0,
      totalItems: this.recentItems.length,
      countries: this.modules.sniper?.fullConfig?.countries || [],
      countryStats: this.modules.sniper?.countryStats || {},
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };
  }

  async start() {
    const tryListen = (port) => new Promise((resolve, reject) => {
      const onError = (err) => {
        this.server.removeListener('error', onError);
        reject(err);
      };
      this.server.on('error', onError);
      this.server.listen(port, this.config.host, () => {
        this.server.removeListener('error', onError);
        resolve(port);
      });
    });

    let port = this.config.port;
    try {
      port = await tryListen(port);
    } catch (err) {
      if (err.code === 'EADDRINUSE') {
        log.warn(`Port ${port} in use, trying ${port + 1}...`);
        try {
          port = await tryListen(port + 1);
        } catch {
          log.error('Could not start dashboard on any port');
          return null;
        }
      } else {
        log.error(`Dashboard error: ${err.message}`);
        return null;
      }
    }

    const url = `http://${this.config.host}:${port}`;
    log.info(`Dashboard running at ${url}`);
    if (this.config.host !== 'localhost' && this.config.host !== '127.0.0.1') {
      log.warn('WARNING: Dashboard is exposed to the network. It has no authentication. Set host to "localhost" in config for security.');
    }
    if (this.config.openOnStart) import('open').then(m => m.default(url)).catch(() => {});
    return url;
  }

  stop() {
    return new Promise((resolve) => {
      this.server.close(() => resolve());
      // Force resolve after 3s if server.close() hangs
      setTimeout(resolve, 3000);
    });
  }
}
