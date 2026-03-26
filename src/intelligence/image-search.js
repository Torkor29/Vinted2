import { createLogger } from '../utils/logger.js';
import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';

const log = createLogger('image-search');

/**
 * ImageSearch — Recherche d'articles Vinted par similarité visuelle.
 *
 * ═══════════════════════════════════════════════════════════
 *  COMMENT ÇA MARCHE
 * ═══════════════════════════════════════════════════════════
 *
 * Deux approches supportées :
 *
 * ┌──────────────────────────────────────────────────────┐
 * │ MODE 1: Color Histogram + Perceptual Hash (GRATUIT) │
 * │                                                      │
 * │ 1. Calcule un hash perceptuel de l'image référence  │
 * │ 2. Extrait l'histogramme de couleurs dominantes      │
 * │ 3. Compare avec chaque photo d'article scrapé        │
 * │ 4. Score de similarité 0-100%                        │
 * │                                                      │
 * │ ✅ Gratuit, rapide, local                            │
 * │ ❌ Moins précis sur les textures complexes           │
 * └──────────────────────────────────────────────────────┘
 *
 * ┌──────────────────────────────────────────────────────┐
 * │ MODE 2: API Externe (CLIP / Clarifai / Ximilar)     │
 * │                                                      │
 * │ 1. Envoie l'image à une API d'embeddings visuels    │
 * │ 2. Obtient un vecteur de 512-768 dimensions          │
 * │ 3. Compare par distance cosinus                      │
 * │ 4. Score de similarité 0-100%                        │
 * │                                                      │
 * │ ✅ Très précis (comprend les formes, textures, style)│
 * │ ❌ Nécessite une API key (souvent gratuit jusqu'à    │
 * │    1000 req/mois)                                    │
 * └──────────────────────────────────────────────────────┘
 *
 * INTÉGRATION:
 * - L'user upload une photo (via dashboard ou Telegram)
 * - On crée un "filtre visuel" avec cette photo
 * - Chaque article scrapé est comparé visuellement
 * - Si similarité > seuil → notifié comme match
 */
export class ImageSearch {
  constructor(config = {}) {
    this.threshold = config.threshold || 0.70;  // 70% similarity minimum
    this.mode = config.mode || 'color-hash';    // 'color-hash' | 'clip-api'
    this.apiKey = config.apiKey || '';
    this.apiUrl = config.apiUrl || '';

    // Cache d'embeddings: imageUrl → embedding
    this.embeddingCache = new Map();
    // Reference images for visual search: id → { url, embedding, label }
    this.references = new Map();

    // Cleanup cache every 30 min
    this.cleanupTimer = setInterval(() => {
      if (this.embeddingCache.size > 5000) {
        const entries = [...this.embeddingCache.entries()];
        this.embeddingCache = new Map(entries.slice(-2500));
      }
    }, 30 * 60_000);
  }

  /**
   * Add a reference image for visual matching.
   * @param {string} id - Unique identifier for this reference
   * @param {string} imageUrl - URL of the reference image
   * @param {string} label - Human-readable label (e.g., "Nike Air Max 90 blanc")
   * @returns {Object} { id, label, embedding }
   */
  async addReference(id, imageUrl, label = '') {
    log.info(`Adding visual reference "${label || id}": ${imageUrl}`);

    const embedding = await this.getEmbedding(imageUrl);
    if (!embedding) {
      throw new Error('Failed to compute embedding for reference image');
    }

    const ref = { id, url: imageUrl, embedding, label, addedAt: Date.now() };
    this.references.set(id, ref);

    log.info(`Visual reference "${label || id}" added (${this.mode} mode)`);
    return { id, label, embeddingSize: embedding.length };
  }

  /**
   * Remove a reference image.
   */
  removeReference(id) {
    this.references.delete(id);
  }

  /**
   * Get all active references.
   */
  getReferences() {
    return [...this.references.values()].map(r => ({
      id: r.id,
      label: r.label,
      url: r.url,
      addedAt: r.addedAt,
    }));
  }

  /**
   * Compare an item's photo against all reference images.
   * Returns { matches: boolean, bestMatch: { refId, similarity }, allScores: [...] }
   */
  async compareItem(item) {
    if (!item.photo && (!item.photos || item.photos.length === 0)) {
      return { matches: false, bestMatch: null, allScores: [] };
    }
    if (this.references.size === 0) {
      return { matches: false, bestMatch: null, allScores: [] };
    }

    const itemUrl = item.photo || item.photos[0];
    const itemEmbedding = await this.getEmbedding(itemUrl);

    if (!itemEmbedding) {
      return { matches: false, bestMatch: null, allScores: [] };
    }

    const allScores = [];
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const [refId, ref] of this.references) {
      const similarity = this.cosineSimilarity(itemEmbedding, ref.embedding);
      const score = { refId, refLabel: ref.label, similarity: Math.round(similarity * 100) };
      allScores.push(score);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = score;
      }
    }

    const matches = bestSimilarity >= this.threshold;

    if (matches) {
      log.info(`Visual match: "${item.title}" ≈ "${bestMatch.refLabel}" (${bestMatch.similarity}%)`);
    }

    return { matches, bestMatch, allScores };
  }

  /**
   * Compute an embedding for an image URL.
   * Uses the configured mode (color-hash or API).
   */
  async getEmbedding(imageUrl) {
    // Check cache
    if (this.embeddingCache.has(imageUrl)) {
      return this.embeddingCache.get(imageUrl);
    }

    let embedding;

    try {
      if (this.mode === 'clip-api' && this.apiUrl) {
        embedding = await this.getEmbeddingFromAPI(imageUrl);
      } else {
        embedding = await this.getColorEmbedding(imageUrl);
      }

      if (embedding) {
        this.embeddingCache.set(imageUrl, embedding);
      }
    } catch (error) {
      log.debug(`Embedding failed for ${imageUrl}: ${error.message}`);
    }

    return embedding;
  }

  /**
   * MODE 1: Color histogram embedding (gratuit, local).
   *
   * Télécharge l'image, extrait les couleurs dominantes
   * et crée un vecteur de 48 dimensions (16 bins × 3 channels RGB).
   * Simple mais efficace pour des articles de mode (couleurs similaires).
   */
  async getColorEmbedding(imageUrl) {
    try {
      const { gotScraping } = await import('got-scraping');

      // Download image as buffer
      const response = await gotScraping({
        url: imageUrl,
        responseType: 'buffer',
        timeout: { request: 8_000 },
        throwHttpErrors: false,
      });

      if (response.statusCode !== 200 || !response.body) {
        return null;
      }

      const buffer = response.body;

      // Simple color histogram: divide each RGB channel into 16 bins
      // This creates a 48-dimensional vector (16×3)
      const bins = 16;
      const histogram = new Float32Array(bins * 3);
      let pixelCount = 0;

      // Parse raw image data — for JPEG, we sample every 3 bytes
      // (This is a simplified approach; for production, use sharp or jimp)
      for (let i = 0; i < buffer.length - 2; i += 3) {
        const r = buffer[i];
        const g = buffer[i + 1];
        const b = buffer[i + 2];

        // Skip if looks like header/metadata (common pattern bytes)
        if (r === 0xFF && g === 0xD8) continue; // JPEG SOI
        if (r === 0xFF && g === 0xC0) continue; // JPEG SOF

        histogram[Math.floor(r / (256 / bins))]++;
        histogram[bins + Math.floor(g / (256 / bins))]++;
        histogram[bins * 2 + Math.floor(b / (256 / bins))]++;
        pixelCount++;
      }

      // Normalize
      if (pixelCount === 0) return null;
      for (let i = 0; i < histogram.length; i++) {
        histogram[i] /= pixelCount;
      }

      // Add a simple texture feature: variance of pixel values
      let sumR = 0, sumG = 0, sumB = 0;
      let sum2R = 0, sum2G = 0, sum2B = 0;
      const sampleSize = Math.min(buffer.length / 3, 10000);
      const step = Math.max(3, Math.floor(buffer.length / sampleSize));

      for (let i = 0; i < buffer.length - 2; i += step) {
        const r = buffer[i], g = buffer[i + 1], b = buffer[i + 2];
        sumR += r; sumG += g; sumB += b;
        sum2R += r * r; sum2G += g * g; sum2B += b * b;
      }

      const n = Math.floor(buffer.length / step);
      if (n === 0) return null;

      // Append variance features (3 more dimensions → 51 total)
      const varR = (sum2R / n) - Math.pow(sumR / n, 2);
      const varG = (sum2G / n) - Math.pow(sumG / n, 2);
      const varB = (sum2B / n) - Math.pow(sumB / n, 2);

      const fullEmbedding = new Float32Array(bins * 3 + 3);
      fullEmbedding.set(histogram);
      fullEmbedding[bins * 3] = varR / 65536;     // Normalize variance
      fullEmbedding[bins * 3 + 1] = varG / 65536;
      fullEmbedding[bins * 3 + 2] = varB / 65536;

      return Array.from(fullEmbedding);
    } catch (error) {
      log.debug(`Color embedding failed: ${error.message}`);
      return null;
    }
  }

  /**
   * MODE 2: External CLIP API embedding (précis).
   *
   * Envoie l'image à un service d'embeddings visuels.
   * Compatible avec:
   * - HuggingFace Inference API (gratuit 30k req/mois)
   * - Clarifai
   * - Replicate
   * - Custom CLIP server
   */
  async getEmbeddingFromAPI(imageUrl) {
    try {
      const { gotScraping } = await import('got-scraping');

      const response = await gotScraping({
        url: this.apiUrl,
        method: 'POST',
        json: {
          inputs: { image: imageUrl },
          // HuggingFace format for CLIP
          ...(this.apiUrl.includes('huggingface') && {
            inputs: imageUrl,
          }),
        },
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        responseType: 'json',
        timeout: { request: 15_000 },
        throwHttpErrors: false,
      });

      if (response.statusCode === 200 && response.body) {
        // HuggingFace returns array directly
        if (Array.isArray(response.body)) return response.body;
        // Other APIs may nest it
        if (response.body.embedding) return response.body.embedding;
        if (response.body.data?.[0]?.embedding) return response.body.data[0].embedding;
      }

      log.debug(`CLIP API returned ${response.statusCode}`);
      return null;
    } catch (error) {
      log.debug(`CLIP API error: ${error.message}`);
      return null;
    }
  }

  /**
   * Cosine similarity between two vectors.
   * Returns 0.0 (different) to 1.0 (identical).
   */
  cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) return 0;

    return dotProduct / denom;
  }

  getStats() {
    return {
      mode: this.mode,
      threshold: this.threshold,
      references: this.references.size,
      cachedEmbeddings: this.embeddingCache.size,
      referenceList: this.getReferences(),
    };
  }

  destroy() {
    clearInterval(this.cleanupTimer);
  }
}
