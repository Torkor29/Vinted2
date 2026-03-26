import { config } from './config.js';
import { SessionPool } from './session-manager/pool.js';
import { VintedClient } from './scraper/client.js';
import { VintedSearch } from './query/search.js';
import { createLogger } from './utils/logger.js';

const log = createLogger('test');

/**
 * Quick integration test - creates a session and runs a search.
 */
async function main() {
  log.info('=== Session Integration Test ===');

  const pool = new SessionPool(config);
  const client = new VintedClient(pool);
  const search = new VintedSearch(client);

  try {
    // 1. Initialize pool
    log.info('Step 1: Initializing session pool...');
    await pool.initialize(config.country);
    log.info('Pool initialized');

    // 2. Run a search
    log.info('Step 2: Running search...');
    const results = await search.search(config.country, {
      text: 'nike',
      perPage: 10,
      order: 'newest_first',
    });

    if (results.items.length > 0) {
      log.info(`Found ${results.items.length} items:`);
      results.items.forEach(item => {
        log.info(`  [${item.id}] ${item.title} - ${item.price}€ (${item.brand}) by ${item.seller.login}`);
      });
    } else {
      log.warn('No items found - session might be blocked');
    }

    // 3. Pool stats
    log.info('Step 3: Pool stats:');
    const stats = pool.getStats();
    log.info(JSON.stringify(stats, null, 2));

    // 4. Test item details
    if (results.items.length > 0) {
      log.info('Step 4: Getting item details...');
      const details = await search.getItemDetails(config.country, results.items[0].id);
      if (details) {
        log.info(`Item details: ${details.title} - ${details.description?.slice(0, 100)}`);
      }
    }

    log.info('=== Test Complete ===');
  } catch (error) {
    log.error(`Test failed: ${error.message}`);
    log.error(error.stack);
  } finally {
    search.destroy();
    await pool.shutdown();
  }
}

main();
