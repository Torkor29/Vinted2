import { query, queryOne } from '../db/postgres.js';
import { cache } from '../db/redis.js';
import { searchVinted } from '../scraper/vinted-client.js';
import type { DbPriceReference } from '../types/database.js';
import type { VintedItem } from '../types/vinted.js';
import crypto from 'crypto';
import pino from 'pino';

const logger = pino({ name: 'price-service' });

const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 hours

interface PriceAnalysis {
  avgPrice: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  sampleCount: number;
}

function buildSearchKey(catalogId: number | null, brandId: number | null, sizeId: string | null, conditionId: number | null): string {
  const parts = [
    catalogId ?? 'any',
    brandId ?? 'any',
    sizeId ?? 'any',
    conditionId ?? 'any',
  ];
  return crypto.createHash('md5').update(parts.join(':')).digest('hex');
}

export async function getPriceReference(
  catalogId: number | null,
  brandId: number | null,
  sizeId: string | null,
  conditionId: number | null,
): Promise<PriceAnalysis | null> {
  const searchKey = buildSearchKey(catalogId, brandId, sizeId, conditionId);

  // Check cache first
  const cached = await cache.get<PriceAnalysis>(`price:${searchKey}`);
  if (cached) return cached;

  // Check DB
  const ref = await queryOne<DbPriceReference>(
    `SELECT * FROM price_references
     WHERE search_key = $1 AND expires_at > NOW()
     ORDER BY calculated_at DESC LIMIT 1`,
    [searchKey],
  );

  if (ref && ref.avg_price && ref.median_price) {
    const analysis: PriceAnalysis = {
      avgPrice: parseFloat(ref.avg_price),
      medianPrice: parseFloat(ref.median_price),
      minPrice: parseFloat(ref.min_price ?? '0'),
      maxPrice: parseFloat(ref.max_price ?? '0'),
      sampleCount: ref.sample_count ?? 0,
    };
    await cache.set(`price:${searchKey}`, analysis, CACHE_TTL_SECONDS);
    return analysis;
  }

  // Fetch from Vinted
  try {
    const analysis = await fetchAndComputePrices(catalogId, brandId, sizeId, conditionId);
    if (analysis) {
      await savePriceReference(searchKey, catalogId, brandId, sizeId, conditionId, analysis);
      await cache.set(`price:${searchKey}`, analysis, CACHE_TTL_SECONDS);
    }
    return analysis;
  } catch (err) {
    logger.warn({ err }, 'Failed to fetch price reference');
    return null;
  }
}

async function fetchAndComputePrices(
  catalogId: number | null,
  brandId: number | null,
  sizeId: string | null,
  conditionId: number | null,
): Promise<PriceAnalysis | null> {
  const params: Record<string, unknown> = {
    order: 'relevance',
    per_page: 48,
  };

  if (catalogId) params.catalog_ids = String(catalogId);
  if (brandId) params.brand_ids = String(brandId);
  if (sizeId) params.size_ids = sizeId;
  if (conditionId) params.status_ids = String(conditionId);

  const response = await searchVinted(params as never);

  if (response.items.length < 5) {
    return null; // Not enough data for reliable pricing
  }

  const prices = response.items
    .map(item => parseFloat(item.price))
    .filter(p => p > 0)
    .sort((a, b) => a - b);

  if (prices.length === 0) return null;

  const sum = prices.reduce((a, b) => a + b, 0);
  const avg = sum / prices.length;
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 !== 0
    ? prices[mid]!
    : (prices[mid - 1]! + prices[mid]!) / 2;

  return {
    avgPrice: Math.round(avg * 100) / 100,
    medianPrice: Math.round(median * 100) / 100,
    minPrice: prices[0]!,
    maxPrice: prices[prices.length - 1]!,
    sampleCount: prices.length,
  };
}

async function savePriceReference(
  searchKey: string,
  catalogId: number | null,
  brandId: number | null,
  sizeId: string | null,
  conditionId: number | null,
  analysis: PriceAnalysis,
): Promise<void> {
  await query(
    `INSERT INTO price_references (search_key, catalog_id, brand_id, size_id, condition_id,
       avg_price, median_price, min_price, max_price, sample_count, calculated_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW() + INTERVAL '6 hours')
     ON CONFLICT (id) DO NOTHING`,
    [searchKey, catalogId, brandId, sizeId, conditionId,
     analysis.avgPrice, analysis.medianPrice, analysis.minPrice, analysis.maxPrice, analysis.sampleCount],
  );
}

export async function checkIsPepite(
  item: VintedItem,
  threshold: number = 0.30,
): Promise<{ isPepite: boolean; marketPrice: number | null; diffPct: number | null }> {
  const catalogId = item.category_id ?? null;
  const brandId = null; // Would need brand_id from item, not always available in search results
  const sizeId = null;
  const conditionId = null;

  const priceRef = await getPriceReference(catalogId, brandId, sizeId, conditionId);

  if (!priceRef || priceRef.sampleCount < 5) {
    return { isPepite: false, marketPrice: null, diffPct: null };
  }

  const articlePrice = parseFloat(item.price);
  const diffPct = ((articlePrice - priceRef.medianPrice) / priceRef.medianPrice) * 100;

  const isPepite = diffPct <= -(threshold * 100);

  return {
    isPepite,
    marketPrice: priceRef.medianPrice,
    diffPct: Math.round(diffPct * 100) / 100,
  };
}

export async function refreshPriceReferences(): Promise<void> {
  // Get distinct combinations from recent articles
  const combos = await query<{
    category_id: number | null;
    brand_id: number | null;
  }>(
    `SELECT DISTINCT
       CASE WHEN category_name IS NOT NULL THEN 1 ELSE NULL END as category_id,
       NULL as brand_id
     FROM articles
     WHERE detected_at > NOW() - INTERVAL '7 days'
     LIMIT 100`,
  );

  logger.info(`Refreshing price references for ${combos.length} combinations`);

  for (const combo of combos) {
    try {
      await getPriceReference(combo.category_id, combo.brand_id, null, null);
    } catch (err) {
      logger.warn({ err, combo }, 'Failed to refresh price reference');
    }
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}
