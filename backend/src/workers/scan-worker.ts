import pino from 'pino';
import { config } from '../config.js';
import { getActiveFilters, updateLastScanned } from '../services/filter.service.js';
import { saveNewArticles, markAsPepite } from '../services/article.service.js';
import { publishNewArticle } from '../services/notification.service.js';
import { checkIsPepite } from '../services/price.service.js';
import { searchVinted } from '../scraper/vinted-client.js';
import { initProxies, closeProxies, getProxyCount } from '../scraper/proxy-manager.js';
import { startCookieRenewal, stopCookieRenewal } from '../scraper/cookie-manager.js';
import { buildSearchParams } from '../scraper/catalog-params.js';
import { getNextProxy } from '../scraper/proxy-manager.js';
import type { DbFilter } from '../types/database.js';

const logger = pino({ name: 'scan-worker' });

interface FilterTimer {
  filterId: string;
  timer: ReturnType<typeof setTimeout> | null;
}

const activeTimers: FilterTimer[] = [];
let isRunning = false;
let refreshInterval: ReturnType<typeof setInterval> | null = null;

export function startScanWorker(): void {
  if (isRunning) return;
  isRunning = true;

  // Initialize proxies
  initProxies();

  // Start cookie renewal
  startCookieRenewal(() => {
    const proxies: (ReturnType<typeof getNextProxy>)[] = [];
    const count = getProxyCount();
    if (count === 0) {
      proxies.push(null); // direct connection
    } else {
      for (let i = 0; i < count; i++) {
        proxies.push(getNextProxy());
      }
    }
    return proxies;
  });

  // Initial load and start scanning
  loadAndStartFilters();

  // Periodically refresh active filters (every 30s)
  refreshInterval = setInterval(() => {
    if (isRunning) {
      loadAndStartFilters();
    }
  }, 30_000);

  logger.info('Scan worker started');
}

export function stopScanWorker(): void {
  isRunning = false;

  // Clear all timers
  for (const timer of activeTimers) {
    if (timer.timer) {
      clearTimeout(timer.timer);
    }
  }
  activeTimers.length = 0;

  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }

  stopCookieRenewal();
  closeProxies();

  logger.info('Scan worker stopped');
}

async function loadAndStartFilters(): Promise<void> {
  try {
    const filters = await getActiveFilters();
    const existingIds = new Set(activeTimers.map(t => t.filterId));
    const newFilterIds = new Set(filters.map(f => f.id));

    // Stop timers for removed/deactivated filters
    for (let i = activeTimers.length - 1; i >= 0; i--) {
      const timer = activeTimers[i]!;
      if (!newFilterIds.has(timer.filterId)) {
        if (timer.timer) clearTimeout(timer.timer);
        activeTimers.splice(i, 1);
        logger.debug({ filterId: timer.filterId }, 'Stopped scanning deactivated filter');
      }
    }

    // Start scanning new filters with staggered delays
    const newFilters = filters.filter(f => !existingIds.has(f.id));
    const totalFilters = filters.length;

    for (let i = 0; i < newFilters.length; i++) {
      const filter = newFilters[i]!;
      const staggerDelay = totalFilters > 1
        ? (i * (config.DEFAULT_SCAN_INTERVAL * 1000) / totalFilters)
        : 0;

      const timerEntry: FilterTimer = { filterId: filter.id, timer: null };
      activeTimers.push(timerEntry);

      timerEntry.timer = setTimeout(() => {
        scheduleFilterScan(filter, timerEntry);
      }, staggerDelay);

      logger.debug({ filterId: filter.id, delay: staggerDelay }, 'Scheduled new filter scan');
    }

    logger.debug({ total: filters.length, new: newFilters.length }, 'Filters loaded');
  } catch (err) {
    logger.error({ err }, 'Failed to load filters');
  }
}

function scheduleFilterScan(filter: DbFilter, timerEntry: FilterTimer): void {
  if (!isRunning) return;

  scanFilter(filter).then(() => {
    if (isRunning) {
      const interval = (filter.scan_interval_seconds || config.DEFAULT_SCAN_INTERVAL) * 1000;
      timerEntry.timer = setTimeout(() => {
        scheduleFilterScan(filter, timerEntry);
      }, interval);
    }
  }).catch((err) => {
    logger.error({ err, filterId: filter.id }, 'Scan error');
    if (isRunning) {
      // Retry with backoff
      timerEntry.timer = setTimeout(() => {
        scheduleFilterScan(filter, timerEntry);
      }, 10_000);
    }
  });
}

async function scanFilter(filter: DbFilter): Promise<void> {
  const params = buildSearchParams(filter);

  logger.debug({ filterId: filter.id, filterName: filter.name }, 'Scanning filter');

  const response = await searchVinted(params);

  if (response.items.length === 0) {
    await updateLastScanned(filter.id);
    return;
  }

  // Save new articles (dedup handled inside)
  const newArticles = await saveNewArticles(filter.id, filter.user_id, response.items);

  if (newArticles.length === 0) {
    await updateLastScanned(filter.id);
    return;
  }

  logger.info({ filterId: filter.id, newCount: newArticles.length }, 'New articles detected');

  // Check pepites and publish notifications
  for (const article of newArticles) {
    if (filter.pepite_enabled) {
      const threshold = parseFloat(filter.pepite_threshold);
      const originalItem = response.items.find(i => String(i.id) === article.vinted_id);

      if (originalItem) {
        const pepiteCheck = await checkIsPepite(originalItem, threshold);
        if (pepiteCheck.isPepite && pepiteCheck.marketPrice !== null && pepiteCheck.diffPct !== null) {
          await markAsPepite(article.id, pepiteCheck.marketPrice, pepiteCheck.diffPct);
          article.is_pepite = true;
          article.estimated_market_price = String(pepiteCheck.marketPrice);
          article.price_difference_pct = String(pepiteCheck.diffPct);
        }
      }
    }

    await publishNewArticle(article, filter);
  }

  await updateLastScanned(filter.id);
}
