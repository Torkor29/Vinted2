# Vinted Sniper v2.0 - Audit Report

**Date:** 2026-03-25
**Scope:** Full codebase audit of `src/` directory (24 source files)
**Focus areas:** Bugs, reliability, security, performance

---

## CRITICAL BUGS

### BUG-1: `startBot()` returns silently when queries are empty -- but queries added via dashboard are NOT checked

**File:** `src/index.js`, line 128
**Severity:** CRITICAL

When `startBot()` is called, it checks `this.queries.length === 0` and returns early if there are no queries. However, the queries added via the dashboard's `/api/queries` POST route push directly to `this.modules.sniper.queries`, which IS the same `this.queries` array. So the add/remove flow actually works correctly.

**The real issue** is that `startBot()` can only be called once: it sets `this.running = true` and starts `pollLoop()`. If the user stops the bot (`stopBot()` sets `this.running = false`), the `pollLoop()` exits its `while(this.running)` loop. Then when `startBot()` is called again, it starts a **new** `pollLoop()`. This works, but `startBot()` also calls `this.monitor.start()` which starts a new monitor loop -- creating a **duplicate** monitor loop if the monitor was already running from a previous start.

**Fix:** Guard `monitor.start()` to not start duplicate loops. (FIXED)

---

### BUG-2: `monitor.stop()` does not wait for the loop to finish -- race condition on restart

**File:** `src/monitoring/monitor.js`, line 61
**Severity:** HIGH

`stop()` just sets `this.running = false`, but the `start()` method is an async loop. If `stopBot()` is called and immediately followed by `startBot()`, the old monitor loop may still be running when the new one is started. The `monitorPromise` in `index.js` (line 149) is stored but never awaited on stop.

**Fix:** Make `stopBot()` await the monitor promise. (FIXED)

---

### BUG-3: `postFilter` compares price against query filters using wrong types

**File:** `src/query/search.js`, lines 114-121
**Severity:** MEDIUM

The `priceTo` and `priceFrom` from the dashboard query may be `undefined` (which passes the `if` check as falsy) or `0` (which is falsy and would skip the filter). The value from `query.priceTo` could also come as a string from JSON if not properly parsed. However, the dashboard uses `+pmax` which coerces to number. This is actually fine in practice.

**Actual issue:** The `item.price` from `normalizeItem` is `parseFloat(raw.price?.amount || raw.price || 0)`. If `raw.price` is an object like `{amount: "25.00", currency_code: "EUR"}`, then `raw.price?.amount` is `"25.00"`, and `parseFloat("25.00")` is `25`. This works correctly.

No fix needed here -- the postFilter is correctly implemented.

---

### BUG-4: Graceful shutdown does not work on Windows

**File:** `src/index.js`, lines 341-346
**Severity:** HIGH

On Windows, `SIGINT` does work for `Ctrl+C` in a terminal, but `SIGTERM` is not reliably delivered. More importantly, the `await sniper.shutdown()` inside the signal handler can be cut short because `process.exit(0)` will be called even if the async `shutdown()` has not completed. Node.js signal handlers are synchronous in nature -- the `await` works because the handler is `async`, but the process may exit before all cleanup finishes.

Additionally, `this.dashboard.stop()` calls `this.server.close()` which is async but not awaited.

**Fix:** Await server close in shutdown. (FIXED)

---

### BUG-5: `DealScorer` and `ArbitrageDetector` have unbounded memory growth

**File:** `src/intelligence/deal-scorer.js`, `src/intelligence/arbitrage.js`
**Severity:** MEDIUM

- `DealScorer.sellerStats`: Map grows without bound -- stores all seller IDs forever. Each seller entry accumulates up to 100 prices, but the map itself is never pruned.
- `DealScorer.priceHistory`: Map grows without bound -- stores up to 50 entries per item ID, but items are never removed from the map.
- `DealScorer.marketData`: Each segment stores up to 500 prices, but the number of segments grows without bound.
- `ArbitrageDetector.catalog`: Has a `cleanup()` method but it is called randomly with 1% probability (`Math.random() < 0.01`), meaning it could go a very long time without cleanup.

**Fix:** Add periodic cleanup to DealScorer. (FIXED)

---

### BUG-6: `DataExporter.items` array grows without bound

**File:** `src/utils/exporter.js`, line 21
**Severity:** MEDIUM

Every item ever scraped is pushed to `this.items` and never removed. Over long runs this will consume significant memory.

**Fix:** Cap the items array. (FIXED)

---

### BUG-7: Dashboard credentials endpoint stores password in runtime config

**File:** `src/dashboard/server.js`, lines 219-229
**Severity:** HIGH (Security)

The `/api/autobuy/credentials` endpoint stores the Vinted email and password in `sniper.fullConfig.vinted`. While the comment says "not written to disk," the password is stored in plain text in memory and accessible via the config object. Any code that logs or serializes `config` would expose the password.

Additionally, the `printStats()` method does not log config, so this is mitigated. Still a concern.

**Recommendation:** Do not store password in config object; store it separately in autoBuyer with minimal exposure.

---

### BUG-8: Dashboard exposed to network

**File:** `src/config.js`, line 219
**Severity:** LOW (default is `localhost`)

Default dashboard host is `localhost` which is correct. If a user changes it to `0.0.0.0`, the dashboard has no authentication and all API endpoints (including credentials) are exposed.

**Recommendation:** Add a warning log if host is not localhost. (FIXED)

---

### BUG-9: XSS in dashboard via item data

**File:** `src/dashboard/public/index.html`, line 841
**Severity:** MEDIUM (Security)

Item URLs are injected directly into `onclick` handlers without escaping:
```js
onclick="window.open('${it.url}','_blank')"
```
If an attacker crafts an item with a URL containing `'` followed by JS code, it could execute arbitrary JavaScript. The `esc()` function is used for text content but NOT for attribute values in onclick handlers.

**Fix:** Use `encodeURI()` for URLs in onclick attributes. (FIXED)

---

## NON-CRITICAL ISSUES

### ISSUE-1: Socket.IO `items:backlog` replaces items array

**File:** `src/dashboard/public/index.html`, line 559

When a new dashboard client connects, the server sends `items:backlog` which sets `items = b`. This is correct. The fallback polling also works. The Socket.IO connection itself appears to work correctly -- the `socket.io.js` client is loaded from the Express server which serves it automatically.

**Status:** No bug found in Socket.IO connection. If feed is not updating, it is likely a session issue (Vinted returning empty results).

---

### ISSUE-2: `withRetry` in `search.js` checks `isSilentFailure` on the raw response

**File:** `src/utils/retry.js`, line 22 / `src/query/search.js`, line 46

The `isSilentFailure` callback receives the result of `this.client.request()`, which returns `{ status, data, headers, session }`. The callback checks `res.status === 200 && res.data?.items?.length === 0`. This is correct.

**Status:** Working as designed.

---

### ISSUE-3: Session pool `getSession` race condition

**File:** `src/session-manager/pool.js`, line 81

If two concurrent calls to `getSession()` both detect `needsRotation()` on the same session, both will call `rotateSession()` for the same index, creating two new sessions but only keeping the second one. The first session is leaked (Playwright context already closed, so no resource leak, but creates unnecessary work).

**Recommendation:** Add a per-session rotation lock. Low priority since the impact is minimal.

---

### ISSUE-4: `ProxyManager.getProxy` calls `alive.sort()` which mutates the array

**File:** `src/proxy/manager.js`, line 105

For `least-used` strategy, `alive.sort()` mutates the filtered array in-place. Since `alive` is a new array from `.filter()`, this is actually safe. No bug.

---

### ISSUE-5: `pollLoop` does not catch errors in `this.dashboard.pushStats()`

**File:** `src/index.js`, line 192

If `pushStats()` throws, it would be uncaught within the `pollLoop`. However, since `broadcast` just calls `this.io.emit()` which does not throw, this is safe.

---

## PERFORMANCE IMPROVEMENTS

### PERF-1: Avoid re-fetching catalog data on every dashboard page load

The `/api/catalog` endpoint calls `getAllCatalogData()` on every request. This data is static. Consider caching it once.

**Impact:** Very low -- the data is already in memory.

---

### PERF-2: `Promise.allSettled` is used correctly in the poll loop

The poll loop chunks queries and runs them concurrently with `Promise.allSettled`. This is the correct pattern.

---

### PERF-3: Feed rendering in dashboard is O(n) on every new item

Each new item triggers `renderFeed()` which rebuilds the entire DOM innerHTML for up to 80 items. For a monitoring dashboard this is acceptable. If performance becomes an issue, consider incremental DOM updates.

---

### PERF-4: The `api()` helper in the dashboard always sets `Content-Type: application/json` even for GET requests

**File:** `src/dashboard/public/index.html`, line 586

This is a minor issue. GET requests with `Content-Type: application/json` and no body may confuse some proxies. Not a real problem here since the dashboard is accessed locally.

---

## MISSING ERROR HANDLING

1. **`src/dashboard/server.js`**: API routes like `POST /api/queries` do not validate the query body. A malformed POST could push `undefined` or invalid data into the queries array.

2. **`src/dashboard/server.js`**: `DELETE /api/queries/:index` does not validate that `idx` is within bounds. `splice(-1, 1)` with a NaN index would not crash but would produce unexpected behavior.

3. **`src/cookie-factory/factory.js`**: If both `createSessionViaFetch` and `createSessionViaBrowser` fail, the error from the browser method is thrown but the fetch error is lost.

4. **`src/index.js`**: The main `start()` method has `await new Promise(() => {})` which means the process never exits naturally. This is intentional but means `shutdown()` is only reachable via signal handlers.

5. **`src/monitoring/monitor.js`**: `checkSeller` does not handle the case where `result.data` is not an object (e.g., a string error response).

---

## SUMMARY OF FIXES APPLIED

| Bug | File | Fix |
|-----|------|-----|
| BUG-1 | `src/index.js` | Guard duplicate monitor.start() |
| BUG-2 | `src/index.js` | Await monitor promise on stop |
| BUG-4 | `src/dashboard/server.js` | Return promise from stop() |
| BUG-5 | `src/intelligence/deal-scorer.js` | Add periodic cleanup |
| BUG-6 | `src/utils/exporter.js` | Cap items array at 10000 |
| BUG-8 | `src/dashboard/server.js` | Warn if host is not localhost |
| BUG-9 | `src/dashboard/public/index.html` | Sanitize URLs in onclick |
| MISC | `src/dashboard/server.js` | Validate query index on DELETE |
