/**
 * Content Script - Intercepts Vinted API responses from the page.
 *
 * Hooks into fetch/XHR to capture catalog API responses
 * as they happen during normal browsing. Sends data to background worker.
 */
(function () {
  'use strict';

  // Hook fetch to intercept API responses
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

    if (url.includes('/api/v2/catalog/items') || url.includes('/api/v2/items/')) {
      try {
        const clone = response.clone();
        const data = await clone.json();

        if (data.items && data.items.length > 0) {
          chrome.runtime.sendMessage({
            type: 'INTERCEPTED_ITEMS',
            items: data.items,
            source: 'fetch',
            url,
          });
        }
      } catch { /* ignore parse errors */ }
    }

    return response;
  };

  // Hook XMLHttpRequest for older API calls
  const originalXHR = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._sniperUrl = url;

    this.addEventListener('load', function () {
      if (this._sniperUrl && (
        this._sniperUrl.includes('/api/v2/catalog/items') ||
        this._sniperUrl.includes('/api/v2/items/')
      )) {
        try {
          const data = JSON.parse(this.responseText);
          if (data.items && data.items.length > 0) {
            chrome.runtime.sendMessage({
              type: 'INTERCEPTED_ITEMS',
              items: data.items,
              source: 'xhr',
              url: this._sniperUrl,
            });
          }
        } catch { /* ignore */ }
      }
    });

    return originalXHR.call(this, method, url, ...rest);
  };

  console.log('[Vinted Sniper] Content script loaded');
})();
