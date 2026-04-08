import { z } from 'zod';

const configSchema = z.object({
  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().default(''),
  TELEGRAM_GROUP_ID: z.string().default(''),

  // URLs
  WEBAPP_URL: z.string().default('http://localhost:5173'),
  APP_URL: z.string().default('http://localhost:5173'),
  API_URL: z.string().default('http://localhost:3000'),
  WEBHOOK_URL: z.string().default(''),

  // Database
  DATABASE_URL: z.string().default('postgresql://vinted:vinted@localhost:5432/vintedbot'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Proxies
  PROXY_LIST: z.string().default(''),

  // Vinted
  VINTED_DOMAIN: z.string().default('www.vinted.fr'),

  // Scan
  DEFAULT_SCAN_INTERVAL: z.coerce.number().default(3),
  MAX_FILTERS_PER_USER: z.coerce.number().default(5),
  PEPITE_DEFAULT_THRESHOLD: z.coerce.number().default(0.30),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Server
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid configuration:');
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }
  return Object.freeze(result.data);
}

export const config = loadConfig();
