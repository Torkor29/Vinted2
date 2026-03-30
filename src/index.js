import { config } from './config.js';
import { SessionPool } from './session-manager/pool.js';
import { VintedClient } from './scraper/client.js';
import { VintedSearch } from './query/search.js';
import { AutoBuyer } from './autobuy/buyer.js';
import { Notifier } from './notifications/notifier.js';
import { VintedMonitor } from './monitoring/monitor.js';
import { ProxyManager } from './proxy/manager.js';
import { Dashboard } from './dashboard/server.js';
import { DataExporter } from './utils/exporter.js';
import { DealScorer } from './intelligence/deal-scorer.js';
import { ArbitrageDetector } from './intelligence/arbitrage.js';
import { ImageSearch } from './intelligence/image-search.js';
import { CRMInventory } from './crm/inventory.js';
import { AutoPricing } from './crm/pricing.js';
import { AutoRelance } from './crm/auto-relance.js';
import { TelegramBot } from './telegram/bot.js';
import { TurboPoller } from './scraper/turbo-poller.js';
import { createLogger } from './utils/logger.js';
import { sleep } from './utils/retry.js';
import { readFileSync, existsSync } from 'fs';

const log = createLogger('main');

/**
 * VintedSniper v2 - Full orchestrator.
 *
 * Wires together all modules:
 * - Session pool (multi-country)
 * - Proxy manager
 * - Scraper client
 * - Search engine
 * - AutoBuyer (rule-based)
 * - Monitor (sellers, watchlist, price drops)
 * - Notifier (7 channels)
 * - Dashboard (real-time web UI)
 * - Exporter (CSV/JSON)
 *
 * Lifecycle:
 * 1. Initialize proxies → sessions → dashboard
 * 2. Start poll loop + monitor loop
 * 3. Push updates to dashboard via Socket.IO
 * 4. Graceful shutdown on SIGINT/SIGTERM
 */
class VintedSniper {
  constructor() {
    // Core
    this.proxyManager = new ProxyManager(config);
    this.sessionPool = new SessionPool(config);
    this.client = new VintedClient(this.sessionPool, this.proxyManager);
    this.search = new VintedSearch(this.client);
    this.notifier = new Notifier(config);
    this.autoBuyer = new AutoBuyer(config, this.client, this.sessionPool, this.notifier);
    this.monitor = new VintedMonitor(config, this.client, this.notifier);
    this.exporter = new DataExporter(config);
    this.dealScorer = new DealScorer();
    this.arbitrage = new ArbitrageDetector();
    this.imageSearch = new ImageSearch(config.imageSearch || {});
    this.crm = new CRMInventory(config.crm || {});
    this.autoPricing = new AutoPricing(config.crm || {});
    this.autoRelance = null; // initialized after notifier + telegram
    this.dashboard = new Dashboard(config);
    this.telegramBot = null; // initialized in start() if enabled

    // State
    this.running = false;     // scraping NOT running at startup
    this.sessionsReady = false;
    this.queries = [];
    this.totalNewItems = 0;
    this.pollCycles = 0;
    this.fullConfig = config; // exposed for dashboard

    // Per-country stats tracking (items found, errors, last poll time)
    this.countryStats = {};
    for (const c of config.countries) {
      this.countryStats[c] = { items: 0, errors: 0, lastPoll: null };
    }

    // Fetch full description for items above this deal score threshold
    this.fetchDescriptionThreshold = 70;
  }

  /**
   * Start the application (dashboard + sessions).
   * The scraping loop does NOT start — user must click "Start" in dashboard.
   */
  async start() {
    log.info('');
    log.info('╔══════════════════════════════════════════╗');
    log.info('║       ⚡ Vinted Sniper v2.0              ║');
    log.info('╚══════════════════════════════════════════╝');
    log.info('');
    log.info(`Countries: ${config.countries.join(', ')}`);
    log.info(`Poll interval: ${config.scraper.pollIntervalMs}ms`);

    // Load search queries from config (user can add more from dashboard)
    this.queries = this.loadQueries();
    log.info(`Queries from config: ${this.queries.length}`);

    // ── Step 1: Initialize proxies ──
    if (config.proxy.enabled) {
      log.info('Initializing proxies...');
      await this.proxyManager.initialize();
    }

    // ── Step 2: Initialize sessions ──
    log.info('Initializing session pools...');
    await this.sessionPool.initializeAll(config.countries);
    this.sessionPool.startHealthCheck();
    this.sessionsReady = true;

    // ── Step 2b: Validate sessions with a test API call ──
    log.info('Validating sessions...');
    const validation = await this.validateSessions();
    if (validation.allFailed) {
      log.error('');
      log.error('=== ALL SESSIONS FAILED VALIDATION ===');
      log.error('No session could successfully call the Vinted API.');
      log.error('');
      log.error('Possible solutions:');
      log.error('  1. Check your internet connection');
      log.error('  2. Vinted may have changed their anti-bot protection');
      log.error('  3. Try enabling proxies in config.json');
      log.error('  4. Try increasing session.creationStaggerMs');
      log.error('  5. Run "node src/cookie-factory/cli.js" to test cookie creation');
      log.error('');
      log.error('The dashboard will still start so you can debug from the UI.');
      log.error('');
    } else {
      log.info(`Session validation: ${validation.passed}/${validation.total} countries OK`);
    }

    // ── Step 3: Start dashboard ──
    if (config.dashboard.enabled) {
      this.dashboard.setModules({
        sessionPool: this.sessionPool,
        search: this.search,
        autoBuyer: this.autoBuyer,
        notifier: this.notifier,
        monitor: this.monitor,
        proxyManager: this.proxyManager,
        dealScorer: this.dealScorer,
        arbitrage: this.arbitrage,
        imageSearch: this.imageSearch,
        crm: this.crm,
        autoPricing: this.autoPricing,
        sniper: this,
      });
      await this.dashboard.start();
    }

    this.exporter.startAutoExport();

    // ── Step 4: Start Telegram bot (if configured) ──
    if (config.notifications.telegram.enabled && config.notifications.telegram.botToken) {
      try {
        this.telegramBot = new TelegramBot(config);
        this.telegramBot.setSniper(this);
        await this.telegramBot.start();
        log.info('Telegram bot started — topics will be created in your group');
      } catch (error) {
        log.warn(`Telegram bot failed to start: ${error.message}`);
      }
    }

    // ── Step 5: Start auto-relance (CRM) ──
    this.autoRelance = new AutoRelance(this.crm, this.notifier, this.telegramBot, config.crm?.relance || {});
    this.autoRelance.start();
    log.info(`CRM: ${this.crm.items.size} articles en stock`);

    log.info('');
    log.info('⏸️  Bot en attente — configure tes recherches puis clique "Lancer le bot" dans le dashboard');
    log.info('');

    // Keep process alive (dashboard is running, bot waits for start command)
    await new Promise(() => {}); // never resolves — process stays alive
  }

  /**
   * Start the scraping loop (called from dashboard "Start" button).
   * Uses this.queries which are managed live by the dashboard (add/remove).
   */
  startBot() {
    if (this.running) {
      log.warn('Bot already running');
      return;
    }

    if (this.queries.length === 0) {
      log.warn('Cannot start: no queries configured. Add filters from the dashboard first.');
      return;
    }

    log.info('');
    log.info(`🚀 Bot démarré — ${this.queries.length} recherche(s) active(s)`);
    this.queries.forEach((q, i) => {
      const parts = [];
      if (q.text) parts.push(`"${q.text}"`);
      if (q._labels?.gender) parts.push(q._labels.gender);
      if (q._labels?.brands?.length) parts.push(q._labels.brands.join(', '));
      if (q.priceTo) parts.push(`max ${q.priceTo}€`);
      log.info(`  [${i + 1}] ${parts.join(' · ') || 'filtre custom'}`);
    });
    log.info('');

    this.running = true;

    // Start monitoring if configured (guard against duplicate starts)
    if (config.monitoring.sellers.length > 0 || config.monitoring.watchlist.length > 0) {
      if (!this.monitorPromise) {
        this.monitorPromise = this.monitor.start();
      }
    }

    // Start poll loop (non-blocking)
    this.pollLoop().catch(err => log.error(`Poll loop error: ${err.message}`));

    // Notify dashboard
    this.dashboard.broadcast('bot:status', { running: true, queries: this.queries.length });
  }

  /**
   * Stop the scraping loop (called from dashboard "Stop" button).
   */
  async stopBot() {
    log.info('⏸️  Bot arrêté');
    this.running = false;
    this.monitor.stop();
    // Wait for the monitor loop to finish before allowing restart
    if (this.monitorPromise) {
      await this.monitorPromise.catch(() => {});
      this.monitorPromise = null;
    }
    this.dashboard.broadcast('bot:status', { running: false });
  }

  /**
   * Main poll loop.
   * Uses TurboPoller (staggered independent workers) when enabled,
   * falls back to standard cycle-based polling otherwise.
   */
  async pollLoop() {
    // Build all (country, query) pairs
    const tasks = [];
    for (const country of config.countries) {
      for (const query of this.queries) {
        tasks.push({ country, query });
      }
    }

    // ═══════════════════════════════════════════
    //  TURBO MODE: staggered independent workers
    // ═══════════════════════════════════════════
    if (config.scraper.turbo?.enabled) {
      const turboConf = config.scraper.turbo;
      this.turboPoller = new TurboPoller(this.search, {
        concurrency: config.scraper.concurrentQueries || 15,
        workerDelayMs: turboConf.workerDelayMs || 200,
        staggerMs: turboConf.staggerMs || 50,
        onNewItems: async (newItems, country, query) => {
          // Process each item through the same pipeline
          await this._processNewItems(newItems, country);
        },
      });

      this.turboPoller.start(tasks);

      // Stats push loop (independent from polling)
      while (this.running) {
        if (config.dashboard.enabled) {
          this.dashboard.pushStats();
          // Also push turbo stats
          this.dashboard.broadcast('turbo:stats', this.turboPoller.getStats());
        }
        this.pollCycles++;
        await sleep(2000);
      }

      await this.turboPoller.stop();
      return;
    }

    // ═══════════════════════════════════════════
    //  STANDARD MODE: cycle-based polling (fallback)
    // ═══════════════════════════════════════════
    while (this.running) {
      const cycleStart = Date.now();
      this.pollCycles++;

      const concurrency = config.scraper.concurrentQueries || 3;
      const chunks = chunkArray(tasks, concurrency);

      for (const chunk of chunks) {
        if (!this.running) break;
        await Promise.allSettled(
          chunk.map(({ country, query }) => this.processQuery(country, query))
        );
      }

      if (config.dashboard.enabled) {
        this.dashboard.pushStats();
      }

      const elapsed = Date.now() - cycleStart;
      const waitTime = Math.max(500, config.scraper.pollIntervalMs - elapsed);

      if (waitTime > 0 && this.running) {
        await sleep(waitTime);
      }
    }
  }

  /**
   * Process new items through the full pipeline.
   * Shared by both TurboPoller and standard mode.
   */
  async _processNewItems(newItems, country) {
    if (!this.countryStats[country]) {
      this.countryStats[country] = { items: 0, errors: 0, lastPoll: null };
    }
    this.countryStats[country].lastPoll = new Date().toISOString();

    // 1. Score + track
    for (const item of newItems) {
      this.totalNewItems++;
      this.countryStats[country].items++;
      this.dealScorer.scoreItem(item);
      if (config.countries.length > 1) this.arbitrage.checkItem(item, country);
      this.exporter.addItem(item);
    }

    // 1b. Visual matching (non-blocking for speed)
    if (this.imageSearch.references.size > 0) {
      for (const item of newItems) {
        const match = await this.imageSearch.compareItem(item).catch(() => null);
        if (match?.matches) {
          item.visualMatch = match.bestMatch;
          item.visualSimilarity = match.bestMatch.similarity;
        }
      }
    }

    // 2. Dashboard push (instant)
    if (config.dashboard.enabled) {
      for (const item of newItems) this.dashboard.pushNewItem(item);
    }

    // 3. Autobuy FIRST (time-sensitive)
    if (config.autobuy.enabled) {
      for (const item of newItems) {
        const result = await this.autoBuyer.tryBuy(country, item);
        if (result.purchased) {
          log.info(`AUTO-PURCHASED: "${item.title}" for ${item.price}EUR`);
          const crmEntry = this.crm.addPurchase(item, result.record);
          if (this.telegramBot) this.telegramBot.notifyAutobuy(item, result.record).catch(() => {});
          if (config.dashboard.enabled) this.dashboard.broadcast('crm:new', crmEntry);
        } else if (result.dryRun) {
          const crmEntry = this.crm.addPurchase(item, { ...result, dryRun: true, rule: result.matchedRule });
          if (this.telegramBot) this.telegramBot.notifyAutobuy(item, { dryRun: true, rule: result.matchedRule }).catch(() => {});
          if (config.dashboard.enabled) this.dashboard.broadcast('crm:new', crmEntry);
        }
      }
    }

    // 4. Notifications (fire-and-forget)
    const notifPromises = newItems.map(item => {
      const promises = [];
      if (this.telegramBot) {
        if (item.dealScore >= 70) {
          promises.push(this.telegramBot.notifyDeal(item).catch(() => {}));
        } else {
          promises.push(this.telegramBot.notifyNewItem(item).catch(() => {}));
        }
      }
      promises.push(this.notifier.notifyNewItem(item).catch(() => {}));
      return Promise.allSettled(promises);
    });
    Promise.allSettled(notifPromises).catch(() => {});

    // 5. Enrich top deals (background)
    for (const item of newItems) {
      if (item.dealScore >= this.fetchDescriptionThreshold && !item.description) {
        this.search.enrichWithDescription(country, item).catch(() => {});
      }
    }
  }

  /**
   * Process a single search query (used by standard mode).
   * Delegates to shared _processNewItems pipeline.
   */
  async processQuery(country, query) {
    if (!this.countryStats[country]) {
      this.countryStats[country] = { items: 0, errors: 0, lastPoll: null };
    }

    try {
      const newItems = await this.search.pollNewItems(country, query);
      if (newItems.length > 0) {
        await this._processNewItems(newItems, country);
      }
    } catch (error) {
      this.countryStats[country].errors++;
      log.error(`Query "${query.text}" failed: ${error.message}`);
      await this.notifier.notifyError(`Query failed: ${query.text}`, {
        query: query.text,
        country,
        error: error.message,
      });
    }
  }

  /**
   * Load queries from config.json + CLI args.
   */
  loadQueries() {
    const queries = [];

    // From config
    if (config.queries?.length > 0) {
      queries.push(...config.queries);
    }

    // From CLI args
    const args = process.argv.slice(2);
    let i = 0;
    while (i < args.length) {
      if (args[i] === '--query' || args[i] === '-q') {
        const query = { text: args[++i] };
        while (i + 1 < args.length && args[i + 1]?.startsWith('--')) {
          const opt = args[++i];
          if (opt === '--max-price') query.priceTo = Number(args[++i]);
          else if (opt === '--min-price') query.priceFrom = Number(args[++i]);
          else if (opt === '--brand') { query.brandIds = query.brandIds || []; query.brandIds.push(args[++i]); }
          else if (opt === '--size') { query.sizeIds = query.sizeIds || []; query.sizeIds.push(args[++i]); }
          else if (opt === '--category') { query.catalogIds = query.catalogIds || []; query.catalogIds.push(args[++i]); }
          else break;
        }
        queries.push(query);
      } else if (args[i] === '--country') {
        config.countries = [args[++i]];
      }
      i++;
    }

    return queries;
  }

  /**
   * Validate sessions by making a test API call for each country.
   * Returns { total, passed, failed, allFailed, results: { country: bool } }
   */
  async validateSessions() {
    const results = {};
    let passed = 0;

    for (const country of config.countries) {
      try {
        const testResult = await this.search.search(country, {
          text: 'test',
          perPage: 1,
          order: 'newest_first',
        });
        const ok = !testResult.error && testResult.items.length > 0;
        results[country] = ok;
        if (ok) passed++;
        else log.warn(`Session validation failed for ${country}: no results returned`);
      } catch (err) {
        results[country] = false;
        log.warn(`Session validation failed for ${country}: ${err.message}`);
      }
    }

    return {
      total: config.countries.length,
      passed,
      failed: config.countries.length - passed,
      allFailed: passed === 0,
      results,
    };
  }

  /**
   * Test a single country's session (callable from dashboard).
   * Returns { ok, country, items, error }
   */
  async testSession(country) {
    try {
      const result = await this.search.search(country || config.countries[0], {
        text: 'nike',
        perPage: 5,
        order: 'newest_first',
      });
      return {
        ok: !result.error && result.items.length > 0,
        country: country || config.countries[0],
        items: result.items.length,
        error: result.error ? 'Empty results - session may be blocked' : null,
      };
    } catch (err) {
      return { ok: false, country: country || config.countries[0], items: 0, error: err.message };
    }
  }

  printStats() {
    log.info('');
    log.info('═══ Stats ═══');
    log.info(`Uptime: ${Math.round(process.uptime())}s | Cycles: ${this.pollCycles}`);
    log.info(`New items: ${this.totalNewItems} | Seen: ${this.search.seenItems.size}`);
    log.info(`Sessions: ${JSON.stringify(this.sessionPool.getStats())}`);
    log.info(`Autobuy: ${JSON.stringify(this.autoBuyer.getStats())}`);
    log.info(`Deals: ${JSON.stringify(this.dealScorer.getStats())}`);
    log.info(`Arbitrage: ${JSON.stringify(this.arbitrage.getStats())}`);
    log.info(`Monitor: ${JSON.stringify(this.monitor.getStats())}`);
    log.info(`Notifications: ${JSON.stringify(this.notifier.getStats())}`);
    if (config.proxy.enabled) log.info(`Proxies: ${JSON.stringify(this.proxyManager.getStats())}`);
    log.info(`Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    log.info('');
  }

  async shutdown() {
    log.info('Shutting down...');
    this.running = false;
    this.monitor.stop();
    if (this.monitorPromise) {
      await this.monitorPromise.catch(() => {});
    }
    this.search.destroy();
    this.exporter.stop();
    if (this.autoRelance) this.autoRelance.stop();
    this.crm.destroy(); // Final save to disk
    if (this.telegramBot) await this.telegramBot.stop().catch(() => {});
    await this.dashboard.stop();
    await this.sessionPool.shutdown();

    // Final export
    const path = this.exporter.exportAll();
    if (path) log.info(`Final export: ${path}`);

    this.printStats();
    log.info('Shutdown complete');
  }
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ── Entry Point ──
const sniper = new VintedSniper();

process.on('SIGINT', async () => { await sniper.shutdown(); process.exit(0); });
process.on('SIGTERM', async () => { await sniper.shutdown(); process.exit(0); });

if (process.platform !== 'win32') {
  process.on('SIGUSR1', () => sniper.printStats());
}

// Stats every 5 minutes
setInterval(() => sniper.printStats(), 5 * 60_000);

sniper.start().catch((error) => {
  log.error(`Fatal: ${error.message}`);
  log.error(error.stack);
  process.exit(1);
});
