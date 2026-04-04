import fs from 'fs';
import path from 'path';
import { query, queryOne, transaction } from './postgres.js';
import pino from 'pino';

const logger = pino({ name: 'migrate' });

export async function runMigrations(): Promise<void> {
  // Ensure migrations table exists
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Try multiple possible locations for migrations
  const candidates = [
    path.join(process.cwd(), 'src', 'db', 'migrations'),
    path.join(process.cwd(), 'dist', 'db', 'migrations'),
    path.join(process.cwd(), 'migrations'),
  ];

  let migrationsDir = '';
  let files: string[] = [];

  for (const dir of candidates) {
    try {
      files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
      if (files.length > 0) {
        migrationsDir = dir;
        break;
      }
    } catch {
      // try next
    }
  }

  if (!migrationsDir || files.length === 0) {
    logger.warn('No migration files found');
    return;
  }

  await applyMigrations(migrationsDir, files);
}

async function applyMigrations(dir: string, files: string[]): Promise<void> {
  for (const file of files) {
    const existing = await queryOne<{ name: string }>(
      'SELECT name FROM _migrations WHERE name = $1',
      [file],
    );

    if (existing) {
      logger.debug(`Migration ${file} already applied, skipping`);
      continue;
    }

    const sql = fs.readFileSync(path.join(dir, file), 'utf-8');

    await transaction(async (client) => {
      await client.query(sql);
      await client.query(
        'INSERT INTO _migrations (name) VALUES ($1)',
        [file],
      );
    });

    logger.info(`Applied migration: ${file}`);
  }
}
