import { query, queryOne } from '../db/postgres.js';
import type { DbFilter } from '../types/database.js';
import type { CreateFilterInput, UpdateFilterInput } from '../types/api.js';
import { config } from '../config.js';

export async function createFilter(userId: number, input: CreateFilterInput): Promise<DbFilter> {
  // Check filter limit
  const countResult = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM filters WHERE user_id = $1',
    [userId],
  );
  const count = parseInt(countResult?.count ?? '0', 10);
  if (count >= config.MAX_FILTERS_PER_USER) {
    throw new Error(`Maximum ${config.MAX_FILTERS_PER_USER} filters allowed`);
  }

  const result = await queryOne<DbFilter>(
    `INSERT INTO filters (
      user_id, name, search_text, catalog_ids, brand_ids, size_ids,
      color_ids, material_ids, status_ids, price_from, price_to, currency,
      country_ids, city_ids, shipping_options, is_unisex,
      sort_by, scan_interval_seconds, pepite_enabled, pepite_threshold
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
    ) RETURNING *`,
    [
      userId, input.name, input.search_text ?? null,
      input.catalog_ids ?? null, input.brand_ids ?? null, input.size_ids ?? null,
      input.color_ids ?? null, input.material_ids ?? null, input.status_ids ?? null,
      input.price_from ?? null, input.price_to ?? null, input.currency,
      input.country_ids ?? null, input.city_ids ?? null, input.shipping_options ?? null,
      input.is_unisex ?? null, input.sort_by, input.scan_interval_seconds,
      input.pepite_enabled, input.pepite_threshold,
    ],
  );

  if (!result) throw new Error('Failed to create filter');
  return result;
}

export async function updateFilter(filterId: string, userId: number, input: UpdateFilterInput): Promise<DbFilter | null> {
  const existing = await queryOne<DbFilter>(
    'SELECT * FROM filters WHERE id = $1 AND user_id = $2',
    [filterId, userId],
  );
  if (!existing) return null;

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const mappings: Array<[keyof UpdateFilterInput, string]> = [
    ['name', 'name'], ['search_text', 'search_text'], ['catalog_ids', 'catalog_ids'],
    ['brand_ids', 'brand_ids'], ['size_ids', 'size_ids'], ['color_ids', 'color_ids'],
    ['material_ids', 'material_ids'], ['status_ids', 'status_ids'],
    ['price_from', 'price_from'], ['price_to', 'price_to'], ['currency', 'currency'],
    ['country_ids', 'country_ids'], ['city_ids', 'city_ids'], ['shipping_options', 'shipping_options'],
    ['is_unisex', 'is_unisex'], ['sort_by', 'sort_by'],
    ['scan_interval_seconds', 'scan_interval_seconds'],
    ['pepite_enabled', 'pepite_enabled'], ['pepite_threshold', 'pepite_threshold'],
    ['is_active', 'is_active'],
  ];

  for (const [key, col] of mappings) {
    if (input[key] !== undefined) {
      fields.push(`${col} = $${idx++}`);
      values.push(input[key]);
    }
  }

  if (fields.length === 0) return existing;

  fields.push(`updated_at = NOW()`);
  values.push(filterId, userId);

  return queryOne<DbFilter>(
    `UPDATE filters SET ${fields.join(', ')}
     WHERE id = $${idx++} AND user_id = $${idx}
     RETURNING *`,
    values,
  );
}

export async function deleteFilter(filterId: string, userId: number): Promise<boolean> {
  const result = await query(
    'DELETE FROM filters WHERE id = $1 AND user_id = $2',
    [filterId, userId],
  );
  return result.length >= 0; // DELETE always succeeds
}

export async function getFiltersByUser(userId: number): Promise<DbFilter[]> {
  return query<DbFilter>(
    'SELECT * FROM filters WHERE user_id = $1 ORDER BY created_at DESC',
    [userId],
  );
}

export async function getFilterById(filterId: string): Promise<DbFilter | null> {
  return queryOne<DbFilter>('SELECT * FROM filters WHERE id = $1', [filterId]);
}

export async function getActiveFilters(): Promise<DbFilter[]> {
  return query<DbFilter>(
    `SELECT f.* FROM filters f
     JOIN users u ON f.user_id = u.id
     WHERE f.is_active = TRUE AND u.notification_enabled = TRUE
     ORDER BY f.last_scanned_at ASC NULLS FIRST`,
  );
}

export async function toggleFilter(filterId: string, userId: number): Promise<DbFilter | null> {
  return queryOne<DbFilter>(
    `UPDATE filters SET is_active = NOT is_active, updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [filterId, userId],
  );
}

export async function updateLastScanned(filterId: string): Promise<void> {
  await query(
    'UPDATE filters SET last_scanned_at = NOW() WHERE id = $1',
    [filterId],
  );
}
