export const VINTED_COLORS = [
  { id: 1, name: 'Noir', hex: '#000000' },
  { id: 3, name: 'Gris', hex: '#808080' },
  { id: 12, name: 'Blanc', hex: '#FFFFFF' },
  { id: 20, name: 'Creme', hex: '#FFFDD0' },
  { id: 4, name: 'Beige', hex: '#F5F5DC' },
  { id: 7, name: 'Rouge', hex: '#FF0000' },
  { id: 21, name: 'Bordeaux', hex: '#800020' },
  { id: 23, name: 'Corail', hex: '#FF7F50' },
  { id: 10, name: 'Orange', hex: '#FFA500' },
  { id: 9, name: 'Jaune', hex: '#FFFF00' },
  { id: 22, name: 'Moutarde', hex: '#FFDB58' },
  { id: 16, name: 'Vert clair', hex: '#90EE90' },
  { id: 6, name: 'Vert', hex: '#008000' },
  { id: 17, name: 'Vert fonce', hex: '#006400' },
  { id: 24, name: 'Turquoise', hex: '#40E0D0' },
  { id: 14, name: 'Bleu clair', hex: '#ADD8E6' },
  { id: 5, name: 'Bleu', hex: '#0000FF' },
  { id: 15, name: 'Bleu fonce', hex: '#00008B' },
  { id: 11, name: 'Violet', hex: '#800080' },
  { id: 18, name: 'Lilas', hex: '#C8A2C8' },
  { id: 8, name: 'Rose', hex: '#FFC0CB' },
  { id: 19, name: 'Rose clair', hex: '#FFB6C1' },
  { id: 27, name: 'Abricot', hex: '#FBCEB1' },
  { id: 2, name: 'Marron', hex: '#8B4513' },
  { id: 25, name: 'Kaki', hex: '#BDB76B' },
  { id: 13, name: 'Dore', hex: '#FFD700' },
  { id: 26, name: 'Argente', hex: '#C0C0C0' },
  { id: 28, name: 'Multicolore', hex: '#FFFFFF' },
];

export const VINTED_CONDITIONS = [
  { id: 6, name: 'Neuf avec etiquette', description: 'Article neuf, jamais porte, avec etiquette' },
  { id: 1, name: 'Neuf sans etiquette', description: 'Article neuf, jamais porte' },
  { id: 2, name: 'Tres bon etat', description: 'Porte quelques fois, aucun defaut' },
  { id: 3, name: 'Bon etat', description: 'Porte, legers defauts possibles' },
  { id: 4, name: 'Satisfaisant', description: 'Defauts visibles mentionnes' },
];

export const DEFAULT_CATEGORIES = [
  {
    id: 5, name: 'Femmes', children: [
      { id: 1904, name: 'Vetements', children: [
        { id: 1206, name: 'Pulls & Sweats' },
        { id: 1209, name: 'Robes' },
        { id: 1210, name: 'Jupes' },
        { id: 4, name: 'Manteaux & Vestes' },
        { id: 1211, name: 'Pantalons' },
        { id: 1212, name: 'Jeans' },
        { id: 1213, name: 'T-shirts' },
        { id: 1214, name: 'Chemises & Blouses' },
      ]},
      { id: 16, name: 'Chaussures', children: [
        { id: 1242, name: 'Baskets' },
        { id: 1243, name: 'Bottes' },
        { id: 1244, name: 'Escarpins' },
        { id: 1245, name: 'Sandales' },
      ]},
      { id: 1187, name: 'Sacs' },
      { id: 1193, name: 'Accessoires' },
    ],
  },
  {
    id: 6, name: 'Hommes', children: [
      { id: 2050, name: 'Vetements', children: [
        { id: 1207, name: 'Pulls & Sweats' },
        { id: 3, name: 'Manteaux & Vestes' },
        { id: 1215, name: 'Pantalons' },
        { id: 1216, name: 'Jeans' },
        { id: 1217, name: 'T-shirts' },
        { id: 1218, name: 'Chemises' },
      ]},
      { id: 1231, name: 'Chaussures', children: [
        { id: 1246, name: 'Baskets' },
        { id: 1247, name: 'Bottes' },
        { id: 1248, name: 'Chaussures de ville' },
      ]},
    ],
  },
  { id: 29, name: 'Enfants' },
  { id: 1903, name: 'Bebes' },
  { id: 1905, name: 'Maison' },
  { id: 1906, name: 'Divertissement' },
  { id: 1907, name: 'Animaux de compagnie' },
];

export const POPULAR_BRANDS = [
  'Nike', 'Adidas', 'Zara', 'H&M', "Levi's", 'The North Face',
  'Carhartt', 'Ralph Lauren', 'Lacoste', 'New Balance',
  'Vans', 'Converse', 'Puma', 'Reebok', 'Gucci',
  'Louis Vuitton', 'Burberry', 'Tommy Hilfiger',
];
