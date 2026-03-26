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
import { TelegramBot } from './telegram/bot.js';
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
   */
  async pollLoop() {
    while (this.running) {
      const cycleStart = Date.now();
      this.pollCycles++;

      // Process queries across all countries
      for (const country of config.countries) {
        // Run queries concurrently (limited by config.scraper.concurrentQueries)
        const chunks = chunkArray(this.queries, config.scraper.concurrentQueries);

        for (const chunk of chunks) {
          if (!this.running) break;

          const promises = chunk.map(query => this.processQuery(country, query));
          await Promise.allSettled(promises);
        }
      }

      // Push stats to dashboard
      if (config.dashboard.enabled) {
        this.dashboard.pushStats();
      }

      // Wait for next cycle
      const elapsed = Date.now() - cycleStart;
      const waitTime = Math.max(0, config.scraper.pollIntervalMs - elapsed);

      if (waitTime > 0 && this.running) {
        await sleep(waitTime);
      }
    }
  }

  /**
   * Process a single search query.
   */
  async processQuery(country, query) {
    // Ensure per-country stats bucket exists
    if (!this.countryStats[country]) {
      this.countryStats[country] = { items: 0, errors: 0, lastPoll: null };
    }

    try {
      const newItems = await this.search.pollNewItems(country, query);
      this.countryStats[country].lastPoll = new Date().toISOString();

      for (const item of newItems) {
        this.totalNewItems++;
        this.countryStats[country].items++;

        // Score deal (adds dealScore, marketMedian, dealLabel, confidence to item)
        this.dealScorer.scoreItem(item);

        // For top-scoring items, fetch full description if not already present
        if (item.dealScore >= this.fetchDescriptionThreshold && !item.description) {
          await this.search.enrichWithDescription(country, item);
        }

        // Check cross-country arbitrage (if multi-country)
        if (config.countries.length > 1) {
          const opp = this.arbitrage.checkItem(item, country);
          if (opp) {
            await this.notifier.notify('arbitrage', {
              title: `Arbitrage: ${item.title} — ${opp.profit}EUR profit (${opp.buy.country}->${opp.sell.country})`,
              item, opportunity: opp,
            });
          }
        }

        // Add to exporter
        this.exporter.addItem(item);

        // Push to dashboard
        if (config.dashboard.enabled) {
          this.dashboard.pushNewItem(item);
        }

        // Telegram: route to appropriate topic
        if (this.telegramBot) {
          if (item.dealScore >= 70) {
            await this.telegramBot.notifyDeal(item).catch(() => {});
          } else {
            await this.telegramBot.notifyNewItem(item).catch(() => {});
          }
        }

        // Notify (only items with good deal scores or all if no score yet)
        await this.notifier.notifyNewItem(item);

        // Autobuy (deal score can boost priority)
        if (config.autobuy.enabled) {
          const result = await this.autoBuyer.tryBuy(country, item);
          if (result.purchased) {
            log.info(`AUTO-PURCHASED: "${item.title}" for ${item.price}EUR (deal: ${item.dealScore})`);
            if (this.telegramBot) await this.telegramBot.notifyAutobuy(item, result.record).catch(() => {});
          } else if (result.dryRun) {
            log.info(`DRY RUN: Would buy "${item.title}" for ${item.price}EUR (deal: ${item.dealScore})`);
            if (this.telegramBot) await this.telegramBot.notifyAutobuy(item, { dryRun: true, rule: result.matchedRule }).catch(() => {});
          }
        }
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
