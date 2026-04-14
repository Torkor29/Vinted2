import { CookieFactory } from '../cookie-factory/factory.js';
import { createLogger } from '../utils/logger.js';
import { sleep } from '../utils/retry.js';

const log = createLogger('session-pool');

/**
 * SessionPool v3 — Immortal sessions via token refresh.
 *
 * ═══════════════════════════════════════════════════════════
 *  KEY CHANGE (v3): REFRESH > ROTATE
 * ═══════════════════════════════════════════════════════════
 *
 * v2: Session hits 300 requests → killed → create new session
 *     via FlareSolverr (30-60s) → often fails → bot dies
 *
 * v3: Session runs forever. Every 90 minutes, we re-fetch
 *     the homepage with got-scraping (~1s) to get a fresh
 *     access_token_web JWT. No FlareSolverr needed.
 *
 * ROTATION only happens on HARD FAILURE:
 * - 401/403 that persists after refresh attempt
 * - Session marked dead by health check
 *
 * RESULT:
 * - FlareSolverr only needed at startup (if Cloudflare blocks)
 * - No more rotation storms
 * - Sessions live indefinitely
 * - Bot never stops
 */
export class SessionPool {
  constructor(config, proxyManager = null) {
    this.config = config;
    this.sessionConfig = config.session;
    this.factory = new CookieFactory(config);
    this.proxyManager = proxyManager;
    // Map<country, Session[]>
    this.pools = new Map();
    // Map<country, number> round-robin index
    this.roundRobin = new Map();
    this.isInitializing = new Map();
    this.healthCheckTimer = null;
    this.refreshTimers = new Map(); // Map<sessionId, timer>
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
        // Use a different proxy for each session creation (if available)
        const proxyUrl = this.proxyManager?.getProxy(`init-${country}-${i}`) || null;
        const session = await this.factory.createSession(country, proxyUrl);
        sessions.push(session);
        // Schedule automatic token refresh for this session
        this._scheduleRefresh(session);
        log.info(`Session ${i + 1}/${poolSize} ready for ${country} (method: ${session.method})`);
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
   * v3: Only rotates on hard death. Refresh happens automatically in background.
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

    // Only rotate on HARD failure (not request count)
    if (this.needsHardRotation(session)) {
      log.info(`Hard rotation needed for ${session.id} (alive:${session.alive}, errors:${session.errors})`);
      session = await this.rotateSession(country, idx);
    }

    this.roundRobin.set(country, idx + 1);
    return session;
  }

  /**
   * Schedule automatic token refresh for a session.
   * Runs every tokenRefreshIntervalMs (default: 90 min).
   */
  _scheduleRefresh(session) {
    // Clear existing timer if any
    const existingTimer = this.refreshTimers.get(session.id);
    if (existingTimer) clearInterval(existingTimer);

    const intervalMs = this.sessionConfig.tokenRefreshIntervalMs || 90 * 60_000;

    const timer = setInterval(async () => {
      if (!session.alive) {
        clearInterval(timer);
        this.refreshTimers.delete(session.id);
        return;
      }

      log.info(`Auto-refreshing session ${session.id} (age: ${Math.round((Date.now() - session.lastRefreshedAt) / 60000)}min)...`);

      const success = await this.factory.refreshSession(session);
      if (success) {
        log.info(`Session ${session.id} auto-refreshed OK`);
      } else {
        log.warn(`Session ${session.id} auto-refresh failed — will try again next cycle`);
        // Don't kill the session — it might still work, or refresh succeeds next time
        session.errors++;
      }
    }, intervalMs);

    this.refreshTimers.set(session.id, timer);
    log.debug(`Refresh scheduled for ${session.id} every ${Math.round(intervalMs / 60000)}min`);
  }

  /**
   * Report request usage.
   */
  reportUsage(session, { success, isEmpty }) {
    session.requestCount++;

    if (isEmpty) {
      session.emptyResponseCount++;
    } else {
      session.emptyResponseCount = 0;
    }

    if (!success) session.errors++;

    // ── Emergency refresh: if many consecutive empty responses,
    //    try an immediate refresh instead of waiting for the timer ──
    if (session.emptyResponseCount >= this.sessionConfig.rotateOnConsecutiveEmpty && !session._emergencyRefreshing) {
      session._emergencyRefreshing = true;
      this._emergencyRefresh(session).catch(() => {});
    }
  }

  /**
   * Emergency refresh — triggered by consecutive empty/error responses.
   * Tries to refresh the token immediately (non-blocking).
   */
  async _emergencyRefresh(session) {
    log.info(`Emergency refresh for ${session.id} (empty:${session.emptyResponseCount}, errors:${session.errors})`);

    const success = await this.factory.refreshSession(session);
    if (success) {
      session.emptyResponseCount = 0;
      log.info(`Emergency refresh OK for ${session.id}`);
    } else {
      log.warn(`Emergency refresh failed for ${session.id}`);
    }

    session._emergencyRefreshing = false;
  }

  /**
   * Check if session needs HARD rotation (complete replacement).
   * v3: Much stricter — only on truly dead sessions.
   */
  needsHardRotation(session) {
    if (!session.alive) return true;
    // Too many errors even after refresh attempts
    if (session.errors >= this.sessionConfig.rotateOnErrors * 2) return true;
    // Extremely high consecutive empty (emergency refresh also failed)
    if (session.emptyResponseCount >= this.sessionConfig.rotateOnConsecutiveEmpty * 3) return true;
    return false;
  }

  /**
   * Hard rotate: create completely new session.
   * v3: Only happens on truly dead sessions. Includes retry.
   */
  async rotateSession(country, index) {
    const pool = this.pools.get(country);
    const old = pool[index];

    // Cancel old refresh timer
    const oldTimer = this.refreshTimers.get(old.id);
    if (oldTimer) {
      clearInterval(oldTimer);
      this.refreshTimers.delete(old.id);
    }

    // ── Try refresh first (cheaper than full rotation) ──
    if (old.alive) {
      const refreshed = await this.factory.refreshSession(old);
      if (refreshed) {
        old.errors = 0;
        old.emptyResponseCount = 0;
        this._scheduleRefresh(old);
        log.info(`Rotation avoided — refresh saved ${old.id}`);
        return old;
      }
    }

    // ── Full rotation with retries ──
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const fresh = await this.factory.createSession(country);
        pool[index] = fresh;
        this._scheduleRefresh(fresh);
        log.info(`Rotated: ${old.id} -> ${fresh.id} (method: ${fresh.method})`);
        return fresh;
      } catch (error) {
        if (attempt < 3) {
          log.warn(`Rotation attempt ${attempt}/3 failed: ${error.message}, retrying in 10s...`);
          await new Promise(r => setTimeout(r, 10000));
        } else {
          log.error(`Rotation failed after 3 attempts: ${error.message}`);
          // Keep old session alive — reset counters, better than nothing
          old.requestCount = 0;
          old.errors = 0;
          old.emptyResponseCount = 0;
          old.alive = true;
          this._scheduleRefresh(old);
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

    if (this.needsHardRotation(session)) {
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
        const session = pool[i];

        // Check if token is very old (>2h without refresh) — force refresh
        const tokenAge = Date.now() - (session.lastRefreshedAt || session.createdAt);
        if (tokenAge > 110 * 60_000 && session.alive) { // 110 min (before 2h expiry)
          log.info(`Health check: session ${session.id} token is ${Math.round(tokenAge / 60000)}min old, refreshing...`);
          const refreshed = await this.factory.refreshSession(session);
          if (!refreshed) {
            log.warn(`Health check refresh failed for ${session.id}`);
            session.errors++;
          }
        }

        // Only hard-rotate truly dead sessions
        if (this.needsHardRotation(session)) {
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
          method: s.method,
          alive: s.alive,
          requests: s.requestCount,
          empty: s.emptyResponseCount,
          errors: s.errors,
          age: Math.round((Date.now() - s.createdAt) / 1000) + 's',
          tokenAge: Math.round((Date.now() - (s.lastRefreshedAt || s.createdAt)) / 60000) + 'min',
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
    // Clear all refresh timers
    for (const timer of this.refreshTimers.values()) {
      clearInterval(timer);
    }
    this.refreshTimers.clear();

    await this.factory.close();
    log.info('Session pool shut down');
  }
}
