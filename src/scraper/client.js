import { gotScraping } from 'got-scraping';
import { createLogger } from '../utils/logger.js';
import { getApiUrl, getDomain, getBaseUrl } from '../config.js';

const log = createLogger('scraper');

/**
 * VintedClient v3 - HTTP client with dual API support.
 *
 * ═══════════════════════════════════════════════════════════
 *  TWO API MODES (based on research)
 * ═══════════════════════════════════════════════════════════
 *
 * MODE 1: Web API (default)
 *   URL:     https://www.vinted.fr/api/v2/catalog/items
 *   Auth:    Cookie: _vinted_fr_session=xxx
 *   Defense: Datadome active → needs valid session cookie
 *   Pro:     Standard catalog endpoint, well-documented
 *   Con:     Datadome can block if fingerprint is wrong
 *
 * MODE 2: Web Core API (alternative web endpoint)
 *   URL:     https://www.vinted.fr/web/api/core/catalog/items
 *   Auth:    Same cookies
 *   Defense: Same Datadome
 *   Note:    Some scrapers report this endpoint is more stable
 *
 * BOTH use got-scraping which mimics browser TLS fingerprint.
 * The session cookie from CookieFactory is the key auth mechanism.
 */
export class VintedClient {
  constructor(sessionPool, proxyManager = null) {
    this.sessionPool = sessionPool;
    this.proxyManager = proxyManager;
    // Track which endpoint works per country
    this.preferredEndpoint = new Map(); // country → 'v2' | 'web-core'
  }

  /**
   * Make an API request to Vinted catalog.
   * Tries the primary endpoint, falls back to alternative if needed.
   */
  async request(country, endpoint, { params = {}, method = 'GET', body = null } = {}) {
    const session = await this.sessionPool.getSession(country);
    const domain = getDomain(country);
    const baseUrl = `https://${domain}`;

    // Build the URL
    // Standard: /api/v2/catalog/items
    // Alternative: /web/api/core/catalog/items (reported more stable by some scrapers)
    let url;
    const preferred = this.preferredEndpoint.get(country);

    // Normalize endpoint: always prepend /api/v2 if not already present
    const normalizedEndpoint = endpoint.startsWith('/api/v2')
      ? endpoint
      : `/api/v2${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    if (normalizedEndpoint.includes('/catalog') && preferred === 'web-core') {
      url = `${baseUrl}/web/api/core${normalizedEndpoint.replace('/api/v2', '')}`;
    } else {
      url = `${baseUrl}${normalizedEndpoint}`;
    }

    // Build query string
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    }

    // Vinted web API uses a timestamp parameter
    if (!params.time && endpoint.includes('catalog')) {
      searchParams.append('time', Math.floor(Date.now() / 1000).toString());
    }

    const fullUrl = searchParams.toString() ? `${url}?${searchParams}` : url;

    log.debug(`${method} ${fullUrl} [session: ${session.id}, method: ${session.method}]`);

    try {
      const options = {
        url: fullUrl,
        method,
        headers: {
          ...session.headers,
          'Cookie': session.cookieString,
        },
        timeout: { request: 15_000 },
        responseType: 'json',
        throwHttpErrors: false,
      };

      // Proxy support (sticky to session for TLS consistency)
      if (this.proxyManager) {
        const proxyUrl = this.proxyManager.getProxy(session.id);
        if (proxyUrl) options.proxyUrl = proxyUrl;
      }

      if (body && method !== 'GET') {
        options.json = body;
        options.headers['Content-Type'] = 'application/json';
      }

      const response = await gotScraping(options);

      // ── Analyze response quality ──
      const hasItems = response.body?.items && response.body.items.length > 0;
      const isOk = response.statusCode >= 200 && response.statusCode < 300;
      const is403 = response.statusCode === 403;
      const is401 = response.statusCode === 401;
      const is429 = response.statusCode === 429;
      const isEmpty = isOk && !hasItems && params.search_text;

      // Track endpoint reliability
      if (endpoint.includes('catalog')) {
        if (isOk && hasItems) {
          // This endpoint works, remember it
          this.preferredEndpoint.set(country, preferred || 'v2');
        } else if (is403 && preferred !== 'web-core') {
          // Try alternative next time
          log.info(`Switching ${country} to web-core endpoint after 403`);
          this.preferredEndpoint.set(country, 'web-core');
        }
      }

      // Report usage to session pool
      this.sessionPool.reportUsage(session, {
        success: isOk,
        isEmpty: (isEmpty || is403) && !hasItems,
      });

      // Proxy reporting
      if (this.proxyManager) {
        const proxyUrl = this.proxyManager.getProxy(session.id);
        if (proxyUrl) this.proxyManager.reportResult(proxyUrl, isOk);
      }

      // Session health signals
      if (is401 || is403) {
        log.warn(`${response.statusCode} on session ${session.id} — marking for rotation`);
        session.alive = false;
      }
      if (is429) {
        log.warn(`Rate limited on ${session.id}`);
        session.errors += 3;
      }

      return {
        status: response.statusCode,
        data: response.body,
        headers: response.headers,
        session: session.id,
      };
    } catch (error) {
      log.error(`Request failed: ${error.message} [${session.id}]`);
      this.sessionPool.reportUsage(session, { success: false, isEmpty: true });
      throw error;
    }
  }

  /**
   * Authenticated request (for autobuy).
   */
  async authRequest(country, endpoint, { method = 'POST', body = null, email, password } = {}) {
    const session = await this.sessionPool.getAuthSession(country, email, password);
    const domain = getDomain(country);
    const url = `https://${domain}/api/v2${endpoint}`;

    log.info(`Auth ${method} ${url} [${session.id}]`);

    try {
      const options = {
        url,
        method,
        headers: {
          ...session.headers,
          'Cookie': session.cookieString,
          'Content-Type': 'application/json',
        },
        json: body,
        timeout: { request: 15_000 },
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
