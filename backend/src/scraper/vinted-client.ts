import { request } from 'undici';
import pino from 'pino';
import { config } from '../config.js';
import { fetchCookie, renewCookie } from './cookie-manager.js';
import { getNextProxy, markProxyFailed, markProxySuccess, type ProxyConfig } from './proxy-manager.js';
import { getUserAgentForProxy } from './user-agent.js';
import { RateLimiter } from './rate-limiter.js';
import { buildSearchUrl } from './catalog-params.js';
import { parseSearchResponse } from './parser.js';
import type { VintedSearchParams, VintedCatalogResponse } from '../types/vinted.js';

const logger = pino({ name: 'vinted-client' });
const rateLimiter = new RateLimiter(0.5); // 1 request per 2 seconds per proxy

const MAX_RETRIES = 3;

export async function searchVinted(params: VintedSearchParams): Promise<VintedCatalogResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const proxy = getNextProxy();
    const proxyKey = proxy?.key ?? 'direct';

    try {
      // Rate limit per proxy
      await rateLimiter.acquire(proxyKey);

      // Get or refresh cookie for this proxy
      const cookie = await fetchCookie(proxy);

      const url = buildSearchUrl(config.VINTED_DOMAIN, params);

      const startTime = Date.now();

      const response = await request(url, {
        method: 'GET',
        dispatcher: proxy?.agent,
        headers: {
          'User-Agent': getUserAgentForProxy(proxyKey),
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          'Referer': `https://${config.VINTED_DOMAIN}/`,
          'Origin': `https://${config.VINTED_DOMAIN}`,
          'Cookie': cookie.value,
          ...(cookie.csrfToken ? { 'X-CSRF-Token': cookie.csrfToken } : {}),
          'Connection': 'keep-alive',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
        },
        headersTimeout: 10_000,
        bodyTimeout: 10_000,
      });

      const latency = Date.now() - startTime;

      if (response.statusCode === 403 || response.statusCode === 429) {
        await response.body.text(); // consume body
        logger.warn({ statusCode: response.statusCode, proxy: proxyKey, latency },
          'Rate limited or blocked, rotating proxy');

        if (proxy) {
          markProxyFailed(proxy);
        }

        // Force cookie renewal on next attempt
        await renewCookie(proxy);
        lastError = new Error(`HTTP ${response.statusCode}`);
        continue;
      }

      if (response.statusCode !== 200) {
        const body = await response.body.text();
        logger.warn({ statusCode: response.statusCode, proxy: proxyKey, body: body.slice(0, 200) },
          'Unexpected status code');
        lastError = new Error(`HTTP ${response.statusCode}`);
        continue;
      }

      const data = await response.body.json();

      if (proxy) {
        markProxySuccess(proxy);
      }

      logger.debug({ proxy: proxyKey, latency, itemCount: (data as Record<string, unknown[]>).items?.length },
        'Search completed');

      return parseSearchResponse(data);

    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn({ err: lastError.message, proxy: proxyKey, attempt },
        'Search request failed');

      if (proxy) {
        markProxyFailed(proxy);
      }
    }
  }

  throw lastError ?? new Error('Search failed after max retries');
}

export async function fetchBrands(query: string): Promise<Array<{ id: number; title: string }>> {
  const proxy = getNextProxy();
  const proxyKey = proxy?.key ?? 'direct';

  try {
    await rateLimiter.acquire(proxyKey);
    const cookie = await fetchCookie(proxy);

    const url = `https://${config.VINTED_DOMAIN}/api/v2/catalog/brands?keyword=${encodeURIComponent(query)}&per_page=20`;

    const response = await request(url, {
      method: 'GET',
      dispatcher: proxy?.agent,
      headers: {
        'User-Agent': getUserAgentForProxy(proxyKey),
        'Accept': 'application/json',
        'Cookie': cookie.value,
        ...(cookie.csrfToken ? { 'X-CSRF-Token': cookie.csrfToken } : {}),
        'Referer': `https://${config.VINTED_DOMAIN}/`,
      },
      headersTimeout: 10_000,
      bodyTimeout: 10_000,
    });

    if (response.statusCode !== 200) {
      await response.body.text();
      return [];
    }

    const data = await response.body.json() as { brands?: Array<{ id: number; title: string }> };
    return data.brands ?? [];
  } catch (err) {
    logger.warn({ err }, 'Failed to fetch brands');
    return [];
  }
}

export async function fetchCatalogInitializers(): Promise<unknown> {
  const proxy = getNextProxy();
  const proxyKey = proxy?.key ?? 'direct';

  try {
    await rateLimiter.acquire(proxyKey);
    const cookie = await fetchCookie(proxy);

    const url = `https://${config.VINTED_DOMAIN}/api/v2/catalog/initializers`;

    const response = await request(url, {
      method: 'GET',
      dispatcher: proxy?.agent,
      headers: {
        'User-Agent': getUserAgentForProxy(proxyKey),
        'Accept': 'application/json',
        'Cookie': cookie.value,
        ...(cookie.csrfToken ? { 'X-CSRF-Token': cookie.csrfToken } : {}),
        'Referer': `https://${config.VINTED_DOMAIN}/`,
      },
      headersTimeout: 15_000,
      bodyTimeout: 15_000,
    });

    if (response.statusCode !== 200) {
      await response.body.text();
      return null;
    }

    return await response.body.json();
  } catch (err) {
    logger.warn({ err }, 'Failed to fetch catalog initializers');
    return null;
  }
}
