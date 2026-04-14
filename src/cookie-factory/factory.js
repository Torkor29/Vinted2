import { chromium } from 'playwright';
import { createLogger } from '../utils/logger.js';
import { getDomain, getBaseUrl } from '../config.js';

const log = createLogger('cookie-factory');

/**
 * CookieFactory v2 - Creates valid Vinted sessions.
 *
 * ═══════════════════════════════════════════════════════════
 *  WHAT THE RESEARCH REVEALED (March 2026)
 * ═══════════════════════════════════════════════════════════
 *
 * Vinted auth has TWO distinct flows:
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │ WEB FLOW (Datadome protected)                          │
 * │                                                         │
 * │ 1. GET https://www.vinted.fr/                          │
 * │    → Set-Cookie: _vinted_fr_session=xxx                │
 * │    → Set-Cookie: access_token_web=JWT (2h lifetime)    │
 * │    → Set-Cookie: refresh_token_web=xxx                 │
 * │    → Set-Cookie: datadome=xxx                          │
 * │    → HTML contains: <meta name="csrf-token" content=>  │
 * │                                                         │
 * │ 2. API calls need:                                      │
 * │    Cookie: _vinted_fr_session=xxx                      │
 * │    (access_token_web is in the cookie jar too)         │
 * │    X-CSRF-Token: from HTML meta tag                    │
 * │                                                         │
 * │ 3. Datadome validates the request                      │
 * │    → If bot detected: silent empty response or 403     │
 * └─────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │ MOBILE APP FLOW (NO Datadome!)                         │
 * │                                                         │
 * │ - Same /api/v2/ endpoints                              │
 * │ - Authorization: Bearer <token> in header              │
 * │ - Token from website cookies works for app too         │
 * │ - No Datadome cookie needed                            │
 * │ - Much easier to scrape!                               │
 * └─────────────────────────────────────────────────────────┘
 *
 * STRATEGY:
 * - PRIMARY: Simple HTTP fetch to vinted homepage → extract
 *   _vinted_XX_session cookie → use for API calls
 *   (This is what Androz2091/vinted-api does successfully)
 *
 * - FALLBACK: Full Playwright browser if simple fetch fails
 *   (Solves Datadome challenge via real browser)
 *
 * - BONUS: Extract access_token_web JWT for mobile endpoints
 *   (No Datadome protection on mobile API!)
 */
export class CookieFactory {
  constructor(config) {
    this.config = config;
    this.browser = null;
  }

  /**
   * Create a session. Tries 3 methods in order:
   * 1. Simple fetch (fastest, works when CF isn't blocking)
   * 2. FlareSolverr (solves CF challenges via undetected browser)
   * 3. Playwright browser (last resort)
   */
  async createSession(country = 'fr') {
    const domain = getDomain(country);
    log.info(`Creating session for ${domain}...`);
    const startTime = Date.now();

    // ── Method 1: Simple fetch ──
    try {
      const session = await this.createSessionViaFetch(country);
      if (session) {
        const elapsed = Date.now() - startTime;
        log.info(`Session ${session.id} created via FETCH in ${elapsed}ms`);
        return session;
      }
    } catch (error) {
      log.warn(`Fetch failed: ${error.message} — trying FlareSolverr`);
    }

    // ── Method 2: FlareSolverr (CF bypass) ──
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

    // ── Method 3: Playwright browser (last resort) ──
    try {
      const session = await this.createSessionViaBrowser(country);
      const elapsed = Date.now() - startTime;
      log.info(`Session ${session.id} created via BROWSER in ${elapsed}ms`);
      return session;
    } catch (error) {
      log.error(`All 3 methods failed for ${country}: ${error.message}`);
      throw error;
    }
  }

  /**
   * METHOD 2: FlareSolverr — solves Cloudflare challenges via undetected browser.
   * Requires FlareSolverr service running (see docker-compose.yml).
   */
  async createSessionViaFlaresolverr(country) {
    const flaresolverrUrl = process.env.FLARESOLVERR_URL || 'http://flaresolverr:8191/v1';
    const domain = getDomain(country);
    const baseUrl = getBaseUrl(country);

    // Retry up to 6 times — FlareSolverr needs 30-60s to start
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
          const delay = Math.min(attempt * 5, 15); // 5s, 10s, 15s, 15s, 15s
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

    // Parse cookies from FlareSolverr response
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

    log.info(`FlareSolverr got access_token_web (${accessToken.length} chars) + ${solution.cookies.length} cookies`);

    // Extract CSRF from HTML
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
      requestCount: 0,
      emptyResponseCount: 0,
      errors: 0,
      alive: true,
    };

    // Validate
    const testOk = await this.testSession(session);
    if (!testOk) {
      log.warn('FlareSolverr session failed API validation');
      return null;
    }

    return session;
  }

  /**
   * METHOD 1: Simple HTTP fetch — fast, no browser needed.
   *
   * UPDATED March 2026: Vinted no longer uses _vinted_XX_session cookie.
   * Current cookies from homepage:
   *   access_token_web  ← JWT (2h lifetime) — THE key auth cookie
   *   refresh_token_web ← For renewing access_token
   *   v_udt             ← User device tracking
   *   anon_id           ← Anonymous identifier
   *   datadome          ← Anti-bot token
   *   __cf_bm           ← Cloudflare bot management
   *   cf_clearance      ← Cloudflare clearance (browser only)
   *
   * The API needs: access_token_web + datadome + v_udt at minimum.
   */
  async createSessionViaFetch(country) {
    const { gotScraping } = await import('got-scraping');

    const domain = getDomain(country);
    const baseUrl = getBaseUrl(country);
    const userAgent = getRandomUserAgent();

    // Step 1: Fetch homepage to get session cookies
    const response = await gotScraping({
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
      },
      followRedirect: true,
      timeout: { request: 15_000 },
      throwHttpErrors: false,
    });

    if (response.statusCode >= 400) {
      throw new Error(`Homepage returned ${response.statusCode}`);
    }

    // Step 2: Extract ALL cookies from Set-Cookie headers
    const setCookieHeaders = response.headers['set-cookie'];
    if (!setCookieHeaders) {
      throw new Error('No Set-Cookie headers in response');
    }

    const cookieArray = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    const parsedCookies = [];
    const cookieJar = {};  // name → value

    for (const cookieStr of cookieArray) {
      const nameValue = cookieStr.split(';')[0];
      const eqIdx = nameValue.indexOf('=');
      if (eqIdx === -1) continue;

      const name = nameValue.slice(0, eqIdx).trim();
      const value = nameValue.slice(eqIdx + 1).trim();

      parsedCookies.push({ name, value, domain: `.${domain.replace('www.', '')}` });
      // Keep last value if duplicate (access_token_web appears twice sometimes)
      cookieJar[name] = value;
    }

    log.debug(`Cookies received: ${Object.keys(cookieJar).join(', ')}`);

    // Step 3: Validate we have the essential cookies
    const accessToken = cookieJar['access_token_web'];
    const refreshToken = cookieJar['refresh_token_web'];
    const datadomeToken = cookieJar['datadome'];
    const vUdt = cookieJar['v_udt'];
    const anonId = cookieJar['anon_id'];
    const cfBm = cookieJar['__cf_bm'];

    if (!accessToken) {
      throw new Error(`access_token_web not found. Got cookies: ${Object.keys(cookieJar).join(', ')}`);
    }

    log.info(`Got access_token_web (${accessToken.length} chars), datadome: ${!!datadomeToken}, v_udt: ${!!vUdt}`);

    // Step 4: Extract CSRF token from HTML body (if present)
    let csrfToken = null;
    if (response.body) {
      const body = typeof response.body === 'string' ? response.body : response.body.toString();
      const csrfMatch = body.match(/csrf-token['"]\s*content=['"](.*?)['"]/);
      if (csrfMatch) {
        csrfToken = csrfMatch[1];
        log.debug('Extracted CSRF token from HTML');
      }
    }

    // Step 5: Build cookie string with ALL cookies (order matters)
    // Include everything — Vinted may validate the full jar
    const cookieString = Object.entries(cookieJar)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

    // Step 6: Build session object
    const session = {
      id: `${country}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      country,
      domain,
      method: 'fetch',
      cookies: parsedCookies,
      cookieString,
      accessToken,
      refreshToken,
      datadomeToken,
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
      requestCount: 0,
      emptyResponseCount: 0,
      errors: 0,
      alive: true,
    };

    // Step 7: Validate with a test API call
    const testOk = await this.testSession(session);
    if (!testOk) {
      log.warn('Fetch session failed API validation, will try browser method');
      return null;
    }

    return session;
  }

  /**
   * METHOD 2: Full Playwright browser — slower but bypasses Datadome.
   *
   * Used when simple fetch fails (Datadome blocks the request).
   * The real browser solves the JS challenge automatically.
   */
  async createSessionViaBrowser(country) {
    const domain = getDomain(country);
    const baseUrl = getBaseUrl(country);
    let context = null;

    try {
      // Always relaunch browser to avoid stale/closed context errors
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
          '--lang=fr-FR,fr',
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
        // Stealth: pass WebGL and permissions checks
        permissions: ['geolocation'],
        colorScheme: 'light',
      });

      const page = await context.newPage();

      // Comprehensive anti-detection
      await page.addInitScript(() => {
        // Hide webdriver
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        // Fake plugins
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
        // Fake languages
        Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
        // Hide automation
        delete navigator.__proto__.webdriver;
        // Fake Chrome runtime
        window.chrome = { runtime: {}, loadTimes: () => ({}), csi: () => ({}) };
        // Permissions API override
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

      // Navigate
      await page.goto(baseUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.session.browserTimeout,
      });

      // Wait for Datadome/Cloudflare to resolve
      await this.waitForProtection(page, domain);

      // Handle cookie consent
      await this.handleCookieConsent(page);

      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

      // Extract ALL cookies from browser context
      const cookies = await context.cookies();

      // Find critical cookies (new Vinted format: access_token_web is primary)
      const accessTokenCookie = cookies.find(c => c.name === 'access_token_web');
      const datadomeCookie = cookies.find(c => c.name === 'datadome');
      const cfClearance = cookies.find(c => c.name === 'cf_clearance');

      if (!accessTokenCookie) {
        throw new Error(`No access_token_web found. Got: ${cookies.map(c => c.name).join(', ')}`);
      }

      log.info(`Browser got access_token_web + ${cookies.length} total cookies`);

      // Extract CSRF from page
      const csrfToken = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') : null;
      });

      // Build cookie string with ALL cookies
      const cookieString = cookies
        .filter(c => {
          // Only include cookies for this domain
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
        datadomeToken: datadomeCookie?.value || null,
        cfClearance: cfClearance?.value || null,
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
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        userAgent,
        createdAt: Date.now(),
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

      // Login flow
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

      const domainKey = domain.replace('www.vinted.', '').replace(/\./g, '_');
      const sessionCookie = cookies.find(c =>
        c.name.includes('_vinted_') && c.name.includes('_session')
      );
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
        sessionCookieValue: sessionCookie?.value,
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
   * Validate a session by making a test API call.
   */
  async testSession(session) {
    try {
      const { gotScraping } = await import('got-scraping');
      const testUrl = `https://${session.domain}/api/v2/catalog/items?per_page=1`;

      const response = await gotScraping({
        url: testUrl,
        headers: {
          ...session.headers,
          Cookie: session.cookieString,
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
   * Wait for Datadome / Cloudflare / any protection to resolve.
   */
  async waitForProtection(page, domain) {
    const maxWait = 30_000;
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      const title = await page.title();

      // Datadome / Cloudflare challenge pages
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

      // Check if we're on real Vinted
      if (page.url().includes(domain.replace('www.', ''))) {
        // Double-check: wait for access_token_web cookie to appear
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
        '#onetrust-reject-all-handler',           // Reject all (more privacy)
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
