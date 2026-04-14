import { CookieFactory } from '../cookie-factory/factory.js';
import { createLogger } from '../utils/logger.js';
import { sleep } from '../utils/retry.js';

const log = createLogger('session-pool');

/**
 * SessionPool v2 - Multi-country session management.
 *
 * KEY INSIGHT: Vinted ties sessions to TLS fingerprint.
 * If cookies are reused with different TLS → silent invalidation.
 * got-scraping mimics browser TLS, so Playwright cookies work.
 *
 * ROTATION STRATEGY:
 * - After N requests (default 80) → rotate
 * - After N consecutive empty responses → rotate immediately
 * - After N errors → rotate
 * - Health check periodically prunes dead sessions
 *
 * NEW: Multi-country simultaneous support.
 */
export class SessionPool {
  constructor(config) {
    this.config = config;
    this.sessionConfig = config.session;
    this.factory = new CookieFactory(config);
    // Map<country, Session[]>
    this.pools = new Map();
    // Map<country, number> round-robin index
    this.roundRobin = new Map();
    this.isInitializing = new Map();
    this.healthCheckTimer = null;
  }

  /**
   * Initialize pool for a country.
   */
  async initialize(country) {
    if (this.isInitializing.get(country)) {
      while (this.isInitializing.get(country)) await sleep(1000);
      return;
    }

    this.isInitializing.set(country, true);
    const poolSize = this.sessionConfig.poolSizePerCountry;
    log.info(`Initializing pool for ${country} (size: ${poolSize})`);

    const sessions = [];
    for (let i = 0; i < poolSize; i++) {
      try {
        const session = await this.factory.createSession(country);
        sessions.push(session);
        log.info(`Session ${i + 1}/${poolSize} ready for ${country}`);
        if (i < poolSize - 1) {
          await sleep(this.sessionConfig.creationStaggerMs + Math.random() * 2000);
        }
      } catch (error) {
        log.error(`Failed session ${i + 1} for ${country}: ${error.message}`);
      }
    }

    this.pools.set(country, sessions);
    this.roundRobin.set(country, 0);
    this.isInitializing.set(country, false);

    log.info(`Pool ${country}: ${sessions.length} sessions active`);
  }

  /**
   * Initialize all configured countries.
   */
  async initializeAll(countries) {
    for (const country of countries) {
      await this.initialize(country);
    }
  }

  /**
   * Get next session (round-robin).
   * Proactively triggers background pre-warming when a session approaches its limit.
   */
  async getSession(country) {
    if (!this.pools.has(country) || this.pools.get(country).length === 0) {
      await this.initialize(country);
    }

    const pool = this.pools.get(country);
    if (!pool || pool.length === 0) {
      throw new Error(`No sessions for ${country}`);
    }

    let idx = this.roundRobin.get(country) % pool.length;
    let session = pool[idx];

    if (this.needsRotation(session)) {
      log.info(`Rotating ${session.id} (req:${session.requestCount}, empty:${session.emptyResponseCount})`);
      session = await this.rotateSession(country, idx);
    }

    // ── Proactive pre-warming: if session is at 70% of max requests,
    // start creating a replacement in the background so rotation is instant ──
    const threshold = Math.floor(this.sessionConfig.maxRequestsPerSession * 0.7);
    if (session.requestCount >= threshold && !session._prewarming) {
      session._prewarming = true;
      this._prewarmSession(country, idx).catch(() => {});
    }

    this.roundRobin.set(country, idx + 1);
    return session;
  }

  /**
   * Pre-warm a replacement session in the background.
   * When the current session hits rotation, the swap is near-instant.
   */
  async _prewarmSession(country, index) {
    try {
      const fresh = await this.factory.createSession(country);
      // Store it as a pending replacement
      if (!this._pendingReplacements) this._pendingReplacements = new Map();
      this._pendingReplacements.set(`${country}:${index}`, fresh);
      log.debug(`Pre-warmed replacement for ${country} slot ${index}`);
    } catch (error) {
      log.debug(`Pre-warm failed for ${country}: ${error.message}`);
    }
  }

  reportUsage(session, { success, isEmpty }) {
    session.requestCount++;

    if (isEmpty) {
      session.emptyResponseCount++;
    } else {
      session.emptyResponseCount = 0;
    }

    if (!success) session.errors++;
  }

  needsRotation(session) {
    if (!session.alive) return true;
    if (session.requestCount >= this.sessionConfig.maxRequestsPerSession) return true;
    if (session.emptyResponseCount >= this.sessionConfig.rotateOnConsecutiveEmpty) return true;
    if (session.errors >= this.sessionConfig.rotateOnErrors) return true;
    return false;
  }

  async rotateSession(country, index) {
    const pool = this.pools.get(country);
    const old = pool[index];
    const key = `${country}:${index}`;

    // ── Use pre-warmed session if available (instant swap) ──
    if (this._pendingReplacements?.has(key)) {
      const fresh = this._pendingReplacements.get(key);
      this._pendingReplacements.delete(key);
      pool[index] = fresh;
      log.info(`Rotated (pre-warmed): ${old.id} → ${fresh.id}`);
      return fresh;
    }

    // Retry rotation up to 3 times with delay
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const fresh = await this.factory.createSession(country);
        pool[index] = fresh;
        log.info(`Rotated: ${old.id} → ${fresh.id}`);
        return fresh;
      } catch (error) {
        if (attempt < 3) {
          log.warn(`Rotation attempt ${attempt}/3 failed: ${error.message}, retrying in 10s...`);
          await new Promise(r => setTimeout(r, 10000));
        } else {
          log.error(`Rotation failed after 3 attempts: ${error.message}`);
          // Don't kill the old session — keep using it even if stale, better than nothing
          old.requestCount = 0; // Reset counter to extend its life
          old.errors = 0;
          log.warn(`Keeping old session ${old.id} alive (reset counters)`);
          return old;
        }
      }
    }
  }

  async getAuthSession(country, email, password) {
    const key = `auth-${country}`;
    if (!this.pools.has(key) || this.pools.get(key).length === 0) {
      const session = await this.factory.createAuthenticatedSession(country, email, password);
      this.pools.set(key, [session]);
    }

    const pool = this.pools.get(key);
    const session = pool[0];

    if (this.needsRotation(session)) {
      const fresh = await this.factory.createAuthenticatedSession(country, email, password);
      pool[0] = fresh;
      return fresh;
    }

    return session;
  }

  startHealthCheck() {
    if (this.healthCheckTimer) return;
    this.healthCheckTimer = setInterval(() => this.runHealthCheck(), this.sessionConfig.healthCheckIntervalMs);
    log.info('Health check started');
  }

  async runHealthCheck() {
    for (const [country, pool] of this.pools) {
      if (country.startsWith('auth-')) continue;

      for (let i = 0; i < pool.length; i++) {
        if (!pool[i].alive || this.needsRotation(pool[i])) {
          try {
            await this.rotateSession(country, i);
          } catch { /* retry next cycle */ }
        }
      }
    }
  }

  getStats() {
    const stats = {};
    for (const [country, pool] of this.pools) {
      stats[country] = {
        total: pool.length,
        alive: pool.filter(s => s.alive).length,
        totalRequests: pool.reduce((sum, s) => sum + s.requestCount, 0),
        totalErrors: pool.reduce((sum, s) => sum + s.errors, 0),
        sessions: pool.map(s => ({
          id: s.id,
          alive: s.alive,
          requests: s.requestCount,
          empty: s.emptyResponseCount,
          errors: s.errors,
          age: Math.round((Date.now() - s.createdAt) / 1000) + 's',
        })),
      };
    }
    return stats;
  }

  async shutdown() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    await this.factory.close();
    log.info('Session pool shut down');
  }
}
