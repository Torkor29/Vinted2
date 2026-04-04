import { request } from 'undici';
import pino from 'pino';
import { config } from '../config.js';
import { getUserAgentForProxy } from './user-agent.js';
import type { ProxyConfig } from './proxy-manager.js';

const logger = pino({ name: 'cookie-manager' });

interface CookieEntry {
  value: string;
  csrfToken: string;
  expiresAt: number;
}

const COOKIE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const cookieStore = new Map<string, CookieEntry>();
let renewalInterval: ReturnType<typeof setInterval> | null = null;

export async function fetchCookie(proxy: ProxyConfig | null): Promise<CookieEntry> {
  const proxyKey = proxy?.key ?? 'direct';
  const cached = cookieStore.get(proxyKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  return renewCookie(proxy);
}

export async function renewCookie(proxy: ProxyConfig | null): Promise<CookieEntry> {
  const proxyKey = proxy?.key ?? 'direct';
  const domain = config.VINTED_DOMAIN;
  const url = `https://${domain}`;

  try {
    const response = await request(url, {
      method: 'GET',
      dispatcher: proxy?.agent,
      headers: {
        'User-Agent': getUserAgentForProxy(proxyKey),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    // Extract cookies from set-cookie headers
    const setCookieHeaders = response.headers['set-cookie'];
    const cookies: string[] = [];
    let csrfToken = '';

    if (setCookieHeaders) {
      const cookieArray = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];

      for (const cookie of cookieArray) {
        const nameValue = cookie.split(';')[0];
        if (nameValue) {
          cookies.push(nameValue);

          // Extract CSRF token from cookie
          if (nameValue.startsWith('_csrf_token=') || nameValue.startsWith('csrf_token=')) {
            csrfToken = nameValue.split('=').slice(1).join('=');
          }
        }
      }
    }

    // Also try to extract CSRF from response body
    if (!csrfToken) {
      const body = await response.body.text();
      const csrfMatch = body.match(/<meta\s+name="csrf-token"\s+content="([^"]+)"/);
      if (csrfMatch?.[1]) {
        csrfToken = csrfMatch[1];
      }
    } else {
      // Consume body to free resources
      await response.body.text();
    }

    const entry: CookieEntry = {
      value: cookies.join('; '),
      csrfToken,
      expiresAt: Date.now() + COOKIE_TTL_MS,
    };

    cookieStore.set(proxyKey, entry);
    logger.debug(`Cookie refreshed for proxy ${proxyKey}`);

    return entry;
  } catch (err) {
    logger.error({ err, proxyKey }, 'Failed to fetch cookie');
    // Return stale cookie if available
    const stale = cookieStore.get(proxyKey);
    if (stale) {
      return stale;
    }
    throw err;
  }
}

export function startCookieRenewal(getProxies: () => (ProxyConfig | null)[]): void {
  if (renewalInterval) return;

  renewalInterval = setInterval(async () => {
    const proxies = getProxies();
    for (const proxy of proxies) {
      try {
        await renewCookie(proxy);
      } catch {
        // Already logged in renewCookie
      }
    }
  }, COOKIE_TTL_MS - 60_000); // Renew 1 minute before expiry
}

export function stopCookieRenewal(): void {
  if (renewalInterval) {
    clearInterval(renewalInterval);
    renewalInterval = null;
  }
}

export function clearCookies(): void {
  cookieStore.clear();
}
