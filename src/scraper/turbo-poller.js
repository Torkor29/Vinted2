import { createLogger } from '../utils/logger.js';
import { sleep } from '../utils/retry.js';

const log = createLogger('turbo');

/**
 * TurboPoller v2 — Human-like parallel polling engine.
 *
 * ═══════════════════════════════════════════════════════════
 *  v2 CHANGES:
 * ═══════════════════════════════════════════════════════════
 *
 * 1. HUMAN JITTER: Each poll delay gets ±30% random variation
 *    Bots poll at uniform intervals → detectable
 *    Humans have natural timing variation → harder to detect
 *
 * 2. SANER DEFAULTS: 8 workers (not 15), 300ms delay (not 150ms)
 *    With Bearer token + single endpoint: ~3 req/s per worker
 *    8 workers × 3 req/s = ~24 req/s total (was ~200 req/s!)
 *    24 req/s is fast enough to catch items within ~300ms
 *
 * 3. SMARTER BACKOFF: Gentler on transient errors, harder on 429
 *    Transient timeout → barely slow down
 *    429 rate limit → back off hard, then recover gradually
 *
 * 4. WORKER HEALTH: Workers auto-pause on sustained errors,
 *    auto-resume after cooldown. No more error cascades.
 * ═══════════════════════════════════════════════════════════
 */
export class TurboPoller {
  constructor(search, { onNewItems, concurrency = 8, workerDelayMs = 300, staggerMs = 80 } = {}) {
    this.search = search;
    this.onNewItems = onNewItems || (() => {});

    this.concurrency = concurrency;
    this.workerDelayMs = workerDelayMs;
    this.staggerMs = staggerMs;

    this.running = false;
    this.workers = [];
    this.stats = {
      totalPolls: 0,
      totalItems: 0,
      totalErrors: 0,
      avgResponseMs: 0,
      startedAt: null,
      workersActive: 0,
    };

    // Adaptive throttle per-worker
    this.currentDelay = workerDelayMs;
    this.minDelay = 2000;   // Floor: 2s (datacenter safe)
    this.maxDelay = 10000;  // Ceiling: 10s (don't slow too much)
    this.consecutiveSuccess = 0;
    this.errorCount = 0;
  }

  /**
   * Start turbo polling for a set of (country, query) tasks.
   */
  start(tasks) {
    if (this.running) return;
    this.running = true;
    this.stats.startedAt = Date.now();

    log.info(`TurboPoller starting: ${tasks.length} tasks, ${this.concurrency} max workers`);

    const workerCount = Math.min(tasks.length, this.concurrency);

    for (let i = 0; i < workerCount; i++) {
      const workerTasks = tasks.filter((_, idx) => idx % workerCount === i);
      const worker = this._createWorker(i, workerTasks);
      this.workers.push(worker);

      // Stagger worker starts to distribute load
      setTimeout(() => {
        if (this.running) worker.promise = worker.run();
      }, i * this.staggerMs);
    }

    log.info(`${workerCount} workers launched (stagger: ${this.staggerMs}ms, delay: ${this.workerDelayMs}ms)`);
  }

  async stop() {
    this.running = false;
    log.info('TurboPoller stopping...');
    await Promise.allSettled(this.workers.map(w => w.promise).filter(Boolean));
    this.workers = [];
    log.info(`TurboPoller stopped. Stats: ${JSON.stringify(this.stats)}`);
  }

  getStats() {
    const uptime = this.stats.startedAt ? Date.now() - this.stats.startedAt : 0;
    const pollsPerMin = uptime > 0 ? Math.round(this.stats.totalPolls / (uptime / 60000)) : 0;
    return {
      ...this.stats,
      uptimeMs: uptime,
      pollsPerMinute: pollsPerMin,
      currentDelayMs: this.currentDelay,
      itemsPerMinute: uptime > 0 ? Math.round(this.stats.totalItems / (uptime / 60000)) : 0,
    };
  }

  /**
   * Create a single polling worker with human-like timing.
   */
  _createWorker(id, tasks) {
    const worker = {
      id,
      tasks,
      running: true,
      polls: 0,
      items: 0,
      errors: 0,
      consecutiveErrors: 0,
      promise: null,
    };

    worker.run = async () => {
      this.stats.workersActive++;
      let taskIndex = 0;

      while (this.running && worker.running) {
        const task = tasks[taskIndex % tasks.length];
        taskIndex++;

        // ── Worker auto-pause on sustained errors ──
        if (worker.consecutiveErrors >= 10) {
          const cooldown = 15_000 + Math.random() * 10_000; // 15-25s cooldown
          log.warn(`Worker${id} pausing ${Math.round(cooldown / 1000)}s (${worker.consecutiveErrors} consecutive errors)`);
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

          // Rolling average response time
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

          this._onSuccess();

        } catch (error) {
          worker.errors++;
          worker.consecutiveErrors++;
          this.stats.totalErrors++;

          this._onError(error);

          // Only log every 5th error to avoid spam
          if (worker.consecutiveErrors % 5 === 1) {
            log.warn(`Worker${id} error [${task.country}]: ${error.message} (consecutive: ${worker.consecutiveErrors})`);
          }
        }

        // ── Human jitter: ±30% random variation on delay ──
        const jitter = 1 + (Math.random() - 0.5) * 0.6; // 0.7 to 1.3
        const delay = Math.round(this.currentDelay * jitter);

        if (this.running) {
          await sleep(delay);
        }
      }

      this.stats.workersActive--;
    };

    return worker;
  }

  /**
   * Adaptive throttle: speed up after consecutive successes.
   */
  _onSuccess() {
    this.consecutiveSuccess++;
    this.errorCount = Math.max(0, this.errorCount - 1);

    // After 5 consecutive successes, speed up faster
    if (this.consecutiveSuccess > 5 && this.currentDelay > this.minDelay) {
      this.currentDelay = Math.max(this.minDelay, Math.round(this.currentDelay * 0.85));
    }
  }

  /**
   * Adaptive throttle: slow down on errors.
   */
  _onError(error) {
    this.consecutiveSuccess = 0;
    this.errorCount++;

    const is429 = error.message?.includes('429') || error.message?.includes('Rate');
    const isTimeout = error.message?.includes('ETIMEDOUT') || error.message?.includes('timeout');

    let multiplier;
    if (is429) {
      multiplier = 1.5;  // Moderate backoff — rate limit only lasts ~5s on Vinted
    } else if (isTimeout) {
      multiplier = 1.1;  // Gentle on timeouts
    } else {
      multiplier = 1.2;  // Light on other errors
    }

    if (this.errorCount > 2) {
      this.currentDelay = Math.min(this.maxDelay, Math.round(this.currentDelay * multiplier));
      if (this.errorCount % 5 === 0) {
        log.warn(`Throttling: delay -> ${this.currentDelay}ms (${this.errorCount} errors, ${is429 ? '429' : isTimeout ? 'timeout' : 'other'})`);
      }
    }
  }
}
