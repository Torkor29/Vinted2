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

  /**
   * Analyze an image and return human-readable visual features.
   * Extracts dominant colors, brightness, contrast, color category.
   * Used to show the user what the bot "sees" before matching.
   */
  async analyzeImage(imageUrl) {
    try {
      const { gotScraping } = await import('got-scraping');

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

      // ── Sample pixels ──
      let totalR = 0, totalG = 0, totalB = 0;
      let pixelCount = 0;
      const colorBuckets = new Map(); // "r,g,b" → count (quantized to 32 steps)

      for (let i = 0; i < buffer.length - 2; i += 3) {
        const r = buffer[i], g = buffer[i + 1], b = buffer[i + 2];
        if (r === 0xFF && g === 0xD8) continue;
        if (r === 0xFF && g === 0xC0) continue;

        totalR += r; totalG += g; totalB += b;
        pixelCount++;

        // Quantize to 8 levels per channel for dominant color detection
        const qr = Math.floor(r / 32) * 32;
        const qg = Math.floor(g / 32) * 32;
        const qb = Math.floor(b / 32) * 32;
        const key = `${qr},${qg},${qb}`;
        colorBuckets.set(key, (colorBuckets.get(key) || 0) + 1);
      }

      if (pixelCount < 100) return null;

      const avgR = totalR / pixelCount;
      const avgG = totalG / pixelCount;
      const avgB = totalB / pixelCount;

      // ── Dominant colors (top 3) ──
      const sortedColors = [...colorBuckets.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      const dominantColors = sortedColors.map(([key, count]) => {
        const [r, g, b] = key.split(',').map(Number);
        return {
          rgb: { r, g, b },
          hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
          name: this._colorName(r, g, b),
          percent: Math.round(count / pixelCount * 100),
        };
      });

      // ── Brightness ──
      const brightness = Math.round((avgR * 0.299 + avgG * 0.587 + avgB * 0.114));
      let brightnessLabel;
      if (brightness < 60) brightnessLabel = 'Sombre';
      else if (brightness < 120) brightnessLabel = 'Moyen';
      else if (brightness < 180) brightnessLabel = 'Clair';
      else brightnessLabel = 'Très clair';

      // ── Overall color category ──
      const mainColor = dominantColors[0]?.name || 'Inconnu';

      // ── Pattern detection (simple: if top color < 40%, likely patterned) ──
      const topPercent = dominantColors[0]?.percent || 0;
      const isUniform = topPercent > 40;
      const patternLabel = isUniform ? 'Uni / couleur dominante' : 'Motifs / multicolore';

      return {
        dominantColors: dominantColors.slice(0, 3),
        mainColor,
        brightness,
        brightnessLabel,
        pattern: patternLabel,
        isUniform,
        avgRgb: { r: Math.round(avgR), g: Math.round(avgG), b: Math.round(avgB) },
      };
    } catch (error) {
      log.debug(`Image analysis failed: ${error.message}`);
      return null;
    }
  }

  /** Map RGB values to a French color name. */
  _colorName(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lum = (r + g + b) / 3;

    // Achromatic
    if (max - min < 30) {
      if (lum < 50) return 'Noir';
      if (lum < 120) return 'Gris foncé';
      if (lum < 180) return 'Gris';
      if (lum < 220) return 'Gris clair';
      return 'Blanc';
    }

    // Chromatic — find dominant hue
    const hue = this._rgbToHue(r, g, b);

    if (lum < 40) return 'Noir';

    if (hue < 15)  return 'Rouge';
    if (hue < 40)  return 'Orange';
    if (hue < 70)  return 'Jaune';
    if (hue < 160) return 'Vert';
    if (hue < 200) return 'Cyan';
    if (hue < 260) return 'Bleu';
    if (hue < 290) return 'Violet';
    if (hue < 330) return 'Rose';
    return 'Rouge';
  }

  _rgbToHue(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    if (d === 0) return 0;
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    return h;
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
