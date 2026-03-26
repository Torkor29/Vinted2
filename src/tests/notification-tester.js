import { config } from '../config.js';
import { Notifier } from '../notifications/notifier.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('notif-test');

/**
 * Test all configured notification channels.
 */
async function main() {
  console.log('\n🔔 Testing Notification Channels\n');

  const notifier = new Notifier(config);
  const channels = config.notifications;

  const fakeItem = {
    id: 99999,
    title: 'Nike Air Max 90 — TEST',
    price: 42.99,
    currency: 'EUR',
    brand: 'Nike',
    size: '42',
    condition: 'Très bon état',
    url: 'https://www.vinted.fr/items/99999',
    photo: 'https://via.placeholder.com/300x300.png?text=TEST',
    seller: {
      login: 'test_seller',
      rating: 4.8,
      reviewCount: 127,
    },
  };

  const tests = [
    { name: 'Discord', enabled: channels.discord.enabled, config: channels.discord.webhookUrl ? '✓ URL set' : '✗ No URL' },
    { name: 'Slack', enabled: channels.slack.enabled, config: channels.slack.webhookUrl ? '✓ URL set' : '✗ No URL' },
    { name: 'Telegram', enabled: channels.telegram.enabled, config: channels.telegram.botToken ? '✓ Token set' : '✗ No token' },
    { name: 'Email', enabled: channels.email.enabled, config: channels.email.smtp.user ? '✓ SMTP set' : '✗ No SMTP' },
    { name: 'SMS', enabled: channels.sms.enabled, config: channels.sms.accountSid ? '✓ SID set' : '✗ No SID' },
    { name: 'Desktop', enabled: channels.desktop.enabled, config: '✓ Always available' },
    { name: 'Webhook', enabled: channels.webhook.enabled, config: channels.webhook.url ? '✓ URL set' : '✗ No URL' },
  ];

  console.log('Configured channels:');
  for (const t of tests) {
    console.log(`  ${t.enabled ? '✅' : '⬜'} ${t.name.padEnd(12)} ${t.config}`);
  }

  const enabledCount = tests.filter(t => t.enabled).length;
  if (enabledCount === 0) {
    console.log('\n⚠️  No channels enabled. Configure notifications in config.json or .env');
    process.exit(0);
  }

  console.log(`\nSending test notification to ${enabledCount} channels...\n`);

  // Test: new item
  await notifier.notify('newItem', { title: 'TEST: Nike Air Max 90 — 42.99€', item: fakeItem });
  console.log('✅ New item notification sent');

  // Test: price drop
  await notifier.notify('priceDrop', {
    title: 'TEST: Price Drop -25%',
    item: { ...fakeItem, previousPrice: 57.00, dropPercent: 24.6 },
  });
  console.log('✅ Price drop notification sent');

  // Test: autobuy
  await notifier.notify('autobuyExecuted', {
    title: 'TEST: ACHETÉ — Nike Air Max 90',
    item: fakeItem,
    record: { rule: 'Test Rule', transactionId: 'TX-TEST-123' },
  });
  console.log('✅ Autobuy notification sent');

  // Test: error
  await notifier.notify('sessionError', {
    title: 'TEST: Session Error',
    error: 'Simulated session failure for testing',
  });
  console.log('✅ Error notification sent');

  const stats = notifier.getStats();
  console.log(`\n📊 Results: ${stats.sent} sent, ${stats.failed} failed`);
  console.log('   By channel:', JSON.stringify(stats.byChannel));
  console.log('\n✅ Notification test complete!\n');
}

main().catch(console.error);
