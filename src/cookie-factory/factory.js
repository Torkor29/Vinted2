import { chromium } from 'playwright';
import { createLogger } from '../utils/logger.js';
import { getDomain, getBaseUrl } from '../config.js';

const log = createLogger('cookie-factory');

/**
 * CookieFactory v3 — Bulletproof session creation + token refresh.
 *
 * ═══════════════════════════════════════════════════════════
 *  KEY INSIGHT (v3): Bearer token = no Datadome
 * ═══════════════════════════════════════════════════════════
 *
 * Vinted's API accepts `Authorization: Bearer <access_token_web>`.
 * The mobile API flow has NO Datadome protection.
 * So we only need to get the initial token via homepage fetch,
 * then use Bearer auth for all subsequent API calls.
 *
 * TOKEN REFRESH:
 * Instead of destroying sessions and creating new ones (expensive),
 * we re-fetch the homepage with got-scraping to get a fresh JWT.
 * This is instant (~1s) vs FlareSolverr (30-60s).
 *
 * STRATEGY:
 * 1. got-scraping fetch (primary — works 95% of the time)
 * 2. got-scraping with alternate fingerprint (fallback)
 * 3. FlareSolverr (only if Cloudflare is actively blocking)
 * 4. Playwright (absolute last resort)
 *
 * REFRESH:
 * - Every 90 minutes, re-fetch homepage → new access_token_web
 * - Session object stays alive, just token/cookies updated
 * - No downtime, no FlareSolverr needed
 */
export class CookieFactory {
  constructor(config) {
    this.config = config;
    this.browser = null;
  }

  /**
   * Create a new session. Tries multiple methods in order of speed.
   */
  async createSession(country = 'fr', proxyUrl = null) {
    const domain = getDomain(country);
    log.info(`Creating session for ${domain}...${proxyUrl ? ' (via proxy)' : ''}`);
    const startTime = Date.now();

    // ── Method 1: got-scraping fetch via proxy (residential = no CF block) ──
    if (proxyUrl) {
      try {
        const session = await this.createSessionViaFetch(country, { proxyUrl });
        if (session) {
          session.proxyUrl = proxyUrl; // Remember which proxy created this session
          const elapsed = Date.now() - startTime;
          log.info(`Session ${session.id} created via FETCH+PROXY in ${elapsed}ms`);
          return session;
        }
      } catch (error) {
        log.warn(`Fetch via proxy failed: ${error.message}`);
      }
    }

    // ── Method 2: got-scraping fetch direct (works on residential IPs) ──
    try {
      const session = await this.createSessionViaFetch(country);
      if (session) {
        const elapsed = Date.now() - startTime;
        log.info(`Session ${session.id} created via FETCH in ${elapsed}ms`);
        return session;
      }
    } catch (error) {
      log.warn(`Fetch attempt 1 failed: ${error.message}`);
    }

    // ── Method 3: got-scraping with alternate UA ──
    try {
      const session = await this.createSessionViaFetch(country, { alternate: true });
      if (session) {
        const elapsed = Date.now() - startTime;
        log.info(`Session ${session.id} created via FETCH (alt) in ${elapsed}ms`);
        return session;
      }
    } catch (error) {
      log.warn(`Fetch attempt 2 (alt) failed: ${error.message}`);
    }

    // ── Method 3: FlareSolverr (CF bypass) ──
    try {
      const session = await this.createSessionViaFlaresolverr(country);
      if (session) {
        const elapsed = Date.now() - startTime;
        log.info(`Session ${session.id} created via FLARESOLVERR in ${elapsed}ms`);
        return session;
      }
    } catch (error) {
      log.warn(`FlareSolverr failed: ${error.message} — trying Playwright`);
    }

    // ── Method 4: Playwright browser (last resort) ──
    try {
      const session = await this.createSessionViaBrowser(country);
      const elapsed = Date.now() - startTime;
      log.info(`Session ${session.id} created via BROWSER in ${elapsed}ms`);
      return session;
    } catch (error) {
      log.error(`All 4 methods failed for ${country}: ${error.message}`);
      throw error;
    }
  }

  /**
   * REFRESH an existing session — get fresh token without destroying session.
   *
   * STRATEGY (adapts to how the session was originally created):
   * 1. Try got-scraping fetch with existing cookies (instant, ~1s)
   * 2. If 403 → use FlareSolverr (same method that created the session)
   * 3. Return true/false — never throws
   */
  async refreshSession(session) {
    const startTime = Date.now();
    log.info(`Refreshing session ${session.id} (original method: ${session.method})...`);

    // ── Step 1: Try got-scraping fetch (fast path) ──
    const fetchResult = await this._refreshViaFetch(session);
    if (fetchResult) {
      const elapsed = Date.now() - startTime;
      log.info(`Session ${session.id} refreshed via FETCH in ${elapsed}ms`);
      return true;
    }

    // ── Step 2: Fetch failed (403) → use FlareSolverr ──
    log.info(`Fetch refresh failed for ${session.id}, trying FlareSolverr...`);
    const fsResult = await this._refreshViaFlaresolverr(session);
    if (fsResult) {
      const elapsed = Date.now() - startTime;
      log.info(`Session ${session.id} refreshed via FLARESOLVERR in ${elapsed}ms`);
      return true;
    }

    log.warn(`All refresh methods failed for ${session.id}`);
    return false;
  }

  /**
   * Refresh via got-scraping — fast path (~1s).
   * Works when Cloudflare doesn't challenge (rare on datacenter IPs).
   */
  async _refreshViaFetch(session) {
    try {
      const { gotScraping } = await import('got-scraping');
      const baseUrl = getBaseUrl(session.country);

      const response = await gotScraping({
        url: baseUrl,
        headers: {
          'User-Agent': session.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': getAcceptLangForCountry(session.country),
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'DNT': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'Cookie': session.cookieString,
        },
        followRedirect: true,
        timeout: { request: 15_000 },
        throwHttpErrors: false,
      });

      if (response.statusCode >= 400) {
        log.debug(`Fetch refresh got ${response.statusCode}`);
        return false;
      }

      return this._applyRefreshResponse(session, response);
    } catch (error) {
      log.debug(`Fetch refresh error: ${error.message}`);
      return false;
    }
  }

  /**
   * Refresh via FlareSolverr — reliable path (~15-20s).
   * Solves Cloudflare challenge and extracts fresh cookies.
   */
  async _refreshViaFlaresolverr(session) {
    try {
      const flaresolverrUrl = process.env.FLARESOLVERR_URL || 'http://flaresolverr:8191/v1';
      const baseUrl = getBaseUrl(session.country);

      const response = await fetch(flaresolverrUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cmd: 'request.get',
          url: baseUrl,
          maxTimeout: 60000,
        }),
        signal: AbortSignal.timeout(65000),
      });

      const data = await response.json();
      if (data.status !== 'ok' || !data.solution?.cookies?.length) {
        log.debug(`FlareSolverr refresh failed: ${data.status}`);
        return false;
      }

      const cookieJar = {};
      const parsedCookies = [];
      for (const c of data.solution.cookies) {
        cookieJar[c.name] = c.value;
        parsedCookies.push({
          name: c.name,
          value: c.value,
          domain: c.domain || `.${session.domain.replace('www.', '')}`,
        });
      }

      const newAccessToken = cookieJar['access_token_web'];
      if (!newAccessToken) {
        log.debug(`FlareSolverr refresh: no access_token_web`);
        return false;
      }

      // Extract CSRF from HTML
      let csrfToken = session.csrfToken;
      if (data.solution.response) {
        const csrfMatch = data.solution.response.match(/csrf-token['"]\s*content=['"](.*?)['"]/);
        if (csrfMatch) csrfToken = csrfMatch[1];
      }

      // Update session in-place
      session.accessToken = newAccessToken;
      session.refreshToken = cookieJar['refresh_token_web'] || session.refreshToken;
      session.datadomeToken = cookieJar['datadome'] || session.datadomeToken;
      session.csrfToken = csrfToken;
      session.cookies = parsedCookies;
      session.cookieString = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');
      session.lastRefreshedAt = Date.now();
      session.errors = 0;
      session.emptyResponseCount = 0;
      if (csrfToken) session.headers['X-CSRF-Token'] = csrfToken;
      // Update UA if FlareSolverr returned one
      if (data.solution.userAgent) {
        session.userAgent = data.solution.userAgent;
        session.headers['User-Agent'] = data.solution.userAgent;
      }

      // Validate
      const testOk = await this.testSession(session);
      return testOk;
    } catch (error) {
      log.debug(`FlareSolverr refresh error: ${error.message}`);
      return false;
    }
  }

  /**
   * Apply refresh response cookies to session (used by fetch path).
   */
  _applyRefreshResponse(session, response) {
    const setCookieHeaders = response.headers['set-cookie'];
    if (!setCookieHeaders) return false;

    const cookieArray = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    const cookieJar = {};
    const parsedCookies = [];

    for (const cookieStr of cookieArray) {
      const nameValue = cookieStr.split(';')[0];
      const eqIdx = nameValue.indexOf('=');
      if (eqIdx === -1) continue;
      const name = nameValue.slice(0, eqIdx).trim();
      const value = nameValue.slice(eqIdx + 1).trim();
      parsedCookies.push({ name, value, domain: `.${session.domain.replace('www.', '')}` });
      cookieJar[name] = value;
    }

    const newAccessToken = cookieJar['access_token_web'];
    if (!newAccessToken) return false;

    let csrfToken = session.csrfToken;
    if (response.body) {
      const body = typeof response.body === 'string' ? response.body : response.body.toString();
      const csrfMatch = body.match(/csrf-token['"]\s*content=['"](.*?)['"]/);
      if (csrfMatch) csrfToken = csrfMatch[1];
    }

    // Update session in-place
    session.accessToken = newAccessToken;
    session.refreshToken = cookieJar['refresh_token_web'] || session.refreshToken;
    session.datadomeToken = cookieJar['datadome'] || session.datadomeToken;
    session.csrfToken = csrfToken;
    session.cookies = parsedCookies;
    session.cookieString = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');
    session.lastRefreshedAt = Date.now();
    session.errors = 0;
    session.emptyResponseCount = 0;
    if (csrfToken) session.headers['X-CSRF-Token'] = csrfToken;

    return true;
  }

  /**
   * METHOD 1: Simple HTTP fetch — fast, no browser needed.
   *
   * @param {string} country
   * @param {Object} options
   * @param {boolean} options.alternate - Use alternate fingerprint
   */
  async createSessionViaFetch(country, { alternate = false, proxyUrl = null } = {}) {
    const { gotScraping } = await import('got-scraping');

    const domain = getDomain(country);
    const baseUrl = getBaseUrl(country);
    const userAgent = alternate ? getAlternateUserAgent() : getRandomUserAgent();

    const options = {
      url: baseUrl,
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': getAcceptLangForCountry(country),
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'DNT': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        ...(alternate && {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        }),
      },
      followRedirect: true,
      timeout: { request: 15_000 },
      throwHttpErrors: false,
    };

    // Route through residential proxy if available
    if (proxyUrl) {
      options.proxyUrl = proxyUrl;
      log.debug(`Fetch via proxy: ${proxyUrl.replace(/:[^:]+@/, ':***@')}`);
    }

    const response = await gotScraping(options);

    if (response.statusCode >= 400) {
      throw new Error(`Homepage returned ${response.statusCode}`);
    }

    // Extract ALL cookies
    const setCookieHeaders = response.headers['set-cookie'];
    if (!setCookieHeaders) {
      throw new Error('No Set-Cookie headers in response');
    }

    const cookieArray = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    const parsedCookies = [];
    const cookieJar = {};

    for (const cookieStr of cookieArray) {
      const nameValue = cookieStr.split(';')[0];
      const eqIdx = nameValue.indexOf('=');
      if (eqIdx === -1) continue;
      const name = nameValue.slice(0, eqIdx).trim();
      const value = nameValue.slice(eqIdx + 1).trim();
      parsedCookies.push({ name, value, domain: `.${domain.replace('www.', '')}` });
      cookieJar[name] = value;
    }

    log.debug(`Cookies received: ${Object.keys(cookieJar).join(', ')}`);

    const accessToken = cookieJar['access_token_web'];
    if (!accessToken) {
      throw new Error(`access_token_web not found. Got: ${Object.keys(cookieJar).join(', ')}`);
    }

    log.info(`Got access_token_web (${accessToken.length} chars), datadome: ${!!cookieJar['datadome']}`);

    // Extract CSRF token from HTML
    let csrfToken = null;
    if (response.body) {
      const body = typeof response.body === 'string' ? response.body : response.body.toString();
      const csrfMatch = body.match(/csrf-token['"]\s*content=['"](.*?)['"]/);
      if (csrfMatch) csrfToken = csrfMatch[1];
    }

    // Build cookie string
    const cookieString = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');

    const session = {
      id: `${country}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      country,
      domain,
      method: alternate ? 'fetch-alt' : 'fetch',
      cookies: parsedCookies,
      cookieString,
      accessToken,
      refreshToken: cookieJar['refresh_token_web'] || null,
      datadomeToken: cookieJar['datadome'] || null,
      csrfToken,
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': getAcceptLangForCountry(country),
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Referer': baseUrl + '/',
        'Origin': baseUrl,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
      },
      userAgent,
      createdAt: Date.now(),
      lastRefreshedAt: Date.now(),
      requestCount: 0,
      emptyResponseCount: 0,
      errors: 0,
      alive: true,
    };

    // Validate with test API call
    const testOk = await this.testSession(session);
    if (!testOk) {
      log.warn('Fetch session failed API validation');
      return null;
    }

    return session;
  }

  /**
   * METHOD 3: FlareSolverr — solves Cloudflare challenges.
   */
  async createSessionViaFlaresolverr(country) {
    const flaresolverrUrl = process.env.FLARESOLVERR_URL || 'http://flaresolverr:8191/v1';
    const domain = getDomain(country);
    const baseUrl = getBaseUrl(country);

    let data;
    for (let attempt = 1; attempt <= 6; attempt++) {
      try {
        const response = await fetch(flaresolverrUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cmd: 'request.get',
            url: baseUrl,
            maxTimeout: 60000,
          }),
          signal: AbortSignal.timeout(65000),
        });
        data = await response.json();
        break;
      } catch (err) {
        if (attempt < 6) {
          const delay = Math.min(attempt * 5, 15);
          log.info(`FlareSolverr not ready (attempt ${attempt}/6), waiting ${delay}s...`);
          await new Promise(r => setTimeout(r, delay * 1000));
        } else {
          throw err;
        }
      }
    }

    if (data.status !== 'ok') {
      throw new Error(`FlareSolverr status: ${data.status} — ${data.message || 'unknown'}`);
    }

    const solution = data.solution;
    if (!solution?.cookies?.length) {
      throw new Error('FlareSolverr returned no cookies');
    }

    const cookieJar = {};
    const parsedCookies = [];
    for (const c of solution.cookies) {
      cookieJar[c.name] = c.value;
      parsedCookies.push({ name: c.name, value: c.value, domain: c.domain || `.${domain.replace('www.', '')}` });
    }

    const accessToken = cookieJar['access_token_web'];
    if (!accessToken) {
      throw new Error(`No access_token_web from FlareSolverr. Got: ${Object.keys(cookieJar).join(', ')}`);
    }

    let csrfToken = null;
    if (solution.response) {
      const csrfMatch = solution.response.match(/csrf-token['"]\s*content=['"](.*?)['"]/);
      if (csrfMatch) csrfToken = csrfMatch[1];
    }

    const userAgent = solution.userAgent || getRandomUserAgent();
    const cookieString = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');

    const session = {
      id: `${country}-fs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      country,
      domain,
      method: 'flaresolverr',
      cookies: parsedCookies,
      cookieString,
      accessToken,
      refreshToken: cookieJar['refresh_token_web'] || null,
      datadomeToken: cookieJar['datadome'] || null,
      csrfToken,
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': getAcceptLangForCountry(country),
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Referer': baseUrl + '/',
        'Origin': baseUrl,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
      },
      userAgent,
      createdAt: Date.now(),
      lastRefreshedAt: Date.now(),
      requestCount: 0,
      emptyResponseCount: 0,
      errors: 0,
      alive: true,
    };

    const testOk = await this.testSession(session);
    if (!testOk) {
      log.warn('FlareSolverr session failed API validation');
      return null;
    }

    return session;
  }

  /**
   * METHOD 4: Full Playwright browser — last resort.
   */
  async createSessionViaBrowser(country) {
    const domain = getDomain(country);
    const baseUrl = getBaseUrl(country);
    let context = null;

    try {
      if (this.browser) {
        try { await this.browser.close(); } catch {}
        this.browser = null;
      }
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-setuid-sandbox',
          '--disable-infobars',
          '--window-size=1920,1080',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          `--lang=${getLocaleForCountry(country)}`,
        ],
      });

      const userAgent = getRandomUserAgent();
      context = await this.browser.newContext({
        userAgent,
        viewport: { width: 1920, height: 1080 },
        locale: getLocaleForCountry(country),
        timezoneId: getTimezoneForCountry(country),
        extraHTTPHeaders: {
          'Accept-Language': getAcceptLangForCountry(country),
        },
        permissions: ['geolocation'],
        colorScheme: 'light',
      });

      const page = await context.newPage();

      // Anti-detection
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', {
          get: () => {
            const plugins = [
              { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
              { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
              { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
            ];
            plugins.length = 3;
            return plugins;
          },
        });
        Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
        delete navigator.__proto__.webdriver;
        window.chrome = { runtime: {}, loadTimes: () => ({}), csi: () => ({}) };
        const origQuery = window.navigator.permissions?.query?.bind(window.navigator.permissions);
        if (origQuery) {
          window.navigator.permissions.query = (params) => {
            if (params.name === 'notifications') {
              return Promise.resolve({ state: Notification.permission });
            }
            return origQuery(params);
          };
        }
      });

      await page.goto(baseUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.session.browserTimeout,
      });

      await this.waitForProtection(page, domain);
      await this.handleCookieConsent(page);
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

      const cookies = await context.cookies();
      const accessTokenCookie = cookies.find(c => c.name === 'access_token_web');

      if (!accessTokenCookie) {
        throw new Error(`No access_token_web found. Got: ${cookies.map(c => c.name).join(', ')}`);
      }

      const csrfToken = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : null;
      });

      const cookieString = cookies
        .filter(c => {
          const cd = c.domain.replace(/^\./, '');
          return domain.includes(cd) || cd.includes('vinted');
        })
        .map(c => `${c.name}=${c.value}`)
        .join('; ');

      return {
        id: `${country}-br-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        country,
        domain,
        method: 'browser',
        cookies: cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain })),
        cookieString,
        accessToken: accessTokenCookie.value,
        refreshToken: cookies.find(c => c.name === 'refresh_token_web')?.value || null,
        datadomeToken: cookies.find(c => c.name === 'datadome')?.value || null,
        cfClearance: cookies.find(c => c.name === 'cf_clearance')?.value || null,
        csrfToken,
        headers: {
          'User-Agent': userAgent,
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': getAcceptLangForCountry(country),
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Referer': getBaseUrl(country) + '/',
          'Origin': getBaseUrl(country),
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        userAgent,
        createdAt: Date.now(),
        lastRefreshedAt: Date.now(),
        requestCount: 0,
        emptyResponseCount: 0,
        errors: 0,
        alive: true,
      };
    } finally {
      if (context) await context.close().catch(() => {});
    }
  }

  /**
   * Create authenticated session (for autobuy).
   */
  async createAuthenticatedSession(country, email, password) {
    const domain = getDomain(country);
    const baseUrl = getBaseUrl(country);
    let context = null;

    log.info(`Creating authenticated session for ${domain}...`);

    try {
      if (!this.browser) {
        this.browser = await chromium.launch({
          headless: true,
          args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
        });
      }

      context = await this.browser.newContext({
        userAgent: getRandomUserAgent(),
        viewport: { width: 1920, height: 1080 },
        locale: getLocaleForCountry(country),
        timezoneId: getTimezoneForCountry(country),
      });

      const page = await context.newPage();
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      });

      await page.goto(baseUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.session.browserTimeout,
      });

      await this.waitForProtection(page, domain);
      await this.handleCookieConsent(page);

      const loginBtn = page.locator('[data-testid="header--login-button"], a[href*="login"], button:has-text("Se connecter"), button:has-text("Log in")');
      if (await loginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await loginBtn.click();
        await page.waitForTimeout(2000);
      }

      const emailInput = page.locator('input[type="email"], input[name="email"], #email');
      await emailInput.waitFor({ timeout: 10_000 });
      await emailInput.fill(email);

      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      await passwordInput.fill(password);

      const submitBtn = page.locator('button[type="submit"], button:has-text("Se connecter"), button:has-text("Log in"), button:has-text("Continue")');
      await submitBtn.click();

      await page.waitForNavigation({ timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(3000);

      const cookies = await context.cookies();
      const userAgent = await page.evaluate(() => navigator.userAgent);
      const csrfToken = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : null;
      });

      const accessTokenCookie = cookies.find(c => c.name === 'access_token_web');
      const cookieParts = cookies
        .filter(c => domain.includes(c.domain.replace(/^\./, '').replace('www.', '')))
        .map(c => `${c.name}=${c.value}`);

      return {
        id: `auth-${country}-${Date.now()}`,
        country,
        domain,
        method: 'browser-auth',
        cookies: cookies.map(c => ({ name: c.name, value: c.value, domain: c.domain })),
        cookieString: cookieParts.join('; '),
        accessToken: accessTokenCookie?.value || null,
        csrfToken,
        headers: {
          'User-Agent': userAgent,
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': getAcceptLangForCountry(country),
          'Referer': baseUrl + '/',
          'Origin': baseUrl,
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        userAgent,
        authenticated: true,
        createdAt: Date.now(),
        lastRefreshedAt: Date.now(),
        requestCount: 0,
        emptyResponseCount: 0,
        errors: 0,
        alive: true,
      };
    } catch (error) {
      log.error(`Auth session failed: ${error.message}`);
      throw error;
    } finally {
      if (context) await context.close().catch(() => {});
    }
  }

  /**
   * Validate a session by making a test API call using Bearer token.
   */
  async testSession(session) {
    try {
      const { gotScraping } = await import('got-scraping');
      const testUrl = `https://${session.domain}/api/v2/catalog/items?per_page=1`;

      const response = await gotScraping({
        url: testUrl,
        headers: {
          ...session.headers,
          'Cookie': session.cookieString,
          // Also try Bearer token — this is the v3 approach
          ...(session.accessToken && { 'Authorization': `Bearer ${session.accessToken}` }),
        },
        responseType: 'json',
        throwHttpErrors: false,
        timeout: { request: 10_000 },
      });

      if (response.statusCode === 200 && response.body?.items) {
        log.debug(`Session ${session.id} validated OK (${response.body.items.length} items)`);
        return true;
      }

      log.debug(`Session test: status=${response.statusCode}, hasItems=${!!response.body?.items}`);
      return false;
    } catch (error) {
      log.debug(`Session test failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Wait for Datadome / Cloudflare to resolve.
   */
  async waitForProtection(page, domain) {
    const maxWait = 30_000;
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      const title = await page.title();

      if (
        title.includes('Just a moment') ||
        title.includes('Checking') ||
        title.includes('Attention Required') ||
        title.includes('Geo compliance')
      ) {
        log.debug('Protection challenge in progress...');
        await page.waitForTimeout(2000);
        continue;
      }

      if (page.url().includes(domain.replace('www.', ''))) {
        const context = page.context();
        const cookies = await context.cookies();
        const hasAccessToken = cookies.some(c => c.name === 'access_token_web');
        if (hasAccessToken) {
          log.debug('Protection resolved + access_token_web found');
          return;
        }
        log.debug('On Vinted but no access_token_web yet, waiting...');
        await page.waitForTimeout(2000);
        continue;
      }

      await page.waitForTimeout(1000);
    }

    log.warn('Protection wait timeout (30s)');
  }

  async handleCookieConsent(page) {
    try {
      const selectors = [
        '#onetrust-reject-all-handler',
        '#onetrust-accept-btn-handler',
        '[data-testid="cookie-consent-accept"]',
        'button:has-text("Tout refuser")',
        'button:has-text("Reject all")',
        'button:has-text("Accepter")',
      ];

      for (const sel of selectors) {
        const btn = page.locator(sel);
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await btn.click();
          log.debug('Cookie consent dismissed');
          await page.waitForTimeout(500);
          return;
        }
      }
    } catch { /* not critical */ }
  }

  async close() {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}

// ── Helpers ──

function getRandomUserAgent() {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Safari/605.1.15',
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

/**
 * Alternate User-Agents — different browser family for retry.
 * If Chrome UA fails, try Edge/Brave/Opera style.
 */
function getAlternateUserAgent() {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 OPR/120.0.0.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Brave/136',
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

function getLocaleForCountry(country) {
  const map = { fr: 'fr-FR', de: 'de-DE', es: 'es-ES', it: 'it-IT', nl: 'nl-NL', be: 'fr-BE', pt: 'pt-PT', pl: 'pl-PL', lt: 'lt-LT', cz: 'cs-CZ', at: 'de-AT', uk: 'en-GB', us: 'en-US' };
  return map[country] || 'fr-FR';
}

function getTimezoneForCountry(country) {
  const map = { fr: 'Europe/Paris', de: 'Europe/Berlin', es: 'Europe/Madrid', it: 'Europe/Rome', nl: 'Europe/Amsterdam', be: 'Europe/Brussels', pt: 'Europe/Lisbon', pl: 'Europe/Warsaw', lt: 'Europe/Vilnius', cz: 'Europe/Prague', at: 'Europe/Vienna', uk: 'Europe/London', us: 'America/New_York' };
  return map[country] || 'Europe/Paris';
}

function getAcceptLangForCountry(country) {
  const map = { fr: 'fr-FR,fr;q=0.9,en;q=0.8', de: 'de-DE,de;q=0.9,en;q=0.8', es: 'es-ES,es;q=0.9,en;q=0.8', it: 'it-IT,it;q=0.9,en;q=0.8', nl: 'nl-NL,nl;q=0.9,en;q=0.8', uk: 'en-GB,en;q=0.9', us: 'en-US,en;q=0.9' };
  return map[country] || 'fr-FR,fr;q=0.9,en;q=0.8';
}
