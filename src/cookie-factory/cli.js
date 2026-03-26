import { CookieFactory } from './factory.js';
import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { writeFileSync, mkdirSync } from 'fs';

const log = createLogger('factory-cli');

/**
 * CLI tool to manually create and test sessions.
 *
 * Usage:
 *   node src/cookie-factory/cli.js [country]
 *   node src/cookie-factory/cli.js fr
 *   node src/cookie-factory/cli.js de --save
 */
async function main() {
  const country = process.argv[2] || config.country;
  const shouldSave = process.argv.includes('--save');

  log.info(`Creating session for country: ${country}`);

  const factory = new CookieFactory(config);

  try {
    const session = await factory.createSession(country);

    log.info('Session created successfully:');
    log.info(`  ID: ${session.id}`);
    log.info(`  Domain: ${session.domain}`);
    log.info(`  Cookies: ${session.cookies.length}`);
    log.info(`  User-Agent: ${session.userAgent}`);
    log.info(`  CSRF Token: ${session.csrfToken || 'N/A'}`);

    // Print cookie names (not values for security)
    log.info('  Cookie names: ' + session.cookies.map(c => c.name).join(', '));

    if (shouldSave) {
      mkdirSync('sessions', { recursive: true });
      const path = `sessions/${session.id}.json`;
      writeFileSync(path, JSON.stringify(session, null, 2));
      log.info(`Session saved to ${path}`);
    }

    // Test the session with a simple API call
    log.info('Testing session with catalog search...');
    const { gotScraping } = await import('got-scraping');
    const testUrl = `https://${session.domain}/api/v2/catalog/items?per_page=5&order=newest_first`;

    const response = await gotScraping({
      url: testUrl,
      headers: {
        ...session.headers,
        Cookie: session.cookieString,
      },
      responseType: 'json',
      throwHttpErrors: false,
      timeout: { request: 15_000 },
    });

    if (response.statusCode === 200 && response.body?.items) {
      log.info(`Session test PASSED - got ${response.body.items.length} items`);
      response.body.items.slice(0, 3).forEach(item => {
        log.info(`  - ${item.title} (${item.price?.amount || item.price}€)`);
      });
    } else {
      log.warn(`Session test returned status ${response.statusCode}`);
      if (response.body?.items?.length === 0) {
        log.warn('Empty items array - session may be silently invalidated');
      }
    }
  } catch (error) {
    log.error(`Failed: ${error.message}`);
  } finally {
    await factory.close();
  }
}

main();
