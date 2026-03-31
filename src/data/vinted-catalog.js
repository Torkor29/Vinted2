/**
 * Vinted Catalog Reference Data
 *
 * IDs extracted from Vinted's public catalog URLs and API.
 * Format: vinted.com/catalog/{id}-{slug}
 *
 * These IDs are stable across all Vinted country domains.
 */

// ══════════════════════════════════════════
//  GENDERS (root catalog nodes)
// ══════════════════════════════════════════
export const GENDERS = [
  { id: 1904, label: 'Femmes', icon: '👩', slug: 'women' },
  { id: 5,    label: 'Hommes', icon: '👨', slug: 'men' },
  { id: 1193, label: 'Enfants', icon: '👶', slug: 'kids' },
];

// ══════════════════════════════════════════
//  CATEGORIES (per gender)
// ══════════════════════════════════════════
export const CATEGORIES = {
  // ── FEMMES ──
  1904: [
    { id: 1904, label: 'Tout Femmes', icon: '👗' },
    { id: 4,    label: 'Vêtements', icon: '👚', children: [
      { id: 1206, label: 'Manteaux & Vestes' },
      { id: 7,    label: 'Pulls & Sweats' },
      { id: 11,   label: 'Tops & T-shirts' },
      { id: 15,   label: 'Chemises & Blouses' },
      { id: 12,   label: 'Robes' },
      { id: 13,   label: 'Jupes' },
      { id: 9,    label: 'Jeans' },
      { id: 8,    label: 'Pantalons' },
      { id: 10,   label: 'Shorts' },
      { id: 14,   label: 'Combinaisons' },
      { id: 1207, label: 'Maillots de bain' },
      { id: 19,   label: 'Lingerie & Pyjamas' },
      { id: 21,   label: 'Sport' },
      { id: 1208, label: 'Costumes & Ensembles' },
      { id: 1226, label: 'Maternité' },
    ]},
    { id: 16,   label: 'Chaussures', icon: '👠', children: [
      { id: 1864, label: 'Baskets' },
      { id: 17,   label: 'Bottes' },
      { id: 1042, label: 'Talons' },
      { id: 1043, label: 'Sandales' },
      { id: 1044, label: 'Ballerines' },
      { id: 1045, label: 'Mocassins' },
      { id: 1865, label: 'Sport' },
    ]},
    { id: 26,   label: 'Sacs', icon: '👜', children: [
      { id: 1927, label: 'Sacs à main' },
      { id: 1928, label: 'Sacs à dos' },
      { id: 1929, label: 'Pochettes' },
      { id: 1930, label: 'Cabas' },
      { id: 1932, label: 'Portefeuilles' },
    ]},
    { id: 3,    label: 'Accessoires', icon: '💍', children: [
      { id: 37,   label: 'Bijoux' },
      { id: 38,   label: 'Montres' },
      { id: 39,   label: 'Lunettes' },
      { id: 40,   label: 'Écharpes & Foulards' },
      { id: 41,   label: 'Chapeaux' },
      { id: 42,   label: 'Ceintures' },
    ]},
    { id: 1912, label: 'Beauté', icon: '💄' },
  ],

  // ── HOMMES ──
  5: [
    { id: 5,    label: 'Tout Hommes', icon: '👔' },
    { id: 2050, label: 'Vêtements', icon: '👕', children: [
      { id: 2056, label: 'Manteaux & Vestes' },
      { id: 2054, label: 'Pulls & Sweats' },
      { id: 2051, label: 'T-shirts' },
      { id: 2052, label: 'Chemises' },
      { id: 2055, label: 'Jeans' },
      { id: 2053, label: 'Pantalons' },
      { id: 2057, label: 'Shorts' },
      { id: 2058, label: 'Costumes' },
      { id: 2059, label: 'Sport' },
      { id: 2060, label: 'Maillots de bain' },
      { id: 2061, label: 'Sous-vêtements' },
    ]},
    { id: 2063, label: 'Chaussures', icon: '👟', children: [
      { id: 2064, label: 'Baskets' },
      { id: 2065, label: 'Boots' },
      { id: 2066, label: 'Chaussures de ville' },
      { id: 2067, label: 'Sandales' },
      { id: 2068, label: 'Sport' },
    ]},
    { id: 2071, label: 'Sacs', icon: '🎒', children: [
      { id: 2072, label: 'Sacs à dos' },
      { id: 2073, label: 'Sacoches' },
      { id: 2074, label: 'Sacs de voyage' },
      { id: 2075, label: 'Portefeuilles' },
    ]},
    { id: 2077, label: 'Accessoires', icon: '⌚', children: [
      { id: 2078, label: 'Montres' },
      { id: 2079, label: 'Bijoux' },
      { id: 2080, label: 'Lunettes' },
      { id: 2081, label: 'Écharpes' },
      { id: 2082, label: 'Chapeaux & Casquettes' },
      { id: 2083, label: 'Ceintures' },
      { id: 2084, label: 'Cravates' },
    ]},
  ],

  // ── ENFANTS ──
  1193: [
    { id: 1193, label: 'Tout Enfants', icon: '🧸' },
    { id: 1194, label: 'Vêtements filles', icon: '👧' },
    { id: 1196, label: 'Vêtements garçons', icon: '👦' },
    { id: 1198, label: 'Bébé fille', icon: '🎀' },
    { id: 1200, label: 'Bébé garçon', icon: '👶' },
    { id: 1202, label: 'Chaussures enfants', icon: '👟' },
    { id: 1204, label: 'Jouets', icon: '🧩' },
    { id: 1340, label: 'Puériculture', icon: '🍼' },
  ],
};

// ══════════════════════════════════════════
//  BRANDS (top ~100 popular on Vinted FR)
// ══════════════════════════════════════════
export const BRANDS = [
  // ── Sportswear ──
  { id: 53,    label: 'Nike' },
  { id: 14,    label: 'Adidas' },
  { id: 255,   label: 'Jordan' },
  { id: 2319,  label: 'New Balance' },
  { id: 88,    label: 'Puma' },
  { id: 89,    label: 'Reebok' },
  { id: 304,   label: 'Asics' },
  { id: 578,   label: 'Converse' },
  { id: 4985,  label: 'Vans' },
  { id: 94,    label: 'Under Armour' },
  { id: 2064,  label: 'Fila' },

  // ── Fast Fashion ──
  { id: 12,    label: 'Zara' },
  { id: 7,     label: 'H&M' },
  { id: 169,   label: 'Mango' },
  { id: 18,    label: 'Bershka' },
  { id: 30,    label: 'Stradivarius' },
  { id: 16,    label: 'Pull & Bear' },
  { id: 6,     label: 'ASOS' },
  { id: 48,    label: 'Primark' },
  { id: 25,    label: 'Shein' },
  { id: 215,   label: 'Uniqlo' },
  { id: 480,   label: 'Kiabi' },

  // ── Premium / Streetwear ──
  { id: 362,   label: 'The North Face' },
  { id: 10,    label: 'Ralph Lauren' },
  { id: 234,   label: 'Tommy Hilfiger' },
  { id: 73,    label: 'Lacoste' },
  { id: 57,    label: "Levi's" },
  { id: 2036,  label: 'Carhartt' },
  { id: 2681,  label: 'Stüssy' },
  { id: 340,   label: 'Champion' },
  { id: 22,    label: 'Calvin Klein' },
  { id: 31,    label: 'Hugo Boss' },
  { id: 2106,  label: 'Dickies' },
  { id: 135,   label: 'Timberland' },
  { id: 8655,  label: 'Napapijri' },
  { id: 2163,  label: 'Columbia' },
  { id: 1265,  label: 'Patagonia' },

  // ── Luxe ──
  { id: 105,   label: 'Gucci' },
  { id: 52,    label: 'Louis Vuitton' },
  { id: 123,   label: 'Chanel' },
  { id: 65,    label: 'Hermès' },
  { id: 54,    label: 'Dior' },
  { id: 113,   label: 'Prada' },
  { id: 128,   label: 'Balenciaga' },
  { id: 118,   label: 'Burberry' },
  { id: 320,   label: 'Versace' },
  { id: 119,   label: 'Yves Saint Laurent' },
  { id: 129,   label: 'Givenchy' },
  { id: 132,   label: 'Valentino' },
  { id: 140,   label: 'Fendi' },
  { id: 131,   label: 'Moncler' },
  { id: 116,   label: 'Alexander McQueen' },
  { id: 260,   label: 'Off-White' },
  { id: 5765,  label: 'Stone Island' },
  { id: 21934, label: 'Palm Angels' },

  // ── Outdoor ──
  { id: 311,   label: 'Jack Wolfskin' },

  // ── Divers populaires ──
  { id: 68,    label: 'Michael Kors' },
  { id: 75,    label: 'Guess' },
  { id: 1780,  label: 'Sandro' },
  { id: 1781,  label: 'Maje' },
  { id: 1782,  label: 'Claudie Pierlot' },
  { id: 559,   label: 'Desigual' },
  { id: 2281,  label: 'Diesel' },
  { id: 146,   label: 'Armani' },
  { id: 550,   label: 'Dr. Martens' },
  { id: 1173,  label: 'Birkenstock' },
  { id: 306,   label: 'Salomon' },
];

// ══════════════════════════════════════════
//  SIZES
// ══════════════════════════════════════════
export const SIZES = {
  clothing: [
    { id: 206, label: 'XXS' },
    { id: 207, label: 'XS' },
    { id: 208, label: 'S' },
    { id: 209, label: 'M' },
    { id: 210, label: 'L' },
    { id: 211, label: 'XL' },
    { id: 212, label: 'XXL' },
    { id: 213, label: '3XL' },
    { id: 214, label: '4XL' },
  ],
  shoes_women: [
    { id: 55, label: '35' }, { id: 56, label: '36' }, { id: 57, label: '37' },
    { id: 58, label: '38' }, { id: 59, label: '39' }, { id: 60, label: '40' },
    { id: 61, label: '41' }, { id: 62, label: '42' },
  ],
  shoes_men: [
    { id: 60, label: '40' }, { id: 61, label: '41' }, { id: 62, label: '42' },
    { id: 63, label: '43' }, { id: 64, label: '44' }, { id: 65, label: '45' },
    { id: 66, label: '46' }, { id: 67, label: '47' }, { id: 68, label: '48' },
  ],
  jeans: [
    { id: 101, label: 'W26' }, { id: 102, label: 'W27' }, { id: 103, label: 'W28' },
    { id: 104, label: 'W29' }, { id: 105, label: 'W30' }, { id: 106, label: 'W31' },
    { id: 107, label: 'W32' }, { id: 108, label: 'W33' }, { id: 109, label: 'W34' },
    { id: 110, label: 'W36' }, { id: 111, label: 'W38' },
  ],
};

// ══════════════════════════════════════════
//  COLORS
// ══════════════════════════════════════════
export const COLORS = [
  { id: 1,  label: 'Noir',      hex: '#000000' },
  { id: 3,  label: 'Gris',      hex: '#8B8B8B' },
  { id: 12, label: 'Blanc',     hex: '#FFFFFF' },
  { id: 20, label: 'Crème',     hex: '#FFF5E1' },
  { id: 4,  label: 'Beige',     hex: '#D4B896' },
  { id: 11, label: 'Marron',    hex: '#8B4513' },
  { id: 23, label: 'Kaki',      hex: '#6B7B3E' },
  { id: 17, label: 'Vert',      hex: '#228B22' },
  { id: 9,  label: 'Bleu',      hex: '#2563EB' },
  { id: 14, label: 'Bleu marine', hex: '#1B2A4A' },
  { id: 22, label: 'Bleu clair', hex: '#87CEEB' },
  { id: 7,  label: 'Rouge',     hex: '#DC2626' },
  { id: 21, label: 'Bordeaux',  hex: '#6B1C23' },
  { id: 5,  label: 'Rose',      hex: '#EC4899' },
  { id: 18, label: 'Corail',    hex: '#FF6B6B' },
  { id: 8,  label: 'Orange',    hex: '#F59E0B' },
  { id: 10, label: 'Jaune',     hex: '#FACC15' },
  { id: 6,  label: 'Violet',    hex: '#7C3AED' },
  { id: 19, label: 'Lilas',     hex: '#C8A2C8' },
  { id: 16, label: 'Turquoise', hex: '#06B6D4' },
  { id: 15, label: 'Or',        hex: '#DAA520' },
  { id: 13, label: 'Argent',    hex: '#C0C0C0' },
  { id: 2,  label: 'Multicolore', hex: 'linear-gradient(135deg,#f00,#0f0,#00f)' },
];

// ══════════════════════════════════════════
//  CONDITIONS (status_ids)
// ══════════════════════════════════════════
export const CONDITIONS = [
  { id: 6, label: 'Neuf avec étiquette', short: 'Neuf+tag', icon: '🏷️', value: 'neuf_avec_etiquette' },
  { id: 1, label: 'Neuf sans étiquette', short: 'Neuf', icon: '✨', value: 'neuf_sans_etiquette' },
  { id: 2, label: 'Très bon état',       short: 'Très bon', icon: '👍', value: 'tres_bon_etat' },
  { id: 3, label: 'Bon état',            short: 'Bon', icon: '👌', value: 'bon_etat' },
  { id: 4, label: 'Satisfaisant',        short: 'Satisf.', icon: '🔧', value: 'satisfaisant' },
];

// ══════════════════════════════════════════
//  SORT OPTIONS
// ══════════════════════════════════════════
export const SORT_OPTIONS = [
  { id: 'newest_first',        label: 'Plus récent' },
  { id: 'price_low_to_high',   label: 'Prix croissant' },
  { id: 'price_high_to_low',   label: 'Prix décroissant' },
  { id: 'relevance',           label: 'Pertinence' },
];

// ══════════════════════════════════════════
//  Helpers
// ══════════════════════════════════════════

/** Get all categories for a gender (flat list with parents) */
export function getCategoriesForGender(genderId) {
  return CATEGORIES[genderId] || [];
}

/** Find brand by name (case-insensitive partial match) */
export function searchBrands(query) {
  const q = query.toLowerCase();
  return BRANDS.filter(b => b.label.toLowerCase().includes(q));
}

/** Get size group based on category */
export function getSizeGroup(categoryId) {
  // Shoes categories
  const shoesCatIds = [16, 1864, 17, 1042, 1043, 1044, 1045, 1865, 2063, 2064, 2065, 2066, 2067, 2068, 1202];
  const jeansIds = [9, 2055];

  if (shoesCatIds.includes(categoryId)) return 'shoes';
  if (jeansIds.includes(categoryId)) return 'jeans';
  return 'clothing';
}

/** Export all data as a single object (for API route) */
export function getAllCatalogData() {
  return {
    genders: GENDERS,
    categories: CATEGORIES,
    brands: BRANDS,
    sizes: SIZES,
    colors: COLORS,
    conditions: CONDITIONS,
    sortOptions: SORT_OPTIONS,
  };
}
