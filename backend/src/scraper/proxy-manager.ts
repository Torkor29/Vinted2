import { ProxyAgent } from 'undici';
import pino from 'pino';
import { config } from '../config.js';

const logger = pino({ name: 'proxy-manager' });

export interface ProxyConfig {
  url: string;
  key: string;
  agent: ProxyAgent;
  failedAt: number | null;
  cooldownUntil: number;
}

const COOLDOWN_MS = 30_000; // 30 seconds cooldown on failure
const proxies: ProxyConfig[] = [];
let currentIndex = 0;

export function initProxies(): void {
  const proxyList = config.PROXY_LIST.split(',').filter(Boolean).map(p => p.trim());

  if (proxyList.length === 0) {
    logger.warn('No proxies configured. Requests will use direct connection.');
    return;
  }

  for (const url of proxyList) {
    proxies.push({
      url,
      key: url.replace(/\/\/.*@/, '//***@'), // Mask credentials for logging
      agent: new ProxyAgent(url),
      failedAt: null,
      cooldownUntil: 0,
    });
  }

  logger.info(`Initialized ${proxies.length} proxies`);
}

export function getNextProxy(): ProxyConfig | null {
  if (proxies.length === 0) return null;

  const now = Date.now();
  const startIndex = currentIndex;

  // Round-robin through healthy proxies
  for (let i = 0; i < proxies.length; i++) {
    const index = (startIndex + i) % proxies.length;
    const proxy = proxies[index]!;

    if (proxy.cooldownUntil <= now) {
      currentIndex = (index + 1) % proxies.length;
      return proxy;
    }
  }

  // All proxies in cooldown — return the one with shortest remaining cooldown
  const sorted = [...proxies].sort((a, b) => a.cooldownUntil - b.cooldownUntil);
  return sorted[0] ?? null;
}

export function markProxyFailed(proxy: ProxyConfig): void {
  proxy.failedAt = Date.now();
  proxy.cooldownUntil = Date.now() + COOLDOWN_MS;
  logger.warn(`Proxy ${proxy.key} marked as failed, cooldown ${COOLDOWN_MS}ms`);
}

export function markProxySuccess(proxy: ProxyConfig): void {
  proxy.failedAt = null;
  proxy.cooldownUntil = 0;
}

export function getHealthyProxies(): ProxyConfig[] {
  const now = Date.now();
  return proxies.filter(p => p.cooldownUntil <= now);
}

export function getProxyCount(): number {
  return proxies.length;
}

export function closeProxies(): void {
  for (const proxy of proxies) {
    proxy.agent.close();
  }
  proxies.length = 0;
}
