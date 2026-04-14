import { gotScraping } from 'got-scraping';
import { createLogger } from '../utils/logger.js';
import { getDomain } from '../config.js';
import { lookup } from 'dns';
import { promisify } from 'util';

const log = createLogger('scraper');
const dnsLookup = promisify(lookup);

// ════════════════════════════════════════════════════════════
//  DNS CACHE — avoids 20-50ms DNS resolution on each request
// ════════════════════════════════════════════════════════════
const dnsCache = new Map();
const DNS_TTL = 5 * 60_000;

async function cachedDnsLookup(hostname) {
  const cached = dnsCache.get(hostname);
  if (cached && cached.expires > Date.now()) return cached.address;

  try {
    const result = await dnsLookup(hostname, { family: 4 });
    const address = result.address || result;
    dnsCache.set(hostname, { address, expires: Date.now() + DNS_TTL });
    return address;
  } catch {
    return null;
  }
}

/**
 * VintedClient v5 — Bearer token + single endpoint + human jitter.
 *
 * ═══════════════════════════════════════════════════════════
 *  v5 CHANGES:
 * ═══════════════════════════════════════════════════════════
 *
 * 1. BEARER TOKEN: Uses `Authorization: Bearer` header
 *    → Bypasses Datadome on API endpoints (mobile flow)
 *    → More reliable than cookie-only auth
 *
 * 2. NO MORE RACE MODE: Single endpoint per request
 *    → Halves request count (was 2x with race)
 *    → Less detection risk, less rate limiting
 *    → Smart failover: v2 → web-core on 403
 *
 * 3. HUMAN JITTER: Random ±20% timing variation
 *    → Bot traffic has uniform timing, humans don't
 *    → Makes pattern detection harder
 *
 * 4. SMART 401/403 HANDLING: Triggers session refresh
 *    instead of killing the session immediately
 * ═══════════════════════════════════════════════════════════
 */
export class VintedClient {
  constructor(sessionPool, proxyManager = null) {
    this.sessionPool = sessionPool;
    this.proxyManager = proxyManager;
    this.preferredEndpoint = new Map(); // country → 'v2' | 'web-core'
    this.consecutiveFailures = new Map(); // country → count

    // Pre-warm DNS cache
    const domains = ['www.vinted.fr', 'www.vinted.de', 'www.vinted.es',
      'www.vinted.it', 'www.vinted.nl', 'www.vinted.be', 'www.vinted.pl',
      'www.vinted.pt', 'www.vinted.lt', 'www.vinted.cz', 'www.vinted.co.uk'];
    domains.forEach(d => cachedDnsLookup(d).catch(() => {}));
  }

  /**
   * Make an API request to Vinted.
   * v5: Single endpoint with smart failover, Bearer auth.
   */
  async request(country, endpoint, { params = {}, method = 'GET', body = null } = {}) {
    const session = await this.sessionPool.getSession(country);
    const domain = getDomain(country);
    const baseUrl = `https://${domain}`;

    // Normalize endpoint
    const normalizedEndpoint = endpoint.startsWith('/api/v2')
      ? endpoint
      : `/api/v2${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    // Choose endpoint based on preference (learned from previous responses)
    const preferred = this.preferredEndpoint.get(country);
    let url;
    if (normalizedEndpoint.includes('/catalog') && preferred === 'web-core') {
      url = `${baseUrl}/web/api/core${normalizedEndpoint.replace('/api/v2', '')}`;
    } else {
      url = `${baseUrl}${normalizedEndpoint}`;
    }

    const isCatalog = endpoint.includes('catalog');
    const qs = this._buildQueryString(params, isCatalog);
    const fullUrl = `${url}${qs}`;

    // Pre-resolve DNS (cached)
    await cachedDnsLookup(domain).catch(() => {});

    try {
      const options = {
        url: fullUrl,
        method,
        headers: {
          ...session.headers,
          'Cookie': session.cookieString,
          'Connection': 'keep-alive',
          // ── v5: Bearer token — bypasses Datadome on API ──
          ...(session.accessToken && { 'Authorization': `Bearer ${session.accessToken}` }),
        },
        timeout: { request: 3_000 },
        responseType: 'json',
        throwHttpErrors: false,
      };

      if (this.proxyManager) {
        const proxyUrl = this.proxyManager.getProxy(session.id);
        if (proxyUrl) options.proxyUrl = proxyUrl;
      }

      if (body && method !== 'GET') {
        options.json = body;
        options.headers['Content-Type'] = 'application/json';
      }

      const start = Date.now();
      const response = await gotScraping(options);
      const elapsed = Date.now() - start;

      const hasItems = response.body?.items && response.body.items.length > 0;
      const isOk = response.statusCode >= 200 && response.statusCode < 300;
      const is403 = response.statusCode === 403;
      const is401 = response.statusCode === 401;
      const is429 = response.statusCode === 429;
      const isEmpty = isOk && !hasItems && params.search_text;

      // ── Endpoint learning ──
      if (isCatalog) {
        if (isOk) {
          this.preferredEndpoint.set(country, preferred || 'v2');
          this.consecutiveFailures.set(country, 0);
        } else if (is403 && preferred !== 'web-core') {
          // v2 blocked → try web-core next time
          log.info(`Switching ${country} to web-core endpoint after 403`);
          this.preferredEndpoint.set(country, 'web-core');

          // ── Immediate retry on alternate endpoint ──
          const altUrl = preferred === 'web-core'
            ? `${baseUrl}${normalizedEndpoint}${qs}`
            : `${baseUrl}/web/api/core${normalizedEndpoint.replace('/api/v2', '')}${qs}`;

          try {
            const altResponse = await gotScraping({ ...options, url: altUrl });
            const altOk = altResponse.statusCode >= 200 && altResponse.statusCode < 300;
            if (altOk) {
              this.sessionPool.reportUsage(session, { success: true, isEmpty: false });
              return {
                status: altResponse.statusCode,
                data: altResponse.body,
                headers: altResponse.headers,
                session: session.id,
                endpoint: preferred === 'web-core' ? 'v2' : 'web-core',
                latencyMs: Date.now() - start,
              };
            }
          } catch { /* fallback failed too */ }
        }
      }

      // ── Report usage ──
      // 429 = rate limit, not a session problem — don't count as failure
      if (!is429) {
        this.sessionPool.reportUsage(session, {
          success: isOk,
          isEmpty: (isEmpty || is403) && !hasItems,
        });
      }

      if (this.proxyManager) {
        const proxyUrl = this.proxyManager.getProxy(session.id);
        if (proxyUrl) this.proxyManager.reportResult(proxyUrl, isOk);
      }

      // ── v5: On 401/403, don't kill session immediately.
      //    The pool's emergency refresh mechanism will handle it.
      //    Only mark dead on persistent failures. ──
      if (is401 || is403) {
        const failures = (this.consecutiveFailures.get(country) || 0) + 1;
        this.consecutiveFailures.set(country, failures);

        if (failures >= 5) {
          // 5 consecutive auth failures → session is truly dead
          log.warn(`${response.statusCode} x5 on session ${session.id} — marking dead`);
          session.alive = false;
          this.consecutiveFailures.set(country, 0);
        } else {
          log.debug(`${response.statusCode} on ${session.id} (failure ${failures}/5)`);
        }
      }

      if (is429) {
        // 429 is a SPEED problem, not a SESSION problem.
        // Throw so TurboPoller's burst-pause mechanism catches it.
        const err = new Error(`Rate limited (429) on ${session.id}`);
        err.statusCode = 429;
        throw err;
      }

      return {
        status: response.statusCode,
        data: response.body,
        headers: response.headers,
        session: session.id,
        endpoint: preferred || 'v2',
        latencyMs: elapsed,
      };
    } catch (error) {
      log.error(`Request failed: ${error.message} [${session.id}]`);
      this.sessionPool.reportUsage(session, { success: false, isEmpty: true });
      throw error;
    }
  }

  /**
   * Build query string from params.
   */
  _buildQueryString(params, addTimestamp = false) {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        sp.append(key, String(value));
      }
    }
    if (addTimestamp && !params.time) {
      sp.append('time', Math.floor(Date.now() / 1000).toString());
    }
    const str = sp.toString();
    return str ? `?${str}` : '';
  }

  /**
   * Authenticated request (for autobuy).
   */
  async authRequest(country, endpoint, { method = 'POST', body = null, email, password } = {}) {
    const session = await this.sessionPool.getAuthSession(country, email, password);
    const domain = getDomain(country);
    const url = `https://${domain}/api/v2${endpoint}`;

    log.info(`Auth ${method} ${url} [${session.id}]`);

    await cachedDnsLookup(domain).catch(() => {});

    try {
      const options = {
        url,
        method,
        headers: {
          ...session.headers,
          'Cookie': session.cookieString,
          'Content-Type': 'application/json',
          'Connection': 'keep-alive',
          ...(session.accessToken && { 'Authorization': `Bearer ${session.accessToken}` }),
        },
        json: body,
        timeout: { request: 5_000 },
        responseType: 'json',
        throwHttpErrors: false,
      };

      if (this.proxyManager) {
        const proxyUrl = this.proxyManager.getProxy(session.id);
        if (proxyUrl) options.proxyUrl = proxyUrl;
      }

      const response = await gotScraping(options);

      this.sessionPool.reportUsage(session, {
        success: response.statusCode >= 200 && response.statusCode < 300,
        isEmpty: false,
      });

      return {
        status: response.statusCode,
        data: response.body,
        session: session.id,
      };
    } catch (error) {
      log.error(`Auth request failed: ${error.message}`);
      throw error;
    }
  }
}
