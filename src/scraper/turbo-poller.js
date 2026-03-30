import { createLogger } from '../utils/logger.js';
import { sleep } from '../utils/retry.js';

const log = createLogger('turbo');

/**
 * TurboPoller — Ultra-fast parallel polling engine.
 *
 * Instead of the standard cycle-based approach (poll all → wait → repeat),
 * TurboPoller runs independent staggered workers that each poll continuously.
 * This gives ~3-5x faster item detection.
 *
 * ════════════════════════════════════════════════════════════════
 *  STANDARD POLLING (before):
 *    [Query1, Query2, Query3] → wait 2s → [Query1, Query2, Query3] → wait 2s
 *    Avg detection delay: ~1s + processing time
 *
 *  TURBO POLLING (now):
 *    Worker1: Query1 → 200ms → Query1 → 200ms → ...
 *    Worker2: Query2 → 200ms → Query2 → 200ms → ...
 *    Worker3: Query3 → 200ms → Query3 → 200ms → ...
 *    (all running independently, staggered start)
 *    Avg detection delay: ~100ms
 * ════════════════════════════════════════════════════════════════
 */
export class TurboPoller {
  constructor(search, { onNewItems, concurrency = 15, workerDelayMs = 200, staggerMs = 50 } = {}) {
    this.search = search;
    this.onNewItems = onNewItems || (() => {});

    // ── Tuning ──
    this.concurrency = concurrency;    // Max parallel workers
    this.workerDelayMs = workerDelayMs; // Min delay between polls per worker
    this.staggerMs = staggerMs;         // Stagger between worker starts

    // ── State ──
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

    // ── Adaptive throttle: back off on errors, speed up on success ──
    this.errorCount = 0;
    this.consecutiveSuccess = 0;
    this.currentDelay = workerDelayMs;
    this.minDelay = 100;    // Floor: 100ms
    this.maxDelay = 5000;   // Ceiling: 5s (heavy rate limiting)
  }

  /**
   * Start turbo polling for a set of (country, query) tasks.
   */
  start(tasks) {
    if (this.running) return;
    this.running = true;
    this.stats.startedAt = Date.now();

    log.info(`⚡ TurboPoller starting: ${tasks.length} tasks, ${this.concurrency} max workers`);

    // Distribute tasks across workers — each worker gets a task to poll continuously
    // If more tasks than workers, workers round-robin through tasks
    const workerCount = Math.min(tasks.length, this.concurrency);

    for (let i = 0; i < workerCount; i++) {
      // Each worker gets assigned tasks in a round-robin fashion
      const workerTasks = tasks.filter((_, idx) => idx % workerCount === i);
      const worker = this._createWorker(i, workerTasks);
      this.workers.push(worker);

      // Stagger worker starts to distribute load
      setTimeout(() => {
        if (this.running) worker.promise = worker.run();
      }, i * this.staggerMs);
    }

    log.info(`⚡ ${workerCount} workers launched (stagger: ${this.staggerMs}ms)`);
  }

  /**
   * Stop all workers gracefully.
   */
  async stop() {
    this.running = false;
    log.info('⚡ TurboPoller stopping...');

    // Wait for all workers to finish their current request
    await Promise.allSettled(this.workers.map(w => w.promise).filter(Boolean));
    this.workers = [];

    log.info(`⚡ TurboPoller stopped. Stats: ${JSON.stringify(this.stats)}`);
  }

  /**
   * Get current performance stats.
   */
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
   * Create a single polling worker.
   */
  _createWorker(id, tasks) {
    const worker = {
      id,
      tasks,
      running: true,
      polls: 0,
      items: 0,
      errors: 0,
      promise: null,
    };

    worker.run = async () => {
      this.stats.workersActive++;
      let taskIndex = 0;

      while (this.running && worker.running) {
        const task = tasks[taskIndex % tasks.length];
        taskIndex++;

        const start = Date.now();
        try {
          const newItems = await this.search.pollNewItems(task.country, task.query);
          const elapsed = Date.now() - start;

          worker.polls++;
          this.stats.totalPolls++;

          // Update rolling average response time
          this.stats.avgResponseMs = Math.round(
            this.stats.avgResponseMs * 0.9 + elapsed * 0.1
          );

          if (newItems.length > 0) {
            worker.items += newItems.length;
            this.stats.totalItems += newItems.length;

            log.info(`⚡ Worker${id}: ${newItems.length} new items [${task.country}] (${elapsed}ms)`);

            // Fire callback immediately — don't wait for other workers
            try {
              await this.onNewItems(newItems, task.country, task.query);
            } catch (e) {
              log.error(`⚡ Worker${id} callback error: ${e.message}`);
            }
          }

          // ── Adaptive speed: success → speed up ──
          this._onSuccess();

        } catch (error) {
          worker.errors++;
          this.stats.totalErrors++;

          // ── Adaptive speed: error → slow down ──
          this._onError(error);

          log.warn(`⚡ Worker${id} error [${task.country}]: ${error.message}`);
        }

        // Wait before next poll (adaptive delay)
        if (this.running) {
          await sleep(this.currentDelay);
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

    // After 10 consecutive successes, try to go faster
    if (this.consecutiveSuccess > 10 && this.currentDelay > this.minDelay) {
      this.currentDelay = Math.max(this.minDelay, Math.round(this.currentDelay * 0.9));
    }
  }

  /**
   * Adaptive throttle: slow down on errors (rate limits, 403s, etc).
   */
  _onError(error) {
    this.consecutiveSuccess = 0;
    this.errorCount++;

    // Exponential backoff: each error increases delay
    if (this.errorCount > 3) {
      this.currentDelay = Math.min(this.maxDelay, Math.round(this.currentDelay * 1.5));
      log.warn(`⚡ Throttling: delay → ${this.currentDelay}ms (${this.errorCount} errors)`);
    }
  }
}
