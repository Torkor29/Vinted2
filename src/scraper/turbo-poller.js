import { createLogger } from '../utils/logger.js';
import { sleep } from '../utils/retry.js';

const log = createLogger('turbo');

/**
 * TurboPoller v3 — Burst mode for maximum speed on single IP.
 *
 * ═══════════════════════════════════════════════════════════
 *  STRATEGY: BURST → PAUSE → BURST → PAUSE
 * ═══════════════════════════════════════════════════════════
 *
 * Vinted rate-limits datacenter IPs after ~7 requests,
 * then blocks for ~5 seconds. Instead of polling slowly
 * to avoid 429s, we EMBRACE them:
 *
 * 1. BURST: Poll all queries as fast as possible (~500ms each)
 *    → Get 6-8 polls in before rate limit hits
 *    → Each query checked 2-3 times per burst
 *
 * 2. PAUSE: When 429 detected, ALL workers pause 6 seconds
 *    → Rate limit clears in ~5s, extra 1s safety margin
 *
 * 3. RESUME: Burst again at full speed
 *
 * RESULT:
 * - ~7 polls every 7 seconds = 1 req/s average
 * - Each query checked every ~3-4 seconds
 * - Detection time: 2-4 seconds
 * - No wasted time polling slowly
 *
 * WITH PROXIES: Each proxy gets its own burst cycle
 * → 5 proxies = 5 req/s = sub-second detection
 * ═══════════════════════════════════════════════════════════
 */
export class TurboPoller {
  constructor(search, { onNewItems, concurrency = 8, workerDelayMs = 500, staggerMs = 100 } = {}) {
    this.search = search;
    this.onNewItems = onNewItems || (() => {});

    this.concurrency = concurrency;
    this.baseDelay = workerDelayMs;
    this.staggerMs = staggerMs;

    this.running = false;
    this.workers = [];
    this.stats = {
      totalPolls: 0,
      totalItems: 0,
      totalErrors: 0,
      total429s: 0,
      avgResponseMs: 0,
      startedAt: null,
      workersActive: 0,
      burstCycles: 0,
    };

    // ── Global rate limit state (shared across all workers) ──
    this._rateLimitedUntil = 0;  // Timestamp until which we're paused
    this._burstCount = 0;        // Requests since last pause
    this._consecutiveSuccess = 0;
  }

  start(tasks) {
    if (this.running) return;
    this.running = true;
    this.stats.startedAt = Date.now();

    log.info(`TurboPoller BURST mode: ${tasks.length} tasks, ${this.concurrency} max workers`);

    const workerCount = Math.min(tasks.length, this.concurrency);

    for (let i = 0; i < workerCount; i++) {
      const workerTasks = tasks.filter((_, idx) => idx % workerCount === i);
      const worker = this._createWorker(i, workerTasks);
      this.workers.push(worker);

      setTimeout(() => {
        if (this.running) worker.promise = worker.run();
      }, i * this.staggerMs);
    }

    log.info(`${workerCount} workers launched (burst mode, stagger: ${this.staggerMs}ms)`);
  }

  async stop() {
    this.running = false;
    log.info('TurboPoller stopping...');
    await Promise.allSettled(this.workers.map(w => w.promise).filter(Boolean));
    this.workers = [];
    log.info(`TurboPoller stopped. Stats: ${JSON.stringify(this.getStats())}`);
  }

  getStats() {
    const uptime = this.stats.startedAt ? Date.now() - this.stats.startedAt : 0;
    return {
      ...this.stats,
      uptimeMs: uptime,
      pollsPerMinute: uptime > 0 ? Math.round(this.stats.totalPolls / (uptime / 60000)) : 0,
      itemsPerMinute: uptime > 0 ? Math.round(this.stats.totalItems / (uptime / 60000)) : 0,
    };
  }

  /**
   * Check if we're in a global rate-limit pause.
   * If yes, wait until it clears.
   */
  async _waitForRateLimit() {
    const now = Date.now();
    if (this._rateLimitedUntil > now) {
      const waitMs = this._rateLimitedUntil - now;
      log.debug(`Burst pause: waiting ${Math.round(waitMs / 1000)}s for rate limit to clear`);
      await sleep(waitMs);
    }
  }

  /**
   * Signal a global rate limit — all workers will pause.
   */
  _triggerRateLimitPause() {
    const pauseMs = 6000 + Math.random() * 2000; // 6-8 seconds
    this._rateLimitedUntil = Date.now() + pauseMs;
    this._burstCount = 0;
    this.stats.burstCycles++;
    log.info(`BURST PAUSE: ${Math.round(pauseMs / 1000)}s cooldown (cycle #${this.stats.burstCycles})`);
  }

  _createWorker(id, tasks) {
    const worker = {
      id,
      tasks,
      polls: 0,
      items: 0,
      errors: 0,
      consecutiveErrors: 0,
      promise: null,
    };

    worker.run = async () => {
      this.stats.workersActive++;
      let taskIndex = 0;

      while (this.running) {
        // ── Wait if globally rate-limited ──
        await this._waitForRateLimit();
        if (!this.running) break;

        const task = tasks[taskIndex % tasks.length];
        taskIndex++;

        // ── Worker health: pause on sustained errors ──
        if (worker.consecutiveErrors >= 15) {
          const cooldown = 20_000 + Math.random() * 10_000;
          log.warn(`Worker${id} pausing ${Math.round(cooldown / 1000)}s (${worker.consecutiveErrors} errors)`);
          await sleep(cooldown);
          worker.consecutiveErrors = 0;
        }

        const start = Date.now();
        try {
          const newItems = await this.search.pollNewItems(task.country, task.query);
          const elapsed = Date.now() - start;

          worker.polls++;
          worker.consecutiveErrors = 0;
          this.stats.totalPolls++;
          this._burstCount++;
          this._consecutiveSuccess++;

          this.stats.avgResponseMs = Math.round(
            this.stats.avgResponseMs * 0.9 + elapsed * 0.1
          );

          if (newItems.length > 0) {
            worker.items += newItems.length;
            this.stats.totalItems += newItems.length;
            log.info(`Worker${id}: ${newItems.length} new items [${task.country}] (${elapsed}ms)`);

            try {
              await this.onNewItems(newItems, task.country, task.query);
            } catch (e) {
              log.error(`Worker${id} callback error: ${e.message}`);
            }
          }

        } catch (error) {
          worker.errors++;
          worker.consecutiveErrors++;
          this.stats.totalErrors++;
          this._consecutiveSuccess = 0;

          const is429 = error.message?.includes('429') || error.message?.includes('Rate');

          if (is429) {
            this.stats.total429s++;
            // ── Global burst pause — one 429 pauses ALL workers ──
            if (this._rateLimitedUntil < Date.now()) {
              this._triggerRateLimitPause();
            }
          } else if (worker.consecutiveErrors % 5 === 1) {
            log.warn(`Worker${id} error [${task.country}]: ${error.message}`);
          }
        }

        // ── Burst delay: fast between requests, pause handled globally ──
        // Small jitter to avoid all workers firing at exact same time
        const jitter = 0.7 + Math.random() * 0.6; // 0.7-1.3x
        const delay = Math.round(this.baseDelay * jitter);

        if (this.running) {
          await sleep(delay);
        }
      }

      this.stats.workersActive--;
    };

    return worker;
  }
}
