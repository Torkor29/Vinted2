import { createLogger } from '../utils/logger.js';

const log = createLogger('listing-gen');

/**
 * ListingGenerator — Génère des annonces Vinted optimisées SEO
 * à partir d'une description courte (ex: "jogging nike gris").
 *
 * Pas besoin d'API externe — tout est basé sur des templates
 * et des règles SEO Vinted connues.
 *
 * STRATÉGIE SEO VINTED:
 * - Titre: marque + type + détails (couleur, taille) — 5-10 mots max
 * - Description: structure en blocs avec emojis, mots-clés naturels
 * - Mots-clés dans le titre ET la description (Vinted indexe les deux)
 * - Hashtags: Vinted ne les utilise PAS pour le SEO (contrairement à Depop)
 * - Prix psychologique: .99 ou .50
 * - Les 24 premières heures sont cruciales (boost algorithmique)
 */
export class ListingGenerator {
  constructor() {
    // Synonymes et variantes pour enrichir le SEO
    this.typeVariants = {
      // Hauts
      'tshirt': ['T-shirt', 'Tee-shirt', 'Top'],
      't-shirt': ['T-shirt', 'Tee-shirt', 'Top'],
      'tee': ['T-shirt', 'Tee-shirt'],
      'polo': ['Polo', 'Polo manches courtes'],
      'chemise': ['Chemise', 'Chemise casual'],
      'pull': ['Pull', 'Pullover', 'Sweat'],
      'sweat': ['Sweat', 'Sweatshirt', 'Pull'],
      'hoodie': ['Hoodie', 'Sweat à capuche', 'Sweat-shirt'],
      'veste': ['Veste', 'Jacket', 'Blouson'],
      'blouson': ['Blouson', 'Veste', 'Jacket'],
      'manteau': ['Manteau', 'Coat', 'Pardessus'],
      'doudoune': ['Doudoune', 'Puffer', 'Manteau matelassé'],
      'gilet': ['Gilet', 'Cardigan', 'Vest'],
      'crop': ['Crop top', 'Top court', 'Haut court'],
      'débardeur': ['Débardeur', 'Tank top', 'Marcel'],
      // Bas
      'jean': ['Jean', 'Jeans', 'Denim'],
      'jeans': ['Jean', 'Jeans', 'Denim'],
      'pantalon': ['Pantalon', 'Pants'],
      'jogging': ['Jogging', 'Pantalon de jogging', 'Survêtement', 'Jogger'],
      'jogger': ['Jogger', 'Jogging', 'Pantalon de sport'],
      'short': ['Short', 'Bermuda'],
      'legging': ['Legging', 'Leggings', 'Collant sport'],
      'survet': ['Survêtement', 'Ensemble jogging', 'Tracksuit'],
      'survêtement': ['Survêtement', 'Ensemble jogging', 'Tracksuit'],
      // Chaussures
      'basket': ['Baskets', 'Sneakers', 'Chaussures de sport'],
      'baskets': ['Baskets', 'Sneakers', 'Chaussures de sport'],
      'sneakers': ['Sneakers', 'Baskets', 'Tennis'],
      'chaussure': ['Chaussures', 'Shoes'],
      'boots': ['Boots', 'Bottines', 'Bottes'],
      'sandales': ['Sandales', 'Sandals'],
      // Accessoires
      'sac': ['Sac', 'Sac à main', 'Bag'],
      'casquette': ['Casquette', 'Cap'],
      'bonnet': ['Bonnet', 'Beanie'],
      'écharpe': ['Écharpe', 'Foulard', 'Scarf'],
      'ceinture': ['Ceinture', 'Belt'],
      'montre': ['Montre', 'Watch'],
      'lunettes': ['Lunettes', 'Sunglasses'],
      // Ensembles
      'ensemble': ['Ensemble', 'Set', 'Lot'],
    };

    this.conditionPhrases = {
      'neuf_etiquette': ['Neuf avec étiquette 🏷️', 'Jamais porté, étiquette encore attachée', 'NEUF — encore emballé'],
      'neuf': ['Neuf sans étiquette ✨', 'Jamais porté', 'État neuf, aucune trace d\'usure'],
      'tres_bon': ['Très bon état 👌', 'Porté quelques fois, comme neuf', 'Excellent état, aucun défaut'],
      'bon': ['Bon état 👍', 'Porté mais bien entretenu', 'Quelques traces d\'usure normales'],
      'satisfaisant': ['État correct', 'Porté régulièrement, traces d\'usure visibles'],
    };

    this.emojis = {
      clothing: ['👕', '👔', '🧥', '👖', '🩳'],
      shoes: ['👟', '👠', '👞', '🥾', '👢'],
      accessories: ['👜', '🧢', '🧣', '⌚', '🕶️'],
      generic: ['✨', '🔥', '💫', '⭐', '💎'],
      shipping: ['📦', '🚀', '✈️'],
      price: ['💰', '🏷️', '💸'],
    };
  }

  /**
   * Génère une annonce complète à partir d'une description courte.
   *
   * @param {string} input - Ex: "jogging nike gris", "air max 90 blanc 42"
   * @param {Object} [options] - Options supplémentaires
   * @param {string} [options.condition] - neuf_etiquette|neuf|tres_bon|bon|satisfaisant
   * @param {string} [options.size] - Taille (M, L, 42, etc.)
   * @param {number} [options.price] - Prix souhaité
   * @param {string} [options.gender] - homme|femme|unisexe|enfant
   * @param {string} [options.extras] - Détails supplémentaires
   * @returns {Object} { title, description, suggestedPrice, tags, category, tips }
   */
  generate(input, options = {}) {
    const parsed = this.parseInput(input);
    const merged = { ...parsed, ...options };

    // Override parsed values with explicit options
    if (options.size) merged.size = options.size;
    if (options.condition) merged.condition = options.condition;

    const title = this.generateTitle(merged);
    const description = this.generateDescription(merged, options.extras);
    const suggestedPrice = this.suggestPrice(merged, options.price);
    const tags = this.generateTags(merged);
    const tips = this.generateTips(merged);

    const result = {
      title,
      description,
      suggestedPrice,
      tags,
      tips,
      parsed: merged,
    };

    log.info(`Generated listing: "${title}" from "${input}"`);
    return result;
  }

  /**
   * Parse une description courte en composants structurés.
   * "jogging nike gris taille M neuf" → { type, brand, color, size, condition }
   */
  parseInput(input) {
    const lower = input.toLowerCase().trim();
    const words = lower.split(/\s+/);

    const result = {
      type: null,
      typeLabel: null,
      brand: null,
      color: null,
      size: null,
      condition: 'tres_bon', // default
      model: null,
      gender: null,
      material: null,
      rawInput: input,
    };

    // ── Detect brand ──
    const brands = {
      'nike': 'Nike', 'air max': 'Nike', 'air force': 'Nike', 'air jordan': 'Nike',
      'adidas': 'Adidas', 'yeezy': 'Adidas', 'puma': 'Puma', 'reebok': 'Reebok',
      'new balance': 'New Balance', 'nb': 'New Balance',
      'jordan': 'Jordan', 'air jordan': 'Air Jordan',
      'ralph lauren': 'Ralph Lauren', 'polo': 'Ralph Lauren',
      'lacoste': 'Lacoste', 'tommy': 'Tommy Hilfiger', 'tommy hilfiger': 'Tommy Hilfiger',
      'zara': 'Zara', 'h&m': 'H&M', 'hm': 'H&M',
      'uniqlo': 'Uniqlo', 'gap': 'GAP',
      'north face': 'The North Face', 'tnf': 'The North Face', 'the north face': 'The North Face',
      'carhartt': 'Carhartt', 'dickies': 'Dickies',
      'levi': "Levi's", "levi's": "Levi's", 'levis': "Levi's",
      'gucci': 'Gucci', 'louis vuitton': 'Louis Vuitton', 'lv': 'Louis Vuitton',
      'balenciaga': 'Balenciaga', 'off white': 'Off-White', 'off-white': 'Off-White',
      'supreme': 'Supreme', 'stussy': 'Stüssy', 'stüssy': 'Stüssy',
      'champion': 'Champion', 'fila': 'Fila', 'asics': 'Asics',
      'converse': 'Converse', 'vans': 'Vans',
      'hugo boss': 'Hugo Boss', 'boss': 'Hugo Boss',
      'calvin klein': 'Calvin Klein', 'ck': 'Calvin Klein',
      'versace': 'Versace', 'armani': 'Armani', 'emporio': 'Emporio Armani',
      'stone island': 'Stone Island', 'cp company': 'C.P. Company',
      'moncler': 'Moncler', 'canada goose': 'Canada Goose',
      'timberland': 'Timberland', 'dr martens': 'Dr. Martens',
      'salomon': 'Salomon', 'columbia': 'Columbia', 'patagonia': 'Patagonia',
      'under armour': 'Under Armour', 'ua': 'Under Armour',
      'kappa': 'Kappa', 'ellesse': 'Ellesse', 'sergio tacchini': 'Sergio Tacchini',
      'napapijri': 'Napapijri', 'helly hansen': 'Helly Hansen',
    };

    // Check multi-word brands first
    for (const [key, label] of Object.entries(brands)) {
      if (lower.includes(key)) {
        result.brand = label;
        break;
      }
    }

    // ── Detect type ──
    for (const [key, variants] of Object.entries(this.typeVariants)) {
      if (words.includes(key) || lower.includes(key)) {
        result.type = key;
        result.typeLabel = variants[0];
        break;
      }
    }

    // ── Detect color ──
    const colors = {
      'noir': 'Noir', 'black': 'Noir',
      'blanc': 'Blanc', 'white': 'Blanc',
      'gris': 'Gris', 'grey': 'Gris', 'gray': 'Gris',
      'bleu': 'Bleu', 'blue': 'Bleu', 'navy': 'Bleu marine', 'marine': 'Bleu marine', 'bleu marine': 'Bleu marine',
      'rouge': 'Rouge', 'red': 'Rouge',
      'vert': 'Vert', 'green': 'Vert', 'kaki': 'Kaki', 'khaki': 'Kaki',
      'jaune': 'Jaune', 'yellow': 'Jaune',
      'orange': 'Orange',
      'rose': 'Rose', 'pink': 'Rose',
      'violet': 'Violet', 'purple': 'Violet',
      'marron': 'Marron', 'brown': 'Marron', 'beige': 'Beige', 'camel': 'Camel',
      'bordeaux': 'Bordeaux', 'burgundy': 'Bordeaux',
      'crème': 'Crème', 'cream': 'Crème', 'écru': 'Écru',
      'multicolore': 'Multicolore',
    };

    for (const [key, label] of Object.entries(colors)) {
      if (words.includes(key)) {
        result.color = label;
        break;
      }
    }

    // ── Detect size ──
    const sizePatterns = [
      /\btaille?\s*(\w+)/i,
      /\b(XXS|XS|S|M|L|XL|XXL|3XL|4XL)\b/i,
      /\b(3[4-9]|4[0-9]|5[0-2])\b/, // shoe sizes
      /\b(34|36|38|40|42|44|46|48|50)\b/, // clothing EU sizes
    ];

    for (const pattern of sizePatterns) {
      const match = lower.match(pattern);
      if (match) {
        result.size = match[1] || match[0];
        break;
      }
    }

    // ── Detect condition ──
    if (lower.includes('neuf') && (lower.includes('etiquette') || lower.includes('étiquette') || lower.includes('tag'))) {
      result.condition = 'neuf_etiquette';
    } else if (lower.includes('neuf') || lower.includes('new')) {
      result.condition = 'neuf';
    } else if (lower.includes('très bon') || lower.includes('tres bon') || lower.includes('excellent')) {
      result.condition = 'tres_bon';
    } else if (lower.includes('bon état') || lower.includes('bon etat') || lower.includes('good')) {
      result.condition = 'bon';
    }

    // ── Detect gender ──
    if (lower.includes('femme') || lower.includes('woman') || lower.includes('fille')) {
      result.gender = 'femme';
    } else if (lower.includes('homme') || lower.includes('man') || lower.includes('garçon')) {
      result.gender = 'homme';
    } else if (lower.includes('enfant') || lower.includes('kid') || lower.includes('bébé')) {
      result.gender = 'enfant';
    } else if (lower.includes('unisex')) {
      result.gender = 'unisexe';
    }

    // ── Detect model (remaining meaningful words) ──
    const knownWords = new Set([
      ...Object.keys(brands), ...Object.keys(this.typeVariants),
      ...Object.keys(colors), 'marine', 'clair', 'foncé', 'fonce',
      'taille', 'neuf', 'etiquette', 'étiquette',
      'bon', 'état', 'etat', 'très', 'tres', 'homme', 'femme', 'enfant',
      'unisexe', 'tag', 'excellent', 'new',
    ]);

    const modelWords = words.filter(w =>
      w.length > 1 && !knownWords.has(w) && !/^\d{1,2}$/.test(w)
    );
    if (modelWords.length > 0) {
      result.model = modelWords.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    return result;
  }

  /**
   * Génère un titre SEO optimisé pour Vinted.
   * Format idéal: [Marque] [Type] [Modèle] [Couleur] [Taille]
   */
  generateTitle(data) {
    const parts = [];

    if (data.brand) parts.push(data.brand);
    if (data.typeLabel) parts.push(data.typeLabel);
    // Only add model if it doesn't duplicate the brand
    if (data.model && !data.model.toLowerCase().includes((data.brand || '').toLowerCase())) {
      parts.push(data.model);
    }
    if (data.color) parts.push(data.color);
    if (data.size) parts.push(`Taille ${data.size.toUpperCase()}`);

    // Si rien de significatif, utiliser l'input brut
    if (parts.length === 0) return data.rawInput;

    // Ajouter un qualificatif si neuf
    if (data.condition === 'neuf_etiquette') {
      parts.push('NEUF');
    }

    return parts.join(' ');
  }

  /**
   * Génère une description vendeuse avec emojis et structure.
   */
  generateDescription(data, extras) {
    const lines = [];
    const emoji = this.pickEmoji(data);

    // ── Accroche ──
    const hooks = this.getHooks(data);
    lines.push(hooks[Math.floor(Math.random() * hooks.length)]);
    lines.push('');

    // ── Détails produit ──
    lines.push('📋 𝗗𝗘́𝗧𝗔𝗜𝗟𝗦 :');
    if (data.brand) lines.push(`🏷️ Marque : ${data.brand}`);
    if (data.typeLabel) lines.push(`${emoji} Type : ${data.typeLabel}`);
    if (data.model) lines.push(`✨ Modèle : ${data.model}`);
    if (data.color) lines.push(`🎨 Couleur : ${data.color}`);
    if (data.size) lines.push(`📏 Taille : ${data.size.toUpperCase()}`);
    if (data.material) lines.push(`🧵 Matière : ${data.material}`);
    lines.push('');

    // ── État ──
    const condPhrase = this.conditionPhrases[data.condition] || this.conditionPhrases['tres_bon'];
    lines.push(`📦 𝗘́𝗧𝗔𝗧 : ${condPhrase[0]}`);
    lines.push(condPhrase[1]);
    lines.push('');

    // ── Extras (détails supplémentaires) ──
    if (extras) {
      lines.push(`ℹ️ ${extras}`);
      lines.push('');
    }

    // ── Call to action ──
    lines.push('─────────────────');
    const ctas = [
      '📩 N\'hésitez pas à me contacter pour plus d\'infos !',
      '💬 Une question ? Envoyez-moi un message !',
      '🤝 Ouvert aux offres raisonnables',
    ];
    lines.push(ctas[Math.floor(Math.random() * ctas.length)]);

    // ── Shipping ──
    lines.push('📦 Envoi rapide et soigné sous 24-48h');
    lines.push('');

    // ── Keywords naturels (SEO boost) ──
    const seoLine = this.generateSEOLine(data);
    if (seoLine) {
      lines.push(seoLine);
    }

    return lines.join('\n');
  }

  /**
   * Génère une ligne de mots-clés naturels (pas de hashtags sur Vinted).
   */
  generateSEOLine(data) {
    const keywords = [];

    if (data.brand) {
      keywords.push(data.brand.toLowerCase());
      // Add common search variants
      if (data.brand === 'Nike') keywords.push('nike sportswear', 'just do it');
      if (data.brand === 'Adidas') keywords.push('adidas originals', 'trefoil');
      if (data.brand === 'The North Face') keywords.push('tnf', 'north face');
      if (data.brand === "Levi's") keywords.push('levis', 'levi strauss');
      if (data.brand === 'Ralph Lauren') keywords.push('polo ralph lauren', 'rl');
    }

    if (data.type) {
      const variants = this.typeVariants[data.type] || [];
      keywords.push(...variants.map(v => v.toLowerCase()));
    }

    if (data.gender === 'homme') keywords.push('homme', 'men', 'masculin');
    if (data.gender === 'femme') keywords.push('femme', 'women', 'féminin');

    if (keywords.length === 0) return null;

    // Format as a natural sentence, not hashtags
    const unique = [...new Set(keywords)].slice(0, 8);
    return `🔍 ${unique.join(' • ')}`;
  }

  /**
   * Génère des accroches variées selon le produit.
   */
  getHooks(data) {
    const brand = data.brand || 'cette pièce';
    const type = data.typeLabel?.toLowerCase() || 'article';

    return [
      `${this.pickEmoji(data)} ${brand} ${type} en excellent état ! À saisir rapidement 🔥`,
      `✨ Superbe ${type} ${brand} — parfait pour compléter votre garde-robe !`,
      `🔥 ${brand} ${type} à prix imbattable ! Ne ratez pas cette occasion`,
      `💎 Pièce ${brand} authentique — qualité et style garantis`,
      `⚡ ${brand} ${type} — porté${data.gender === 'femme' ? 'e' : ''} ou pas, toujours au top !`,
    ];
  }

  /**
   * Sélectionne un emoji adapté au type de produit.
   */
  pickEmoji(data) {
    const type = data.type || '';
    if (['basket', 'baskets', 'sneakers', 'chaussure', 'boots', 'sandales'].includes(type)) {
      return '👟';
    }
    if (['sac', 'casquette', 'bonnet', 'écharpe', 'ceinture', 'montre', 'lunettes'].includes(type)) {
      return '👜';
    }
    return '👕';
  }

  /**
   * Suggère un prix de vente.
   */
  suggestPrice(data, requestedPrice) {
    if (requestedPrice) {
      return {
        suggested: requestedPrice,
        psychological: this.psychologicalPrice(requestedPrice),
        tip: 'Prix fixé manuellement',
      };
    }

    // Estimation basique par type + marque (fourchettes approximatives)
    const baseRanges = {
      'tshirt': [5, 15], 'polo': [8, 25], 'chemise': [10, 30],
      'pull': [10, 35], 'sweat': [12, 40], 'hoodie': [15, 50],
      'veste': [15, 60], 'blouson': [20, 80], 'manteau': [25, 100],
      'doudoune': [25, 120], 'jean': [10, 40], 'pantalon': [8, 30],
      'jogging': [8, 35], 'short': [5, 20], 'survet': [15, 60],
      'basket': [15, 80], 'sneakers': [15, 80], 'boots': [15, 60],
      'sac': [10, 60], 'casquette': [5, 25],
    };

    const brandMultiplier = {
      'Nike': 1.3, 'Adidas': 1.2, 'Jordan': 1.8, 'The North Face': 1.5,
      'Ralph Lauren': 1.4, 'Lacoste': 1.3, 'Tommy Hilfiger': 1.3,
      'Gucci': 3.0, 'Louis Vuitton': 3.0, 'Balenciaga': 2.5,
      'Supreme': 2.0, 'Stone Island': 2.0, 'Moncler': 2.5,
      'Off-White': 2.0, "Levi's": 1.2, 'Carhartt': 1.3,
    };

    const condMultiplier = {
      'neuf_etiquette': 1.0, 'neuf': 0.85, 'tres_bon': 0.7,
      'bon': 0.55, 'satisfaisant': 0.4,
    };

    const range = baseRanges[data.type] || [8, 30];
    const mid = (range[0] + range[1]) / 2;
    const bMult = brandMultiplier[data.brand] || 1.0;
    const cMult = condMultiplier[data.condition] || 0.7;

    const estimated = Math.round(mid * bMult * cMult);
    const low = Math.round(range[0] * bMult * cMult);
    const high = Math.round(range[1] * bMult * cMult);

    return {
      suggested: this.psychologicalPrice(estimated),
      range: { low: this.psychologicalPrice(low), high: this.psychologicalPrice(high) },
      tip: `Fourchette ${low}-${high}€ pour un ${data.typeLabel || 'article'} ${data.brand || ''} en ${data.condition?.replace('_', ' ') || 'bon état'}`,
    };
  }

  /**
   * Arrondit au prix psychologique le plus proche (.99 ou .50).
   */
  psychologicalPrice(price) {
    if (price <= 5) return Math.max(1, Math.round(price));
    if (price <= 15) return Math.round(price) - 0.5 > 0 ? Math.round(price) : price;
    if (price <= 50) return Math.round(price / 5) * 5 - 0.50;
    return Math.round(price / 5) * 5 - 1;
  }

  /**
   * Génère des tags/mots-clés pour la recherche interne.
   */
  generateTags(data) {
    const tags = [];
    if (data.brand) tags.push(data.brand);
    if (data.typeLabel) tags.push(data.typeLabel);
    if (data.model) tags.push(data.model);
    if (data.color) tags.push(data.color);
    if (data.type) {
      const variants = this.typeVariants[data.type] || [];
      tags.push(...variants.slice(1)); // Skip first (already used as typeLabel)
    }
    return [...new Set(tags)];
  }

  /**
   * Génère des conseils pour améliorer l'annonce.
   */
  generateTips(data) {
    const tips = [];

    tips.push('📸 Prends 4-5 photos minimum : face, dos, étiquette, détails, portée');
    tips.push('💡 La première photo doit être la plus attrayante (c\'est la miniature)');
    tips.push('🕐 Publie entre 18h-21h en semaine ou le dimanche matin pour plus de visibilité');

    if (!data.brand) {
      tips.push('🏷️ Ajoute la marque dans le titre — les acheteurs filtrent souvent par marque');
    }
    if (!data.size) {
      tips.push('📏 Indique la taille dans le titre — c\'est le filtre le plus utilisé');
    }
    if (!data.color) {
      tips.push('🎨 Mentionne la couleur — beaucoup d\'acheteurs cherchent par couleur');
    }
    if (data.condition === 'neuf_etiquette') {
      tips.push('📷 Photographie l\'étiquette en gros plan — ça rassure les acheteurs');
    }

    tips.push('🔄 Si pas vendu en 7 jours, baisse le prix de 5-10% (boost algorithmique)');

    return tips;
  }
}
