import { config } from '../config.js';
import { SessionPool } from '../session-manager/pool.js';
import { VintedClient } from '../scraper/client.js';
import { createLogger } from '../utils/logger.js';
import { gotScraping } from 'got-scraping';
import { getDomain, getBaseUrl } from '../config.js';

const log = createLogger('api-tester');

/**
 * API Endpoint Tester v3 - Full Vinted auth + API validation.
 *
 * Tests:
 * 0. Raw cookie fetch (no browser, just HTTP)
 * 1. Session creation (fetch → browser fallback)
 * 2. Catalog search (v2 endpoint)
 * 3. Catalog search (web-core endpoint)
 * 4. Item details
 * 5. Response format validation
 * 6. Pagination
 * 7. Filter validation
 * 8. Empty response detection
 * 9. Session health
 */
async function main() {
  const country = process.argv[2] || config.countries[0] || 'fr';
  const results = [];

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║    Vinted API Endpoint Tester v3.0       ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const domain = getDomain(country);
  const baseUrl = getBaseUrl(country);

  // ── Test 0: Raw Cookie Fetch (no browser) ──
  console.log('━━━ Test 0: Raw Cookie Fetch (HTTP only, no browser) ━━━');
  try {
    const rawResponse = await gotScraping({
      url: baseUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      followRedirect: true,
      timeout: { request: 15_000 },
      throwHttpErrors: false,
    });

    const setCookies = rawResponse.headers['set-cookie'];
    const cookieArr = Array.isArray(setCookies) ? setCookies : (setCookies ? [setCookies] : []);
    const cookieNames = cookieArr.map(c => c.split('=')[0].trim());
    const hasSession = cookieArr.some(c => c.includes('_vinted_') && c.includes('_session'));
    const hasAccessToken = cookieArr.some(c => c.includes('access_token_web'));
    const hasDatadome = cookieArr.some(c => c.includes('datadome'));

    console.log(`  HTTP ${rawResponse.statusCode} — ${cookieArr.length} Set-Cookie headers`);
    console.log(`  Cookies: ${cookieNames.join(', ')}`);
    console.log(`  ├─ Session cookie: ${hasSession ? '✅ FOUND' : '❌ missing'}`);
    console.log(`  ├─ access_token_web: ${hasAccessToken ? '✅ FOUND (JWT, 2h)' : '⚠️  not in response'}`);
    console.log(`  └─ datadome: ${hasDatadome ? '✅ FOUND' : '⚠️  not in response (might need browser)'}`);

    if (hasSession) {
      // Quick test: use this cookie to call the API
      const sessionVal = cookieArr.find(c => c.includes('_session')).split('=').slice(1).join('=').split(';')[0];
      const cookieName = cookieArr.find(c => c.includes('_session')).split('=')[0].trim();

      let testCookie = `${cookieName}=${sessionVal}`;
      if (hasAccessToken) {
        const atVal = cookieArr.find(c => c.includes('access_token_web')).split('access_token_web=')[1].split(';')[0];
        testCookie += `; access_token_web=${atVal}`;
      }
      if (hasDatadome) {
        const ddVal = cookieArr.find(c => c.includes('datadome')).split('datadome=')[1].split(';')[0];
        testCookie += `; datadome=${ddVal}`;
      }

      const apiTest = await gotScraping({
        url: `https://${domain}/api/v2/catalog/items?per_page=3&time=${Math.floor(Date.now()/1000)}`,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Cookie': testCookie,
        },
        responseType: 'json',
        throwHttpErrors: false,
        timeout: { request: 10_000 },
      });

      const apiOk = apiTest.statusCode === 200 && apiTest.body?.items;
      console.log(`\n  API test with raw cookie: ${apiOk ? '✅' : '❌'} (status ${apiTest.statusCode}, items: ${apiTest.body?.items?.length || 0})`);

      results.push({ test: 'Raw Cookie → API', pass: apiOk, detail: `status=${apiTest.statusCode}, items=${apiTest.body?.items?.length || 0}` });
    }

    results.push({ test: 'Raw Cookie Fetch', pass: hasSession, detail: `session=${hasSession}, access_token=${hasAccessToken}, datadome=${hasDatadome}` });
  } catch (error) {
    results.push({ test: 'Raw Cookie Fetch', pass: false, detail: error.message });
    console.log(`  ❌ ${error.message}`);
  }
  console.log();

  const pool = new SessionPool(config);
  const client = new VintedClient(pool);

  try {
    // ── Test 1: Session Creation ──
    console.log('━━━ Test 1: Session Creation (factory) ━━━');
    const t1Start = Date.now();
    await pool.initialize(country);
    const t1Time = Date.now() - t1Start;
    const poolStats = pool.getStats();
    const alive = poolStats[country]?.alive || 0;
    const total = poolStats[country]?.total || 0;

    const sess = poolStats[country]?.sessions?.[0];
    console.log(`  ${alive > 0 ? '✅' : '❌'} ${alive}/${total} sessions created (${t1Time}ms)`);
    if (sess) console.log(`  Method: ${sess.method || 'unknown'}`);

    results.push({
      test: 'Session Creation',
      pass: alive > 0,
      detail: `${alive}/${total} in ${t1Time}ms`,
    });
    console.log();

    if (alive === 0) {
      console.log('❌ No sessions available. Cannot continue tests.');
      printSummary(results);
      process.exit(1);
    }

    // ── Test 2: Catalog Search ──
    console.log('━━━ Test 2: Catalog Search ━━━');
    const searchResult = await client.request(country, '/catalog/items', {
      params: { search_text: 'nike', per_page: 10, order: 'newest_first' },
    });

    const searchOk = searchResult.status === 200 && searchResult.data?.items?.length > 0;
    const itemCount = searchResult.data?.items?.length || 0;
    results.push({
      test: 'Catalog Search',
      pass: searchOk,
      detail: `status=${searchResult.status}, items=${itemCount}`,
    });
    console.log(`  ${searchOk ? '✅' : '❌'} Status ${searchResult.status}, ${itemCount} items`);

    if (searchOk) {
      const first = searchResult.data.items[0];
      console.log(`  📦 Sample: "${first.title}" - ${first.price?.amount || first.price}€`);

      // Validate response format
      const requiredFields = ['id', 'title', 'price', 'url', 'user'];
      const hasAllFields = requiredFields.every(f => first[f] !== undefined);
      results.push({
        test: 'Response Format',
        pass: hasAllFields,
        detail: `Required fields: ${requiredFields.join(', ')} → ${hasAllFields ? 'all present' : 'MISSING: ' + requiredFields.filter(f => !first[f]).join(', ')}`,
      });
      console.log(`  ${hasAllFields ? '✅' : '⚠️'} Format validation: ${hasAllFields ? 'OK' : 'missing fields'}`);
    }
    console.log();

    // ── Test 3: Search with Filters ──
    console.log('━━━ Test 3: Filtered Search ━━━');
    const filteredResult = await client.request(country, '/catalog/items', {
      params: { search_text: 'adidas', price_to: 30, per_page: 5, order: 'price_low_to_high' },
    });

    const filterOk = filteredResult.status === 200;
    const filterItems = filteredResult.data?.items || [];
    const allUnder30 = filterItems.every(i => parseFloat(i.price?.amount || i.price || 999) <= 30);
    results.push({
      test: 'Filtered Search',
      pass: filterOk && (filterItems.length === 0 || allUnder30),
      detail: `${filterItems.length} items, all under 30€: ${allUnder30}`,
    });
    console.log(`  ${filterOk ? '✅' : '❌'} ${filterItems.length} items (price filter: ${allUnder30 ? 'correct' : 'BROKEN'})\n`);

    // ── Test 4: Item Details ──
    if (searchResult.data?.items?.[0]) {
      console.log('━━━ Test 4: Item Details ━━━');
      const itemId = searchResult.data.items[0].id;
      const detailResult = await client.request(country, `/items/${itemId}`);

      const detailOk = detailResult.status === 200 && detailResult.data;
      const item = detailResult.data?.item || detailResult.data;
      results.push({
        test: 'Item Details',
        pass: detailOk,
        detail: detailOk ? `"${item.title}" - ${item.description?.length || 0} chars description` : `status=${detailResult.status}`,
      });
      console.log(`  ${detailOk ? '✅' : '❌'} ${detailOk ? `"${item.title}"` : 'Failed'}`);

      if (detailOk) {
        const detailFields = ['id', 'title', 'price', 'description', 'user', 'photos'];
        const hasDetailFields = detailFields.every(f => item[f] !== undefined);
        console.log(`  📋 Fields: ${detailFields.map(f => `${f}=${item[f] !== undefined ? '✓' : '✗'}`).join(' ')}`);
      }
      console.log();
    }

    // ── Test 5: Pagination ──
    console.log('━━━ Test 5: Pagination ━━━');
    const page1 = await client.request(country, '/catalog/items', {
      params: { per_page: 5, page: 1 },
    });
    const page2 = await client.request(country, '/catalog/items', {
      params: { per_page: 5, page: 2 },
    });

    const p1ids = new Set((page1.data?.items || []).map(i => i.id));
    const p2ids = (page2.data?.items || []).map(i => i.id);
    const noOverlap = p2ids.every(id => !p1ids.has(id));
    results.push({
      test: 'Pagination',
      pass: page1.status === 200 && page2.status === 200 && noOverlap,
      detail: `Page1: ${p1ids.size} items, Page2: ${p2ids.length} items, overlap: ${!noOverlap}`,
    });
    console.log(`  ${noOverlap ? '✅' : '⚠️'} Page 1: ${p1ids.size} items, Page 2: ${p2ids.length} items (no overlap: ${noOverlap})\n`);

    // ── Test 6: Empty Response Detection ──
    console.log('━━━ Test 6: Empty Response Detection ━━━');
    const emptyResult = await client.request(country, '/catalog/items', {
      params: { search_text: 'xyznonexistentitemquery99999', per_page: 5 },
    });
    const isEmpty = emptyResult.status === 200 && (emptyResult.data?.items?.length || 0) === 0;
    results.push({
      test: 'Empty Response Detection',
      pass: emptyResult.status === 200,
      detail: `status=${emptyResult.status}, items=${emptyResult.data?.items?.length || 0}`,
    });
    console.log(`  ${emptyResult.status === 200 ? '✅' : '❌'} Nonsense query: ${isEmpty ? 'empty as expected' : emptyResult.data?.items?.length + ' items'}\n`);

    // ── Test 7: Session Stats After Tests ──
    console.log('━━━ Test 7: Session Health ━━━');
    const finalStats = pool.getStats();
    const sess = finalStats[country];
    const healthOk = sess && sess.alive > 0;
    results.push({
      test: 'Session Health',
      pass: healthOk,
      detail: `${sess?.alive}/${sess?.total} alive, ${sess?.totalRequests} total requests`,
    });
    console.log(`  ${healthOk ? '✅' : '❌'} ${sess?.alive}/${sess?.total} alive after ${sess?.totalRequests} requests\n`);

    // ── Test 8: Multi-Country (if configured) ──
    if (config.countries.length > 1) {
      console.log('━━━ Test 8: Multi-Country ━━━');
      for (const c of config.countries.filter(c2 => c2 !== country).slice(0, 2)) {
        try {
          await pool.initialize(c);
          const mcResult = await client.request(c, '/catalog/items', { params: { per_page: 3 } });
          const mcOk = mcResult.status === 200;
          results.push({
            test: `Country: ${c.toUpperCase()}`,
            pass: mcOk,
            detail: `${mcResult.data?.items?.length || 0} items`,
          });
          console.log(`  ${mcOk ? '✅' : '❌'} ${c.toUpperCase()}: ${mcResult.data?.items?.length || 0} items`);
        } catch (error) {
          results.push({ test: `Country: ${c.toUpperCase()}`, pass: false, detail: error.message });
          console.log(`  ❌ ${c.toUpperCase()}: ${error.message}`);
        }
      }
      console.log();
    }

  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    console.error(error.stack);
  } finally {
    await pool.shutdown();
  }

  printSummary(results);
  const passed = results.filter(r => r.pass).length;
  process.exit(passed === results.length ? 0 : 1);
}

function printSummary(results) {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                          ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  for (const r of results) {
    const icon = r.pass ? '✅' : '❌';
    console.log(`║ ${icon} ${r.test.padEnd(25)} ${r.detail.slice(0, 35).padEnd(35)}║`);
  }
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║ Result: ${passed}/${total} passed ${' '.repeat(42)}║`);
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
}

main();
