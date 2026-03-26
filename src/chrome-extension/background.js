/**
 * Chrome Extension Background Service Worker
 *
 * APPROACH: Runs inside the user's real Chrome browser.
 *
 * ADVANTAGES over Playwright:
 * - Uses the user's REAL TLS fingerprint (impossible to detect)
 * - No browser automation flags
 * - Cookies already present from normal browsing
 * - Zero session management needed
 * - Cloudflare never triggers because it's a real user
 *
 * TRADEOFFS:
 * - Requires user to have Chrome open
 * - Can't run headless/on server
 * - Single browser = single session (no pool)
 * - User must be logged in for autobuy
 * - Slower scaling (one browser instance)
 *
 * HOW IT WORKS:
 * 1. Content script intercepts Vinted API responses via fetch/XHR override
 * 2. Background worker receives intercepted data
 * 3. Background worker runs search polling via fetch (using browser cookies)
 * 4. Matches items against rules → sends notifications
 */

// --- State ---
let config = {
  enabled: false,
  queries: [],
  pollIntervalMs: 5000,
  webhookUrl: '',
  autobuy: { enabled: false, maxPrice: 50 },
  country: 'fr',
};
let seenItems = new Set();
let pollTimer = null;
let stats = { totalItems: 0, newItems: 0, errors: 0, lastPoll: null };

// --- Config Management ---
chrome.storage.local.get('sniperConfig', (result) => {
  if (result.sniperConfig) {
    config = { ...config, ...result.sniperConfig };
    if (config.enabled) startPolling();
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.sniperConfig) {
    config = { ...config, ...changes.sniperConfig.newValue };
    if (config.enabled) {
      startPolling();
    } else {
      stopPolling();
    }
  }
});

// --- Polling ---
function startPolling() {
  stopPolling();
  console.log('[Sniper] Starting poll loop');
  poll(); // Immediate first poll
  pollTimer = setInterval(poll, config.pollIntervalMs);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function poll() {
  for (const query of config.queries) {
    try {
      const items = await searchVinted(query);
      stats.lastPoll = new Date().toISOString();
      stats.totalItems += items.length;

      const newItems = items.filter(item => {
        if (seenItems.has(item.id)) return false;
        seenItems.add(item.id);
        return true;
      });

      stats.newItems += newItems.length;

      for (const item of newItems) {
        console.log(`[Sniper] New item: ${item.title} - ${item.price}€`);

        // Browser notification
        chrome.notifications.create(`item-${item.id}`, {
          type: 'basic',
          iconUrl: item.photo?.thumbnails?.[0]?.url || 'icon128.png',
          title: `${item.title} - ${item.price?.amount || item.price}€`,
          message: `${item.brand_title || ''} | ${item.size_title || ''} | ${item.user?.login || ''}`,
        });

        // Webhook notification
        if (config.webhookUrl) {
          sendWebhook(item);
        }
      }
    } catch (error) {
      stats.errors++;
      console.error('[Sniper] Poll error:', error);
    }
  }

  // Trim seen items set to prevent memory leak
  if (seenItems.size > 10000) {
    const arr = [...seenItems];
    seenItems = new Set(arr.slice(-5000));
  }
}

/**
 * Search Vinted API directly from the extension.
 * Uses the browser's own cookies (fetch inherits them).
 */
async function searchVinted(query) {
  const domain = getDomain(config.country);
  const params = new URLSearchParams();

  if (query.text) params.set('search_text', query.text);
  if (query.priceFrom) params.set('price_from', query.priceFrom);
  if (query.priceTo) params.set('price_to', query.priceTo);
  if (query.brandIds) params.set('brand_ids', query.brandIds);
  if (query.catalogIds) params.set('catalog_ids', query.catalogIds);
  params.set('order', 'newest_first');
  params.set('per_page', '24');

  const url = `https://${domain}/api/v2/catalog/items?${params}`;

  const response = await fetch(url, {
    credentials: 'include', // Send cookies
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  const data = await response.json();
  return data.items || [];
}

async function sendWebhook(item) {
  try {
    const isDiscord = config.webhookUrl.includes('discord.com');
    const body = isDiscord
      ? {
          embeds: [{
            title: `${item.title} - ${item.price?.amount || item.price}€`,
            description: `Brand: ${item.brand_title || 'N/A'}\nSize: ${item.size_title || 'N/A'}\nSeller: ${item.user?.login || 'N/A'}`,
            color: 0x0099ff,
            url: item.url || `https://${getDomain(config.country)}${item.path}`,
            thumbnail: item.photo?.thumbnails?.[0] ? { url: item.photo.thumbnails[0].url } : undefined,
            timestamp: new Date().toISOString(),
          }],
        }
      : {
          type: 'new_item',
          item: {
            id: item.id,
            title: item.title,
            price: item.price,
            brand: item.brand_title,
            size: item.size_title,
            url: item.url || item.path,
          },
        };

    await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error('[Sniper] Webhook error:', error);
  }
}

function getDomain(country) {
  const domains = {
    fr: 'www.vinted.fr', de: 'www.vinted.de', es: 'www.vinted.es',
    it: 'www.vinted.it', nl: 'www.vinted.nl', be: 'www.vinted.be',
    pt: 'www.vinted.pt', uk: 'www.vinted.co.uk', us: 'www.vinted.com',
  };
  return domains[country] || domains.fr;
}

// --- Message handler for popup/content script ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_STATS':
      sendResponse({ stats, config: { ...config, queries: config.queries.length } });
      break;
    case 'GET_CONFIG':
      sendResponse(config);
      break;
    case 'SET_CONFIG':
      config = { ...config, ...message.config };
      chrome.storage.local.set({ sniperConfig: config });
      sendResponse({ ok: true });
      break;
    case 'INTERCEPTED_ITEMS':
      // Receive items intercepted by content script
      handleInterceptedItems(message.items);
      sendResponse({ ok: true });
      break;
  }
  return true;
});
