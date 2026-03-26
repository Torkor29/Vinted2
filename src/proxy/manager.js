import { readFileSync, existsSync } from 'fs';
import { gotScraping } from 'got-scraping';
import { createLogger } from '../utils/logger.js';

const log = createLogger('proxy');

/**
 * ProxyManager - Manages a pool of proxies with rotation strategies.
 *
 * CRITICAL FOR ANTI-BOT:
 * - Each proxy has its own "identity" (IP + TLS)
 * - Binding a proxy to a session = consistent fingerprint
 * - Rotating proxy mid-session = detection risk
 *
 * Strategies:
 * - round-robin: cycle through proxies sequentially
 * - random: pick a random proxy each time
 * - least-used: pick the proxy with fewest requests
 * - sticky: bind proxy to session ID (never changes for that session)
 */
export class ProxyManager {
  constructor(config) {
    this.config = config.proxy;
    this.proxies = [];            // { url, alive, requests, failures, lastUsed, boundSessions }
    this.roundRobinIdx = 0;
    this.sessionBindings = new Map();  // sessionId → proxyUrl
  }

  async initialize() {
    if (!this.config.enabled) {
      log.info('Proxy disabled');
      return;
    }

    // Load proxies from config list
    if (this.config.list?.length > 0) {
      for (const url of this.config.list) {
        this.proxies.push(this.createProxyEntry(url));
      }
    }

    // Load from file
    if (this.config.file && existsSync(this.config.file)) {
      const lines = readFileSync(this.config.file, 'utf-8')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'));
      for (const url of lines) {
        this.proxies.push(this.createProxyEntry(url));
      }
    }

    log.info(`Loaded ${this.proxies.length} proxies`);

    if (this.config.testOnStartup && this.proxies.length > 0) {
      await this.testAll();
    }
  }

  createProxyEntry(url) {
    return {
      url: url.trim(),
      alive: true,
      requests: 0,
      failures: 0,
      consecutiveFailures: 0,
      lastUsed: 0,
      latencyMs: null,
      boundSessions: new Set(),
    };
  }

  /**
   * Get a proxy for a given session.
   * Returns proxy URL string or undefined if no proxy/disabled.
   */
  getProxy(sessionId) {
    if (!this.config.enabled || this.proxies.length === 0) return undefined;

    // Sticky: return bound proxy if exists
    if (this.config.stickyToSession && sessionId && this.sessionBindings.has(sessionId)) {
      const bound = this.sessionBindings.get(sessionId);
      const entry = this.proxies.find(p => p.url === bound && p.alive);
      if (entry) {
        entry.requests++;
        entry.lastUsed = Date.now();
        return entry.url;
      }
      // Bound proxy died, rebind
      this.sessionBindings.delete(sessionId);
    }

    const alive = this.proxies.filter(p => p.alive);
    if (alive.length === 0) {
      log.warn('No alive proxies available');
      return undefined;
    }

    let selected;
    switch (this.config.strategy) {
      case 'random':
        selected = alive[Math.floor(Math.random() * alive.length)];
        break;
      case 'least-used':
        selected = alive.sort((a, b) => a.requests - b.requests)[0];
        break;
      case 'round-robin':
      default:
        selected = alive[this.roundRobinIdx % alive.length];
        this.roundRobinIdx++;
        break;
    }

    selected.requests++;
    selected.lastUsed = Date.now();

    if (this.config.stickyToSession && sessionId) {
      this.sessionBindings.set(sessionId, selected.url);
      selected.boundSessions.add(sessionId);
    }

    return selected.url;
  }

  /**
   * Report proxy success/failure.
   */
  reportResult(proxyUrl, success) {
    const entry = this.proxies.find(p => p.url === proxyUrl);
    if (!entry) return;

    if (success) {
      entry.consecutiveFailures = 0;
    } else {
      entry.failures++;
      entry.consecutiveFailures++;
      if (entry.consecutiveFailures >= this.config.maxFailures) {
        entry.alive = false;
        log.warn(`Proxy ${maskUrl(proxyUrl)} marked dead after ${entry.consecutiveFailures} failures`);
        // Unbind all sessions using this proxy
        for (const sid of entry.boundSessions) {
          this.sessionBindings.delete(sid);
        }
        entry.boundSessions.clear();
      }
    }
  }

  /**
   * Test all proxies.
   */
  async testAll() {
    log.info(`Testing ${this.proxies.length} proxies...`);
    const results = await Promise.allSettled(
      this.proxies.map(p => this.testProxy(p)),
    );

    const alive = this.proxies.filter(p => p.alive).length;
    log.info(`Proxy test: ${alive}/${this.proxies.length} alive`);
  }

  async testProxy(entry) {
    const start = Date.now();
    try {
      await gotScraping({
        url: 'https://httpbin.org/ip',
        proxyUrl: entry.url,
        timeout: { request: 10_000 },
        throwHttpErrors: true,
      });
      entry.latencyMs = Date.now() - start;
      entry.alive = true;
      log.debug(`Proxy ${maskUrl(entry.url)} OK (${entry.latencyMs}ms)`);
    } catch (error) {
      entry.alive = false;
      log.warn(`Proxy ${maskUrl(entry.url)} FAILED: ${error.message}`);
    }
  }

  /**
   * Unbind session (on session rotation).
   */
  unbindSession(sessionId) {
    const proxyUrl = this.sessionBindings.get(sessionId);
    if (proxyUrl) {
      const entry = this.proxies.find(p => p.url === proxyUrl);
      if (entry) entry.boundSessions.delete(sessionId);
      this.sessionBindings.delete(sessionId);
    }
  }

  getStats() {
    return {
      enabled: this.config.enabled,
      total: this.proxies.length,
      alive: this.proxies.filter(p => p.alive).length,
      strategy: this.config.strategy,
      proxies: this.proxies.map(p => ({
        url: maskUrl(p.url),
        alive: p.alive,
        requests: p.requests,
        failures: p.failures,
        latencyMs: p.latencyMs,
        boundSessions: p.boundSessions.size,
      })),
    };
  }
}

function maskUrl(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    if (u.username) u.username = u.username.slice(0, 3) + '***';
    return u.toString();
  } catch {
    return url.slice(0, 20) + '***';
  }
}
