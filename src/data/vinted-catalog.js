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
//  BRANDS (300+ popular on Vinted FR — used as fallback when API is unavailable)
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
  { id: 2290,  label: 'Ellesse' },
  { id: 11792, label: 'Hoka' },
  { id: 2336,  label: 'Mizuno' },
  { id: 365,   label: 'Kappa' },
  { id: 1862,  label: 'Le Coq Sportif' },
  { id: 2218,  label: 'Umbro' },
  { id: 2005,  label: 'Saucony' },
  { id: 4034,  label: 'On Running' },
  { id: 2585,  label: 'Diadora' },
  { id: 16654, label: 'Lululemon' },

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
  { id: 286,   label: 'Promod' },
  { id: 35,    label: 'Pimkie' },
  { id: 32,    label: 'Camaïeu' },
  { id: 46,    label: 'Cache Cache' },
  { id: 155,   label: 'Bonobo' },
  { id: 20,    label: 'Jennyfer' },
  { id: 24,    label: 'New Look' },
  { id: 21,    label: 'Etam' },
  { id: 1879,  label: 'Monki' },
  { id: 304,   label: 'Undiz' },
  { id: 556,   label: 'Okaïdi' },
  { id: 501,   label: 'C&A' },
  { id: 236,   label: 'Esprit' },
  { id: 542,   label: 'Naf Naf' },
  { id: 156,   label: 'Grain de Malice' },
  { id: 4651,  label: 'Tezenis' },
  { id: 2953,  label: 'Calzedonia' },
  { id: 2954,  label: 'Intimissimi' },
  { id: 2262,  label: 'Bizzbee' },
  { id: 250,   label: 'Springfield' },
  { id: 543,   label: 'Caroll' },
  { id: 205,   label: 'Celio' },
  { id: 282,   label: 'Jules' },
  { id: 1263,  label: 'Brice' },
  { id: 4376,  label: 'Gémo' },
  { id: 1880,  label: 'Weekday' },
  { id: 325,   label: 'Tally Weijl' },
  { id: 2276,  label: 'Reserved' },
  { id: 8498,  label: 'Subdued' },
  { id: 1704,  label: 'Brandy Melville' },
  { id: 1095,  label: 'American Vintage' },
  { id: 2041,  label: 'COS' },
  { id: 1878,  label: '& Other Stories' },
  { id: 1877,  label: 'Arket' },
  { id: 1093,  label: 'Massimo Dutti' },
  { id: 4043,  label: 'Weekday' },
  { id: 5409,  label: 'Bershka' },

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
  { id: 326,   label: 'Superdry' },
  { id: 23,    label: 'G-Star Raw' },
  { id: 2453,  label: 'Scotch & Soda' },
  { id: 1096,  label: 'Fred Perry' },
  { id: 2007,  label: 'Ben Sherman' },
  { id: 2180,  label: 'Wrangler' },
  { id: 2038,  label: 'Lee' },
  { id: 2037,  label: 'Pepe Jeans' },
  { id: 2133,  label: 'Replay' },
  { id: 2284,  label: 'Jack & Jones' },
  { id: 1697,  label: 'Selected Homme' },
  { id: 1730,  label: 'Only' },
  { id: 1731,  label: 'Vero Moda' },
  { id: 2285,  label: 'Vila' },
  { id: 2286,  label: 'Pieces' },
  { id: 545,   label: 'Comptoir des Cotonniers' },
  { id: 2044,  label: 'Gant' },
  { id: 2254,  label: 'Hackett' },
  { id: 2006,  label: 'Barbour' },
  { id: 1098,  label: 'Woolrich' },
  { id: 2171,  label: 'Abercrombie & Fitch' },
  { id: 2170,  label: 'Hollister' },
  { id: 14832, label: 'Corteiz' },
  { id: 21934, label: 'Palm Angels' },
  { id: 39008, label: 'Trapstar' },
  { id: 2792,  label: 'Supreme' },
  { id: 4041,  label: 'BAPE' },
  { id: 6146,  label: 'Kith' },
  { id: 8506,  label: 'Essentials' },
  { id: 43772, label: 'Fear of God' },
  { id: 36498, label: 'Represent' },
  { id: 9024,  label: 'Gallery Dept' },
  { id: 8104,  label: 'Ami Paris' },
  { id: 2270,  label: 'CP Company' },
  { id: 2127,  label: 'Maison Kitsuné' },
  { id: 4986,  label: 'New Era' },
  { id: 19988, label: 'Rhude' },

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
  { id: 127,   label: 'Bottega Veneta' },
  { id: 142,   label: 'Dolce & Gabbana' },
  { id: 121,   label: 'Loewe' },
  { id: 134,   label: 'Celine' },
  { id: 133,   label: 'Salvatore Ferragamo' },
  { id: 126,   label: 'Balmain' },
  { id: 136,   label: 'Kenzo' },
  { id: 138,   label: 'Marc Jacobs' },
  { id: 150,   label: 'Lanvin' },
  { id: 120,   label: 'Vivienne Westwood' },
  { id: 124,   label: 'Moschino' },
  { id: 139,   label: 'Tory Burch' },
  { id: 1099,  label: 'Isabel Marant' },
  { id: 137,   label: 'Furla' },
  { id: 2086,  label: 'Acne Studios' },
  { id: 2085,  label: 'Maison Margiela' },
  { id: 2269,  label: 'Rick Owens' },
  { id: 144,   label: 'Coach' },
  { id: 153,   label: 'Longchamp' },
  { id: 2126,  label: 'Jacquemus' },
  { id: 115,   label: 'Miu Miu' },
  { id: 151,   label: 'Zadig & Voltaire' },

  // ── Outdoor / Sport technique ──
  { id: 311,   label: 'Jack Wolfskin' },
  { id: 2164,  label: "Arc'teryx" },
  { id: 2165,  label: 'Mammut' },
  { id: 2166,  label: 'Millet' },
  { id: 306,   label: 'Salomon' },
  { id: 2167,  label: 'Merrell' },
  { id: 1173,  label: 'Birkenstock' },
  { id: 2168,  label: 'Keen' },
  { id: 1266,  label: 'Fjällräven' },
  { id: 4982,  label: 'Quechua' },
  { id: 4983,  label: 'Decathlon' },

  // ── Chaussures ──
  { id: 550,   label: 'Dr. Martens' },
  { id: 2034,  label: 'Clarks' },
  { id: 2233,  label: 'Geox' },
  { id: 1173,  label: 'Birkenstock' },
  { id: 4984,  label: 'Crocs' },
  { id: 1759,  label: 'UGG' },
  { id: 321,   label: 'Caterpillar' },
  { id: 2273,  label: 'Palladium' },
  { id: 284,   label: 'André' },
  { id: 283,   label: 'San Marina' },
  { id: 4031,  label: 'Paraboot' },
  { id: 1097,  label: 'Church' },
  { id: 2236,  label: 'Sebago' },
  { id: 2035,  label: 'Kickers' },
  { id: 2274,  label: 'Le Chameau' },
  { id: 2275,  label: 'Aigle' },
  { id: 1760,  label: 'Havaianas' },

  // ── Accessoires / Maroquinerie ──
  { id: 68,    label: 'Michael Kors' },
  { id: 75,    label: 'Guess' },
  { id: 549,   label: 'Fossil' },
  { id: 2293,  label: 'Daniel Wellington' },
  { id: 2294,  label: 'Casio' },
  { id: 547,   label: 'Swarovski' },
  { id: 548,   label: 'Pandora' },
  { id: 2295,  label: 'Cluse' },
  { id: 2296,  label: 'Kapten & Son' },
  { id: 2297,  label: 'Lancaster' },
  { id: 544,   label: 'Lancel' },
  { id: 2298,  label: 'Le Tanneur' },
  { id: 2299,  label: 'Eastpak' },
  { id: 2300,  label: 'Herschel' },
  { id: 2301,  label: 'Fjällräven' },
  { id: 2302,  label: 'Samsonite' },
  { id: 4033,  label: 'Goyard' },
  { id: 546,   label: 'Ray-Ban' },
  { id: 2303,  label: 'Oakley' },
  { id: 2304,  label: 'Carrera' },

  // ── Française / Créateurs ──
  { id: 1780,  label: 'Sandro' },
  { id: 1781,  label: 'Maje' },
  { id: 1782,  label: 'Claudie Pierlot' },
  { id: 1094,  label: 'Ba&sh' },
  { id: 1095,  label: 'American Vintage' },
  { id: 1783,  label: 'The Kooples' },
  { id: 1784,  label: 'Iro' },
  { id: 151,   label: 'Zadig & Voltaire' },
  { id: 539,   label: 'Gérard Darel' },
  { id: 540,   label: 'Vanessa Bruno' },
  { id: 541,   label: 'Sézane' },
  { id: 2277,  label: 'Balzac Paris' },
  { id: 2278,  label: 'Rouje' },
  { id: 2279,  label: 'Musier' },
  { id: 2280,  label: 'Réalisation Par' },
  { id: 543,   label: 'Caroll' },
  { id: 545,   label: 'Comptoir des Cotonniers' },

  // ── Enfants ──
  { id: 2308,  label: 'Petit Bateau' },
  { id: 2309,  label: 'Catimini' },
  { id: 2310,  label: 'Tartine et Chocolat' },
  { id: 2311,  label: 'Bonpoint' },
  { id: 556,   label: 'Okaïdi' },
  { id: 2312,  label: 'DPAM' },
  { id: 2313,  label: 'Sergent Major' },
  { id: 2314,  label: 'Jacadi' },
  { id: 2315,  label: 'Vertbaudet' },
  { id: 2316,  label: 'Absorba' },
  { id: 2317,  label: 'Cyrillus' },
  { id: 2318,  label: 'Orchestra' },

  // ── Divers populaires ──
  { id: 559,   label: 'Desigual' },
  { id: 2281,  label: 'Diesel' },
  { id: 146,   label: 'Armani' },
  { id: 2282,  label: 'Emporio Armani' },
  { id: 2283,  label: 'EA7' },
  { id: 8,     label: 'Nike ACG' },
  { id: 180,   label: 'Gap' },
  { id: 1733,  label: 'Abercrombie & Fitch' },
  { id: 1734,  label: 'American Eagle' },
  { id: 1735,  label: 'Banana Republic' },
  { id: 1736,  label: 'J.Crew' },
  { id: 287,   label: 'Oxbow' },
  { id: 288,   label: 'Rip Curl' },
  { id: 289,   label: 'Quicksilver' },
  { id: 290,   label: 'Billabong' },
  { id: 291,   label: 'DC Shoes' },
  { id: 292,   label: 'Element' },
  { id: 2287,  label: 'Volcom' },
  { id: 2288,  label: 'Obey' },
  { id: 2289,  label: 'Carhartt WIP' },
  { id: 2291,  label: 'Sergio Tacchini' },
  { id: 1100,  label: 'Cos' },
  { id: 277,   label: 'Morgan' },
  { id: 278,   label: 'Kookaï' },
  { id: 279,   label: 'Mim' },
  { id: 280,   label: 'La Redoute' },
  { id: 281,   label: 'Somewhere' },
  { id: 557,   label: 'Du Pareil au Même' },
  { id: 558,   label: 'Tape à l\'Oeil' },
  { id: 1738,  label: 'Ted Baker' },
  { id: 1739,  label: 'Reiss' },
  { id: 1740,  label: 'AllSaints' },
  { id: 1741,  label: 'Whistles' },
  { id: 1742,  label: 'Karen Millen' },
  { id: 1743,  label: 'Hobbs' },
  { id: 2292,  label: 'Lyle & Scott' },
  { id: 2305,  label: 'Armor Lux' },
  { id: 2306,  label: 'Saint James' },
  { id: 2307,  label: 'Petit Bateau' },
  { id: 561,   label: "Levi's Vintage" },
  { id: 563,   label: 'Wrangler' },
  { id: 564,   label: 'Lee Cooper' },
  { id: 2320,  label: 'K-Way' },
  { id: 2321,  label: 'Schott' },
  { id: 2322,  label: 'Chevignon' },
  { id: 2323,  label: 'Teddy Smith' },
  { id: 2324,  label: 'Kaporal' },
  { id: 2325,  label: 'Deeluxe' },
  { id: 2326,  label: 'Redskins' },
  { id: 2327,  label: 'Le Temps des Cerises' },
  { id: 2328,  label: 'Ikks' },
  { id: 2329,  label: 'Eleven Paris' },
  { id: 570,   label: 'Petit Bateau' },
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

/** Normalize a string for fuzzy brand matching (strip &, -, spaces, accents). */
function normalizeBrand(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[&\-_.']/g, '')                          // strip special chars
    .replace(/\s+/g, '');                               // strip spaces
}

/** Find brand by name (case-insensitive partial match with fuzzy normalization).
 *  Matches both raw text and normalized text so "pull&bear", "pullbear",
 *  "pull bear", "Pull & Bear" all find the same entry. */
export function searchBrands(query) {
  const q = query.toLowerCase();
  const qNorm = normalizeBrand(query);

  return BRANDS.filter(b => {
    const label = b.label.toLowerCase();
    const labelNorm = normalizeBrand(b.label);
    // Match on raw text OR normalized text
    return label.includes(q) || labelNorm.includes(qNorm) || qNorm.includes(labelNorm);
  });
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
