import { config as dotenvConfig } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

dotenvConfig();

// ── Country-specific Vinted domains ──
const VINTED_DOMAINS = {
  fr: 'www.vinted.fr',
  de: 'www.vinted.de',
  es: 'www.vinted.es',
  it: 'www.vinted.it',
  nl: 'www.vinted.nl',
  be: 'www.vinted.be',
  pt: 'www.vinted.pt',
  pl: 'www.vinted.pl',
  lt: 'www.vinted.lt',
  cz: 'www.vinted.cz',
  at: 'www.vinted.at',
  uk: 'www.vinted.co.uk',
  us: 'www.vinted.com',
};

const CURRENCY_MAP = {
  fr: 'EUR', de: 'EUR', es: 'EUR', it: 'EUR', nl: 'EUR',
  be: 'EUR', pt: 'EUR', at: 'EUR', lt: 'EUR', cz: 'CZK',
  pl: 'PLN', uk: 'GBP', us: 'USD',
};

// ── Full default config ──
const defaults = {
  // Which countries to monitor simultaneously
  countries: ['fr'],

  // Vinted credentials (required for autobuy, optional for scraping)
  vinted: {
    email: '',
    password: '',
  },

  // ── Session management ──
  session: {
    maxRequestsPerSession: 80,
    poolSizePerCountry: 5,       // 5 sessions per country (was 3)
    rotateOnConsecutiveEmpty: 3,
    rotateOnErrors: 5,
    healthCheckIntervalMs: 60_000,
    browserTimeout: 30_000,
    // Stagger between session creation (ms) - looks more natural
    creationStaggerMs: 3000,
  },

  // ── Proxy configuration ──
  proxy: {
    enabled: false,
    // 'round-robin' | 'random' | 'least-used' | 'sticky'
    strategy: 'round-robin',
    // List of proxy URLs: http://user:pass@host:port or socks5://host:port
    list: [],
    // File with one proxy per line (alternative to list)
    file: '',
    // Test proxies on startup
    testOnStartup: true,
    // Remove proxy from pool after N consecutive failures
    maxFailures: 3,
    // Bind proxy to session (sticky) - important for TLS consistency
    stickyToSession: true,
  },

  // ── Scraper settings ──
  scraper: {
    pollIntervalMs: 2_000,       // 2s default (can go to 1s with enough sessions)
    retryAttempts: 3,
    retryBackoffMs: 1_500,
    requestTimeoutMs: 10_000,    // 10s timeout (was 15s)
    // Max concurrent queries per poll cycle
    concurrentQueries: 5,        // 5 parallel requests (was 3)
  },

  // ── Search queries ──
  queries: [],

  // ── Monitoring: seller watch, price drops, favorites ──
  monitoring: {
    // Watch specific sellers for new listings
    sellers: [],
    // Watchlist: specific item IDs to track for price drops
    watchlist: [],
    // Price drop alert threshold (percentage)
    priceDropThresholdPercent: 10,
    // Poll interval for watchlist/sellers (ms)
    monitorIntervalMs: 30_000,
  },

  // ── Autobuy configuration ──
  autobuy: {
    enabled: false,
    // ── Purchase conditions (ALL must be met) ──
    rules: [
      // Example rule:
      // {
      //   name: "Nike deals",
      //   keywords: ["nike", "air max"],
      //   excludeKeywords: ["fake", "replica", "lot"],
      //   maxPrice: 50,
      //   minPrice: 5,              // avoid suspicious too-cheap items
      //   brands: ["Nike"],
      //   sizes: ["42", "43"],
      //   conditions: ["new_with_tags", "new_without_tags", "very_good"],
      //   minSellerRating: 4.0,     // out of 5
      //   minSellerReviews: 10,
      //   minSellerAge: 30,         // days since seller registered
      //   maxItemAge: 300,          // seconds since listing (buy only fresh items)
      //   countries: ["fr"],        // only buy from these countries
      //   enabled: true,
      // }
    ],

    // ── Safety limits ──
    maxDailyPurchases: 5,
    maxDailySpend: 200,           // EUR
    cooldownBetweenBuysMs: 60_000,
    globalCooldownMs: 10_000,     // min time between any autobuy evaluation

    // ── Purchase behavior ──
    // 'instant' = buy immediately | 'offer' = make an offer at X% below
    mode: 'instant',
    offerDiscountPercent: 10,     // if mode=offer, offer this % below asking
    offerMessage: 'Bonjour, votre article m\'intéresse !',

    // ── Payment ──
    // Payment must be pre-configured on Vinted account
    // We only trigger the buy, we don't enter card details
    useDefaultPayment: true,

    // ── Confirmation ──
    // 'auto' = buy without asking | 'confirm' = send notification and wait
    confirmationMode: 'auto',
    confirmationTimeoutMs: 60_000,

    // ── Blacklist ──
    blacklistedSellers: [],
    blacklistedItemIds: [],

    // ── Dry run: log what would be bought without actually buying ──
    dryRun: true,
  },

  // ── Notifications ──
  notifications: {
    // Discord webhook
    discord: {
      enabled: false,
      webhookUrl: '',
      mentionRoleId: '',      // <@&ROLE_ID> to ping
      mentionUserId: '',      // <@USER_ID> to ping
    },
    // Slack
    slack: {
      enabled: false,
      webhookUrl: '',
      channel: '',
    },
    // Telegram
    telegram: {
      enabled: false,
      botToken: '',
      chatId: '',
    },
    // Email (SMTP)
    email: {
      enabled: false,
      smtp: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        user: '',
        pass: '',
      },
      from: '',
      to: '',
    },
    // SMS (Twilio)
    sms: {
      enabled: false,
      accountSid: '',
      authToken: '',
      from: '',
      to: '',
    },
    // Desktop notifications
    desktop: {
      enabled: true,
      sound: true,
    },
    // Generic webhook (any URL, POST JSON)
    webhook: {
      enabled: false,
      url: '',
      headers: {},
    },

    // ── What triggers notifications ──
    triggers: {
      newItem: true,
      priceDrop: true,
      sellerNewListing: true,
      autobuyExecuted: true,
      autobuyFailed: true,
      sessionError: true,
      dailySummary: true,
    },
  },

  // ── Dashboard ──
  dashboard: {
    enabled: true,
    port: 3000,
    host: 'localhost',
    // Open browser on start
    openOnStart: true,
  },

  // ── Logging ──
  logging: {
    level: 'info',
    dir: 'logs',
  },

  // ── Export ──
  export: {
    autoExport: false,
    format: 'json',   // 'json' | 'csv'
    dir: 'exports',
    intervalMs: 3600_000,  // hourly
  },
};

// ── Load and merge config ──
function loadConfig() {
  const config = structuredClone(defaults);

  // 1. Override from config.json FIRST
  const configPath = resolve('config.json');
  if (existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
      deepMerge(config, fileConfig);
    } catch (e) {
      console.warn(`[config] Failed to parse config.json: ${e.message}`);
    }
  }

  // 2. Env vars override LAST (highest priority — critical for Render/Docker)
  applyEnvOverrides(config);

  // Validate
  validateConfig(config);

  return config;
}

function applyEnvOverrides(config) {
  const env = process.env;

  if (env.VINTED_EMAIL) config.vinted.email = env.VINTED_EMAIL;
  if (env.VINTED_PASSWORD) config.vinted.password = env.VINTED_PASSWORD;
  if (env.VINTED_COUNTRIES) config.countries = env.VINTED_COUNTRIES.split(',');

  if (env.SESSION_POOL_SIZE) config.session.poolSizePerCountry = +env.SESSION_POOL_SIZE;
  if (env.MAX_REQUESTS_PER_SESSION) config.session.maxRequestsPerSession = +env.MAX_REQUESTS_PER_SESSION;

  if (env.POLL_INTERVAL_MS) config.scraper.pollIntervalMs = +env.POLL_INTERVAL_MS;

  if (env.PROXY_LIST) config.proxy.list = env.PROXY_LIST.split(',');
  if (env.PROXY_FILE) config.proxy.file = env.PROXY_FILE;
  if (env.PROXY_ENABLED === 'true') config.proxy.enabled = true;

  if (env.AUTOBUY_ENABLED === 'true') config.autobuy.enabled = true;
  if (env.AUTOBUY_DRY_RUN === 'false') config.autobuy.dryRun = false;
  if (env.AUTOBUY_MAX_PRICE) config.autobuy.rules.forEach(r => r.maxPrice = +env.AUTOBUY_MAX_PRICE);

  if (env.DISCORD_WEBHOOK) { config.notifications.discord.enabled = true; config.notifications.discord.webhookUrl = env.DISCORD_WEBHOOK; }
  if (env.SLACK_WEBHOOK) { config.notifications.slack.enabled = true; config.notifications.slack.webhookUrl = env.SLACK_WEBHOOK; }
  if (env.TELEGRAM_BOT_TOKEN) { config.notifications.telegram.enabled = true; config.notifications.telegram.botToken = env.TELEGRAM_BOT_TOKEN; }
  if (env.TELEGRAM_CHAT_ID) config.notifications.telegram.chatId = env.TELEGRAM_CHAT_ID;
  if (env.SMTP_HOST) config.notifications.email.smtp.host = env.SMTP_HOST;
  if (env.SMTP_USER) { config.notifications.email.enabled = true; config.notifications.email.smtp.user = env.SMTP_USER; }
  if (env.SMTP_PASS) config.notifications.email.smtp.pass = env.SMTP_PASS;
  if (env.EMAIL_TO) config.notifications.email.to = env.EMAIL_TO;
  if (env.SMS_SID) config.notifications.sms.accountSid = env.SMS_SID;
  if (env.SMS_TOKEN) config.notifications.sms.authToken = env.SMS_TOKEN;
  if (env.SMS_FROM) config.notifications.sms.from = env.SMS_FROM;
  if (env.SMS_TO) { config.notifications.sms.enabled = true; config.notifications.sms.to = env.SMS_TO; }
  if (env.WEBHOOK_URL) { config.notifications.webhook.enabled = true; config.notifications.webhook.url = env.WEBHOOK_URL; }

  // Render sets PORT env var — use it for dashboard
  if (env.PORT) { config.dashboard.port = +env.PORT; config.dashboard.host = '0.0.0.0'; }
  if (env.DASHBOARD_PORT) config.dashboard.port = +env.DASHBOARD_PORT;
  if (env.DASHBOARD_HOST) config.dashboard.host = env.DASHBOARD_HOST;
  if (env.LOG_LEVEL) config.logging.level = env.LOG_LEVEL;

  // Production: don't open browser, don't use desktop notifications
  if (env.NODE_ENV === 'production') {
    config.dashboard.openOnStart = false;
    config.notifications.desktop.enabled = false;
  }
}

function validateConfig(config) {
  if (config.autobuy.enabled && !config.autobuy.dryRun) {
    if (!config.vinted.email || !config.vinted.password) {
      console.warn('[config] WARNING: Autobuy enabled but no Vinted credentials set. Autobuy will fail.');
    }
    if (config.autobuy.rules.length === 0) {
      console.warn('[config] WARNING: Autobuy enabled but no rules defined. Nothing will be bought.');
    }
  }

  if (config.countries.length === 0) {
    config.countries = ['fr'];
  }

  // Validate autobuy rules
  for (const rule of config.autobuy.rules) {
    if (!rule.name) rule.name = `Rule ${config.autobuy.rules.indexOf(rule) + 1}`;
    if (!rule.maxPrice) console.warn(`[config] Autobuy rule "${rule.name}" has no maxPrice - risky!`);
    if (rule.enabled === undefined) rule.enabled = true;
  }
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

function getDomain(country) {
  return VINTED_DOMAINS[country] || VINTED_DOMAINS.fr;
}

function getBaseUrl(country) {
  return `https://${getDomain(country)}`;
}

function getApiUrl(country) {
  return `https://${getDomain(country)}/api/v2`;
}

function getCurrency(country) {
  return CURRENCY_MAP[country] || 'EUR';
}

const config = loadConfig();

export { config, getDomain, getBaseUrl, getApiUrl, getCurrency, VINTED_DOMAINS, CURRENCY_MAP };
