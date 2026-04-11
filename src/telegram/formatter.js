/**
 * Telegram Message Formatter v2 — Clean, fluid UX for Vinted Sniper.
 *
 * All messages use HTML parse_mode.
 * Design principles:
 *   - Compact single-message layouts (edit, never spam)
 *   - Toggle selection with checkmarks
 *   - Progress indicators for multi-step flows
 *   - French language throughout
 */

// ══════════════════════════════════════════
//  HTML Helpers
// ══════════════════════════════════════════

/**
 * Escapes HTML special characters for Telegram HTML parse_mode.
 * @param {string} str - Raw string
 * @returns {string} Escaped string safe for HTML
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Formats a price with bold and euro symbol.
 * @param {number|null} price
 * @param {string} currency
 * @returns {string}
 */
export function formatPrice(price, currency = '\u20ac') {
  if (price == null) return '?';
  return `<b>${Number(price).toFixed(2)}${currency}</b>`;
}

/** Separator line used across all menus. */
const SEP = '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501';

// ══════════════════════════════════════════
//  Deal helpers
// ══════════════════════════════════════════

/**
 * Returns a rich badge string for a deal label.
 */
export function dealBadge(dealLabel, dealScore) {
  if (!dealLabel) return '';
  const badges = {
    'PEPITE':       '\ud83d\udc8e P\u00c9PITE',
    'P\u00c9PITE':  '\ud83d\udc8e P\u00c9PITE',
    'Super deal':   '\ud83d\udd25 Super deal',
    'Bon prix':     '\u2705 Bon prix',
    'Prix correct': '\ud83d\udfe1 Prix correct',
    'Au-dessus':    '\ud83d\udfe0 Au-dessus',
    'Cher':         '\ud83d\udd34 Cher',
  };
  const badge = badges[dealLabel] || dealLabel;
  const scoreStr = dealScore != null ? ` (${Math.round(dealScore)}/100)` : '';
  return `${badge}${scoreStr}`;
}

/**
 * Human-readable condition string.
 */
export function formatCondition(condition) {
  const map = {
    'new_with_tags':    '\ud83c\udff7\ufe0f Neuf+tag',
    'new_without_tags': '\u2728 Neuf',
    'very_good':        '\ud83d\udc4d Tr\u00e8s bon',
    'good':             '\ud83d\udc4c Bon',
    'satisfactory':     '\ud83d\udd27 Satisf.',
  };
  return map[condition] || condition || '';
}

/**
 * Relative time string from an ISO date.
 */
export function timeAgo(isoDate) {
  if (!isoDate) return '';
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}j`;
}

/**
 * Formats an uptime in seconds to a human-readable string.
 */
export function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

/**
 * Builds a progress indicator (filled/empty dots).
 * @param {number} current - Current step (1-based)
 * @param {number} total - Total steps
 * @returns {string} e.g. "\u25cf\u25cf\u25cf\u25cb\u25cb\u25cb\u25cb"
 */
export function progressDots(current, total) {
  return '\u25cf'.repeat(current) + '\u25cb'.repeat(Math.max(0, total - current));
}

// ══════════════════════════════════════════
//  Inline Keyboard builders
// ══════════════════════════════════════════

/**
 * Creates an inline keyboard for a Vinted item notification.
 * Buttons: Buy | View on Vinted
 */
export function itemKeyboard(item) {
  const row1 = [];
  const row2 = [];

  if (item.url) {
    const buyUrl = item.url.includes('/items/') && !item.url.includes('/buy')
      ? item.url.replace(/\/?$/, '') + '/buy'
      : item.url;
    row1.push({ text: '\ud83d\uded2 Acheter', url: buyUrl });
    row1.push({ text: '\u2197\ufe0f Voir', url: item.url });
  }
  if (item.id) {
    // "J'ai acheté" button → triggers purchase tracking flow
    row2.push({ text: '\u2705 J\'ai achet\u00e9', callback_data: `bought:${item.id}` });
    row2.push({ text: '\u2764\ufe0f Favori', callback_data: `fav:${item.id}` });
  }
  const rows = [];
  if (row1.length) rows.push(row1);
  if (row2.length) rows.push(row2);
  if (rows.length === 0) return undefined;
  return { inline_keyboard: rows };
}

/**
 * Keyboard for an item in the Achats topic (post-purchase actions).
 */
export function achatKeyboard(item, purchaseId) {
  return {
    inline_keyboard: [
      [
        { text: '\ud83c\udff7\ufe0f Cr\u00e9er annonce', callback_data: `mkl:${purchaseId}` },
        { text: '\u2705 Vendu', callback_data: `sell:${purchaseId}` },
      ],
      item.url ? [{ text: '\u2197\ufe0f Voir sur Vinted', url: item.url }] : [],
    ].filter(r => r.length > 0),
  };
}

/**
 * Format a purchase confirmation message for the Achats topic.
 */
export function formatPurchaseCard(item, purchase) {
  const lines = [
    `\ud83d\uded2 <b>ACHAT ENREGISTR\u00c9</b>`,
    SEP,
    '',
    `\ud83c\udff7\ufe0f <b>${escapeHtml(item.title || 'Article')}</b>`,
    '',
  ];

  if (item.brand) lines.push(`\ud83c\udfe0 Marque : ${escapeHtml(item.brand)}`);
  if (item.size) lines.push(`\ud83d\udccf Taille : ${escapeHtml(item.size)}`);
  if (item.condition) lines.push(`\ud83d\udce6 \u00c9tat : ${escapeHtml(item.condition)}`);
  if (item.seller?.login) lines.push(`\ud83d\udc64 Vendeur : ${escapeHtml(item.seller.login)}`);

  lines.push('');
  lines.push(`\ud83d\udcb5 <b>Prix article : ${purchase.itemPrice}\u20ac</b>`);
  if (purchase.shippingCost) lines.push(`\ud83d\udce6 Livraison : ${purchase.shippingCost}\u20ac`);
  if (purchase.protectionFee) lines.push(`\ud83d\udee1\ufe0f Protection : ${purchase.protectionFee}\u20ac`);
  lines.push(`\ud83d\udcb0 <b>Co\u00fbt total : ${purchase.totalCost}\u20ac</b>`);

  lines.push('');
  lines.push(`\ud83d\udcc5 ${new Date(purchase.date).toLocaleDateString('fr-FR')}`);
  lines.push('');
  lines.push('\u2b07\ufe0f <i>Utilise les boutons ci-dessous quand tu voudras revendre ou marquer comme vendu.</i>');

  return {
    text: lines.join('\n'),
    reply_markup: achatKeyboard(item, purchase.id),
    photo: item.photo || null,
  };
}

// ══════════════════════════════════════════
//  MAIN MENU
// ══════════════════════════════════════════

/**
 * Formats the main menu message with status summary and action buttons.
 * Single message, always edited in-place.
 */
export function formatMainMenu(sniper, config) {
  const running = sniper?.running ?? false;
  const queries = sniper?.queries?.length ?? 0;
  const sessions = sniper?.sessionPool?.getStats() ?? {};
  const firstCountry = (config?.countries || ['fr'])[0];
  const aliveCount = sessions[firstCountry]?.alive ?? 0;
  const totalSessions = sessions[firstCountry]?.total ?? 0;
  const autobuyOn = config?.autobuy?.enabled ?? false;
  const dryRun = config?.autobuy?.dryRun ?? true;

  const turboActive = !!sniper?.turboPoller?.running;
  const statusIcon = running ? '\ud83d\udfe2' : '\ud83d\udd34';
  const statusText = running ? 'En cours' : 'Arr\u00eat\u00e9';
  const abText = autobuyOn ? (dryRun ? 'Dry Run' : 'LIVE') : 'OFF';
  const turboText = turboActive ? 'ON' : 'OFF';

  const text = [
    `\u26a1 <b>VINTED SNIPER</b>`,
    SEP,
    `${statusIcon} Bot ${statusText}  \u00b7  \ud83d\udd0d ${queries} filtre${queries !== 1 ? 's' : ''}  \u00b7  \ud83d\udce1 ${aliveCount}/${totalSessions} sessions`,
    `\ud83e\udd16 Autobuy: <b>${abText}</b>  \u00b7  \u26a1 Turbo: <b>${turboText}</b>`,
  ].join('\n');

  const turboBtn = turboActive
    ? { text: '\u26a1 Turbo ON', callback_data: 'act:turbo_off' }
    : { text: '\u26a1 Turbo OFF', callback_data: 'act:turbo_on' };

  const dashboardUrl = config?.dashboard?.publicUrl || null;

  const keyboard = {
    inline_keyboard: [
      [
        running
          ? { text: '\u23f9 Arr\u00eater', callback_data: 'act:stop' }
          : { text: '\u25b6\ufe0f Lancer', callback_data: 'act:start' },
        { text: `\u2699\ufe0f Filtres (${queries})`, callback_data: 'nav:filters' },
      ],
      [
        turboBtn,
        { text: '\u2699\ufe0f Config', callback_data: 'nav:config' },
      ],
      ...(dashboardUrl
        ? [[{ text: '\ud83d\udcf1 Mini App', web_app: { url: dashboardUrl } }]]
        : []),
    ],
  };

  return { text, reply_markup: keyboard };
}

// ══════════════════════════════════════════
//  STARTUP MESSAGE
// ══════════════════════════════════════════

/**
 * Short startup banner for the feed topic.
 */
export function formatStartupMessage() {
  const text = [
    `\u26a1 <b>Vinted Sniper connect\u00e9</b>`,
    '',
    `Tape /menu pour ouvrir le panneau de contr\u00f4le.`,
  ].join('\n');
  return { text };
}

// ══════════════════════════════════════════
//  FILTERS
// ══════════════════════════════════════════

/**
 * Formats the filter list with delete + add buttons.
 */
export function formatFilters(queries, { withBack = false } = {}) {
  if (!queries || queries.length === 0) {
    const kb = { inline_keyboard: [
      [{ text: '\u2795 Nouveau filtre', callback_data: 'filter:new' }],
    ]};
    if (withBack) kb.inline_keyboard.push([{ text: '\u21a9\ufe0f Retour', callback_data: 'nav:main' }]);
    return {
      text: `\ud83d\udd0d <b>FILTRES</b>\n${SEP}\n\nAucun filtre configur\u00e9.`,
      reply_markup: kb,
    };
  }

  const lines = [
    `\ud83d\udd0d <b>FILTRES (${queries.length})</b>`,
    SEP,
    '',
  ];

  const inlineRows = [];

  queries.forEach((q, i) => {
    const parts = [];
    if (q.text) parts.push(`"${escapeHtml(q.text)}"`);
    if (q._labels?.gender) parts.push(q._labels.gender);
    if (q._labels?.categories?.length) parts.push(q._labels.categories.join(', '));
    if (q._labels?.brands?.length) parts.push(q._labels.brands.join(', '));
    if (q._labels?.sizes?.length) parts.push(q._labels.sizes.join(', '));
    if (q._labels?.conditions?.length) parts.push(q._labels.conditions.join(', '));
    if (q.priceTo) parts.push(`max ${q.priceTo}\u20ac`);
    if (q.priceFrom) parts.push(`min ${q.priceFrom}\u20ac`);
    if (q.brandIds?.length && !q._labels?.brands?.length) parts.push(`${q.brandIds.length} marque(s)`);
    if (q.sizeIds?.length && !q._labels?.sizes?.length) parts.push(`${q.sizeIds.length} taille(s)`);
    if (q.catalogIds?.length && !q._labels?.categories?.length) parts.push(`cat: ${q.catalogIds.join(',')}`);

    lines.push(`<b>${i + 1}.</b> ${parts.join(' \u00b7 ') || 'filtre vide'}`);

    inlineRows.push([
      { text: `\u274c Supprimer #${i + 1}`, callback_data: `filter:del:${i}` },
    ]);
  });

  inlineRows.push([{ text: '\u2795 Nouveau filtre', callback_data: 'filter:new' }]);
  if (withBack) inlineRows.push([{ text: '\u21a9\ufe0f Retour', callback_data: 'nav:main' }]);

  return {
    text: lines.join('\n'),
    reply_markup: { inline_keyboard: inlineRows },
  };
}

// ══════════════════════════════════════════
//  FILTER CREATION WIZARD
// ══════════════════════════════════════════

/**
 * Formats the filter creation wizard at any step.
 * The same message is edited at each step to avoid spam.
 *
 * @param {object} data - Current filter data being built
 * @param {string} step - Current step name
 * @param {number} stepNum - Current step number (1-based)
 * @param {number} totalSteps - Total steps
 * @param {object} extra - { buttons, prompt }
 * @returns {{ text: string, reply_markup: object }}
 */
export function formatFilterWizard(data, step, stepNum, totalSteps, { buttons, prompt }) {
  const lines = [
    `\ud83d\udd0d <b>NOUVEAU FILTRE</b>  ${progressDots(stepNum, totalSteps)}`,
    SEP,
  ];

  // Show what has been selected so far
  const selected = buildFilterSummaryLines(data);
  if (selected.length > 0) {
    lines.push('');
    lines.push(...selected);
  }

  lines.push('');
  lines.push(prompt);

  // Build keyboard
  const kb = [...buttons];

  // Add back + skip row at the bottom
  const bottomRow = [];
  if (stepNum > 1) {
    bottomRow.push({ text: '\u2b05 Retour', callback_data: 'fw:back' });
  }
  bottomRow.push({ text: '\u274c Annuler', callback_data: 'fw:cancel' });

  kb.push(bottomRow);

  return {
    text: lines.join('\n'),
    reply_markup: { inline_keyboard: kb },
  };
}

/**
 * Builds the summary lines for current filter data.
 * Used both during wizard and in the final recap.
 */
function buildFilterSummaryLines(data) {
  const lines = [];
  if (data.genderLabel)          lines.push(`${data.genderIcon || '\ud83d\udc64'} ${escapeHtml(data.genderLabel)}`);
  if (data.categoryLabels?.length) lines.push(`\ud83d\udce6 ${data.categoryLabels.map(escapeHtml).join(', ')}`);
  if (data.brandLabels?.length)  lines.push(`\ud83c\udff7 ${data.brandLabels.map(escapeHtml).join(', ')}`);
  if (data.sizeLabels?.length)   lines.push(`\ud83d\udccf ${data.sizeLabels.map(escapeHtml).join(', ')}`);
  if (data.conditionLabels?.length) lines.push(`\u2728 ${data.conditionLabels.map(escapeHtml).join(', ')}`);
  if (data.priceTo || data.priceFrom) {
    let priceLine = '\ud83d\udcb0 ';
    if (data.priceFrom && data.priceTo) priceLine += `${data.priceFrom}\u20ac \u2013 ${data.priceTo}\u20ac`;
    else if (data.priceTo) priceLine += `Max ${data.priceTo}\u20ac`;
    else priceLine += `Min ${data.priceFrom}\u20ac`;
    lines.push(priceLine);
  }
  if (data.text)                 lines.push(`\ud83d\udd0d "${escapeHtml(data.text)}"`);
  return lines;
}

/**
 * Formats the final filter recap before saving.
 */
export function formatFilterRecap(data) {
  const lines = [
    `\ud83d\udccb <b>R\u00c9CAP DU FILTRE</b>`,
    SEP,
  ];

  const summary = buildFilterSummaryLines(data);
  if (summary.length > 0) {
    lines.push('');
    lines.push(...summary);
  } else {
    lines.push('');
    lines.push('<i>Aucun crit\u00e8re d\u00e9fini</i>');
  }

  const keyboard = {
    inline_keyboard: [
      [
        { text: '\u2705 Enregistrer', callback_data: 'fw:save' },
        { text: '\u274c Annuler', callback_data: 'fw:cancel' },
      ],
      [
        { text: '\u270f\ufe0f Modifier', callback_data: 'fw:edit' },
      ],
    ],
  };

  return { text: lines.join('\n'), reply_markup: keyboard };
}

// ══════════════════════════════════════════
//  AUTOBUY
// ══════════════════════════════════════════

/**
 * Formats the autobuy menu with status and action buttons.
 */
export function formatAutobuyMenu(cfg, { withBack = false } = {}) {
  const statusIcon = cfg.enabled ? '\ud83d\udfe2' : '\ud83d\udd34';
  const statusText = cfg.enabled ? 'ON' : 'OFF';
  const modeText = cfg.dryRun ? 'Dry Run' : (cfg.mode === 'offer' ? 'Offre' : 'Instant');
  const purchases = cfg.dailyPurchases || 0;
  const maxP = cfg.maxDailyPurchases || 0;
  const spent = cfg.dailySpend || 0;
  const maxS = cfg.maxDailySpend || 0;

  const text = [
    `\ud83e\udd16 <b>AUTOBUY</b>`,
    SEP,
    `\u00c9tat: ${statusIcon} <b>${statusText}</b>  \u00b7  Mode: <b>${modeText}</b>`,
    `\ud83d\uded2 Achats: <b>${purchases}/${maxP}</b>  \u00b7  \ud83d\udcb0 D\u00e9pens\u00e9: <b>${spent}\u20ac/${maxS}\u20ac</b>`,
  ].join('\n');

  const rows = [
    [
      { text: cfg.enabled ? '\ud83d\udd34 D\u00e9sactiver' : '\ud83d\udfe2 Activer', callback_data: `ab:toggle:${cfg.enabled ? 'off' : 'on'}` },
      { text: cfg.dryRun ? '\ud83d\udfe2 Mode Live' : '\ud83e\uddea Dry Run', callback_data: `ab:dryrun:${cfg.dryRun ? 'off' : 'on'}` },
    ],
    [
      { text: `\ud83d\udd00 Mode: ${cfg.mode === 'offer' ? 'Offre' : 'Instant'}`, callback_data: `ab:mode:${cfg.mode === 'offer' ? 'instant' : 'offer'}` },
    ],
    [
      { text: `\ud83d\uded2 Max achats: ${maxP}`, callback_data: 'ab:edit:maxpurchases' },
      { text: `\ud83d\udcb0 Max: ${maxS}\u20ac`, callback_data: 'ab:edit:maxspend' },
    ],
    [
      { text: `\ud83d\udccb R\u00e8gles (${(cfg.rules || []).length})`, callback_data: 'nav:rules' },
    ],
  ];

  if (withBack) rows.push([{ text: '\u21a9\ufe0f Retour', callback_data: 'nav:main' }]);

  return { text, reply_markup: { inline_keyboard: rows } };
}

/**
 * Formats the autobuy rules list.
 */
export function formatAutobuyRules(rules, { withBack = false } = {}) {
  if (!rules || rules.length === 0) {
    const kb = { inline_keyboard: [
      [{ text: '\u2795 Ajouter une r\u00e8gle', callback_data: 'rule:new' }],
    ]};
    if (withBack) kb.inline_keyboard.push([{ text: '\u21a9\ufe0f Retour', callback_data: 'nav:autobuy' }]);
    return {
      text: `\ud83d\udccb <b>R\u00c8GLES AUTOBUY</b>\n${SEP}\n\nAucune r\u00e8gle configur\u00e9e.`,
      reply_markup: kb,
    };
  }

  const lines = [
    `\ud83d\udccb <b>R\u00c8GLES AUTOBUY (${rules.length})</b>`,
    SEP,
    '',
  ];

  const inlineRows = [];

  rules.forEach((rule, i) => {
    const status = rule.enabled ? '\ud83d\udfe2' : '\ud83d\udd34';
    const details = [];
    if (rule.keywords?.length) details.push(rule.keywords.join(', '));
    if (rule.maxPrice) details.push(`max ${rule.maxPrice}\u20ac`);
    if (rule.brands?.length) details.push(rule.brands.join(', '));
    if (rule.sizes?.length) details.push(`T: ${rule.sizes.join(', ')}`);

    lines.push(`${status} <b>${i + 1}. ${escapeHtml(rule.name || 'Sans nom')}</b>`);
    if (details.length) lines.push(`    ${details.join(' \u00b7 ')}`);

    inlineRows.push([
      { text: `${rule.enabled ? '\ud83d\udd34 OFF' : '\ud83d\udfe2 ON'} #${i + 1}`, callback_data: `rule:toggle:${i}` },
      { text: `\u274c Suppr #${i + 1}`, callback_data: `rule:del:${i}` },
    ]);
  });

  inlineRows.push([{ text: '\u2795 Ajouter une r\u00e8gle', callback_data: 'rule:new' }]);
  if (withBack) inlineRows.push([{ text: '\u21a9\ufe0f Retour', callback_data: 'nav:autobuy' }]);

  return {
    text: lines.join('\n'),
    reply_markup: { inline_keyboard: inlineRows },
  };
}

/**
 * Formats a single rule summary (for rule creation recap).
 */
export function formatRuleSummary(data) {
  const lines = [
    `\ud83d\udccb <b>R\u00c9CAP DE LA R\u00c8GLE</b>`,
    SEP,
    '',
  ];
  if (data.name) lines.push(`\ud83c\udff7 Nom: <b>${escapeHtml(data.name)}</b>`);
  if (data.keywords?.length) lines.push(`\ud83d\udd0d Mots-cl\u00e9s: ${data.keywords.join(', ')}`);
  if (data.maxPrice) lines.push(`\ud83d\udcb0 Prix max: ${data.maxPrice}\u20ac`);
  if (data.minPrice) lines.push(`\ud83d\udcb0 Prix min: ${data.minPrice}\u20ac`);
  if (data.brands?.length) lines.push(`\ud83c\udff7 Marques: ${data.brands.join(', ')}`);
  if (data.sizes?.length) lines.push(`\ud83d\udccf Tailles: ${data.sizes.join(', ')}`);
  if (data.conditions?.length) lines.push(`\u2728 \u00c9tats: ${data.conditions.join(', ')}`);
  if (data.minSellerRating) lines.push(`\u2b50 Note min: ${data.minSellerRating}`);
  if (data.minSellerReviews) lines.push(`\ud83d\udcac Avis min: ${data.minSellerReviews}`);
  if (data.maxItemAge) lines.push(`\u23f0 Age max: ${data.maxItemAge}s`);
  return lines.join('\n');
}

// ══════════════════════════════════════════
//  STATS
// ══════════════════════════════════════════

/**
 * Formats the statistics message.
 */
export function formatStats(stats, { withBack = false } = {}) {
  const uptime = Math.round(process.uptime());
  const lines = [
    `\ud83d\udcca <b>STATISTIQUES</b>`,
    SEP,
    '',
    `\u23f1 Uptime: <b>${formatUptime(uptime)}</b>`,
  ];

  if (stats.scraper) {
    lines.push(`\ud83d\udce6 Articles: <b>${stats.scraper.totalNewItems ?? 0}</b>`);
    lines.push(`\ud83d\udd04 Cycles: <b>${stats.scraper.pollCycles ?? 0}</b>`);
    if (stats.scraper.seenItems != null) lines.push(`\ud83d\udc41 Vus: <b>${stats.scraper.seenItems}</b>`);
  }

  if (stats.sessions) {
    lines.push('');
    for (const [country, data] of Object.entries(stats.sessions)) {
      const flag = { fr: '\ud83c\uddeb\ud83c\uddf7', de: '\ud83c\udde9\ud83c\uddea', es: '\ud83c\uddea\ud83c\uddf8', it: '\ud83c\uddee\ud83c\uddf9', nl: '\ud83c\uddf3\ud83c\uddf1', be: '\ud83c\udde7\ud83c\uddea' }[country] || '\ud83c\udf10';
      const alive = data.alive || 0;
      const total = data.total || 0;
      const ok = alive === total ? '\u2705' : '\u26a0\ufe0f';
      lines.push(`${flag} ${country.toUpperCase()}: ${alive}/${total} ${ok}  \u00b7  ${data.totalRequests || 0} req`);
    }
  }

  if (stats.autobuy) {
    lines.push('');
    lines.push(`\ud83e\udd16 Autobuy: ${stats.autobuy.dryRun ? '\ud83e\uddea DRY' : '\ud83d\udfe2 LIVE'}  \u00b7  ${stats.autobuy.dailyPurchases || 0}/${stats.autobuy.maxDailyPurchases || 0} achats  \u00b7  ${stats.autobuy.dailySpend || 0}\u20ac`);
  }

  if (stats.deals) {
    lines.push(`\ud83d\udc8e Deals: <b>${stats.deals.dealsFound || 0}</b> trouv\u00e9s sur ${stats.deals.itemsScored || 0} scor\u00e9s`);
  }

  const mem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  lines.push('');
  lines.push(`\ud83d\udda5 RAM: ${mem}MB`);

  const kb = { inline_keyboard: [
    [{ text: '\ud83d\udd04 Rafra\u00eechir', callback_data: 'nav:stats' }],
  ]};
  if (withBack) kb.inline_keyboard.push([{ text: '\u21a9\ufe0f Retour', callback_data: 'nav:main' }]);

  return { text: lines.join('\n'), reply_markup: kb };
}

// ══════════════════════════════════════════
//  CONFIG SUB-MENU
// ══════════════════════════════════════════

/**
 * Config sub-menu with links to countries, sessions, watchlist, export, deals.
 */
export function formatConfigMenu(config, { withBack = false } = {}) {
  const text = [
    `\u2699\ufe0f <b>CONFIGURATION</b>`,
    SEP,
    '',
    `\ud83c\udf0d Pays: <b>${(config.countries || []).join(', ').toUpperCase() || 'aucun'}</b>`,
    `\ud83d\udc64 Vendeurs suivis: <b>${config.monitoring?.sellers?.length || 0}</b>`,
  ].join('\n');

  const rows = [
    [
      { text: '\ud83c\udf0d Pays', callback_data: 'nav:countries' },
      { text: '\ud83d\udce1 Sessions', callback_data: 'nav:sessions' },
    ],
    [
      { text: '\ud83d\udc41 Watchlist', callback_data: 'nav:watchlist' },
      { text: '\ud83d\udc8e Seuils deals', callback_data: 'nav:dealconfig' },
    ],
    [
      { text: '\ud83d\udce6 Export JSON', callback_data: 'act:export_json' },
      { text: '\ud83d\udce6 Export CSV', callback_data: 'act:export_csv' },
    ],
  ];
  if (withBack) rows.push([{ text: '\u21a9\ufe0f Retour', callback_data: 'nav:main' }]);

  return { text, reply_markup: { inline_keyboard: rows } };
}

// ══════════════════════════════════════════
//  COUNTRIES
// ══════════════════════════════════════════

const ALL_COUNTRIES = {
  fr: '\ud83c\uddeb\ud83c\uddf7 France',
  de: '\ud83c\udde9\ud83c\uddea Allemagne',
  es: '\ud83c\uddea\ud83c\uddf8 Espagne',
  it: '\ud83c\uddee\ud83c\uddf9 Italie',
  nl: '\ud83c\uddf3\ud83c\uddf1 Pays-Bas',
  be: '\ud83c\udde7\ud83c\uddea Belgique',
  pt: '\ud83c\uddf5\ud83c\uddf9 Portugal',
  pl: '\ud83c\uddf5\ud83c\uddf1 Pologne',
  lt: '\ud83c\uddf1\ud83c\uddf9 Lituanie',
  cz: '\ud83c\udde8\ud83c\uddff Tch\u00e9quie',
  at: '\ud83c\udde6\ud83c\uddf9 Autriche',
  uk: '\ud83c\uddec\ud83c\udde7 Royaume-Uni',
};

/**
 * Formats the country toggle list.
 */
export function formatCountries(activeCountries, { withBack = false } = {}) {
  const lines = [
    `\ud83c\udf0d <b>PAYS</b>`,
    SEP,
    '',
  ];

  const inlineRows = [];

  for (const [code, label] of Object.entries(ALL_COUNTRIES)) {
    const active = activeCountries.includes(code);
    lines.push(`${active ? '\u2705' : '\u274c'} ${label}`);
    inlineRows.push([
      { text: `${active ? '\u2705' : '\u2b1c'} ${label}`, callback_data: `country:${code}` },
    ]);
  }

  if (withBack) inlineRows.push([{ text: '\u21a9\ufe0f Retour', callback_data: 'nav:config' }]);

  return {
    text: lines.join('\n'),
    reply_markup: { inline_keyboard: inlineRows },
  };
}

// ══════════════════════════════════════════
//  SESSIONS
// ══════════════════════════════════════════

/**
 * Formats session health info.
 */
export function formatSessions(sessionStats, { withBack = false } = {}) {
  const lines = [
    `\ud83d\udce1 <b>SESSIONS</b>`,
    SEP,
    '',
  ];

  if (!sessionStats || Object.keys(sessionStats).length === 0) {
    lines.push('Aucune session active.');
  } else {
    for (const [country, data] of Object.entries(sessionStats)) {
      const flag = ALL_COUNTRIES[country]?.slice(0, 4) || '\ud83c\udf10';
      lines.push(`${flag} <b>${country.toUpperCase()}</b>  ${data.alive || 0}/${data.total || 0} actives`);
      lines.push(`    Req: ${data.totalRequests || 0}  \u00b7  Err: ${data.errors || 0}  \u00b7  Rot: ${data.rotations || 0}`);
    }
  }

  const kb = { inline_keyboard: [
    [{ text: '\ud83d\udd04 Rafra\u00eechir', callback_data: 'nav:sessions' }],
  ]};
  if (withBack) kb.inline_keyboard.push([{ text: '\u21a9\ufe0f Retour', callback_data: 'nav:config' }]);

  return { text: lines.join('\n'), reply_markup: kb };
}

// ══════════════════════════════════════════
//  WATCHLIST
// ══════════════════════════════════════════

/**
 * Formats the seller watchlist.
 */
export function formatWatchlist(sellers, { withBack = false } = {}) {
  if (!sellers || sellers.length === 0) {
    const kb = { inline_keyboard: [
      [{ text: '\u2795 Ajouter un vendeur', callback_data: 'watch:add' }],
    ]};
    if (withBack) kb.inline_keyboard.push([{ text: '\u21a9\ufe0f Retour', callback_data: 'nav:config' }]);
    return {
      text: `\ud83d\udc41 <b>WATCHLIST</b>\n${SEP}\n\nAucun vendeur suivi.\nUtilise /watch_seller [pseudo] pour en ajouter.`,
      reply_markup: kb,
    };
  }

  const lines = [
    `\ud83d\udc41 <b>WATCHLIST (${sellers.length})</b>`,
    SEP,
    '',
  ];

  const inlineRows = [];

  sellers.forEach((s, i) => {
    const name = typeof s === 'string' ? s : (s.username || s.id || `#${i + 1}`);
    lines.push(`${i + 1}. ${escapeHtml(name)}`);
    inlineRows.push([
      { text: `\u274c Retirer ${name}`, callback_data: `unwatch:${i}` },
    ]);
  });

  if (withBack) inlineRows.push([{ text: '\u21a9\ufe0f Retour', callback_data: 'nav:config' }]);

  return {
    text: lines.join('\n'),
    reply_markup: { inline_keyboard: inlineRows },
  };
}

// ══════════════════════════════════════════
//  DEAL CONFIG
// ══════════════════════════════════════════

/**
 * Formats the deal scoring threshold config.
 */
export function formatDealConfig(thresholds, { withBack = false } = {}) {
  const lines = [
    `\ud83d\udc8e <b>SEUILS DE DEALS</b>`,
    SEP,
    '',
  ];

  const labels = thresholds?.labels || [];
  const inlineRows = [];

  labels.forEach((entry, i) => {
    const [minScore, label] = entry;
    lines.push(`${dealBadge(label)} \u2014 score \u2265 <b>${minScore}</b>`);
    inlineRows.push([
      { text: `\u2b06\ufe0f +5`, callback_data: `deal:th:${i}:up` },
      { text: `${label}`, callback_data: `deal:noop` },
      { text: `\u2b07\ufe0f -5`, callback_data: `deal:th:${i}:down` },
    ]);
  });

  if (thresholds?.minSamplesForScore != null) {
    lines.push('');
    lines.push(`Min samples: <b>${thresholds.minSamplesForScore}</b>`);
  }

  inlineRows.push([{ text: '\ud83d\udd04 Reset d\u00e9fauts', callback_data: 'deal:reset' }]);
  if (withBack) inlineRows.push([{ text: '\u21a9\ufe0f Retour', callback_data: 'nav:config' }]);

  return {
    text: lines.join('\n'),
    reply_markup: { inline_keyboard: inlineRows },
  };
}

// ══════════════════════════════════════════
//  TOP DEALS
// ══════════════════════════════════════════

/**
 * Formats the top deals list.
 */
export function formatTopDeals(deals, { withBack = false } = {}) {
  if (!deals || deals.length === 0) {
    const kb = { inline_keyboard: [] };
    if (withBack) kb.inline_keyboard.push([{ text: '\u21a9\ufe0f Retour', callback_data: 'nav:main' }]);
    return { text: `\ud83d\udc8e Aucun deal d\u00e9tect\u00e9 pour le moment.`, reply_markup: kb };
  }

  const medals = ['\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49', '4\ufe0f\u20e3', '5\ufe0f\u20e3'];
  const lines = [
    `\ud83d\udc8e <b>TOP ${deals.length} DEALS</b>`,
    SEP,
    '',
  ];

  deals.forEach((item, i) => {
    const medal = medals[i] || `${i + 1}.`;
    const badge = item.dealLabel ? ` ${dealBadge(item.dealLabel, item.dealScore)}` : '';
    lines.push(`${medal} <b>${escapeHtml(item.title)}</b>`);
    lines.push(`    ${formatPrice(item.price)}${badge}`);
    if (item.url) lines.push(`    <a href="${item.url}">Voir</a>`);
    lines.push('');
  });

  const kb = { inline_keyboard: [] };
  if (withBack) kb.inline_keyboard.push([{ text: '\u21a9\ufe0f Retour', callback_data: 'nav:main' }]);

  return { text: lines.join('\n'), reply_markup: kb };
}

// ══════════════════════════════════════════
//  NOTIFICATIONS (Feed / Deals / Autobuy / Alerts)
// ══════════════════════════════════════════

/**
 * Formats a new item notification for the Feed topic.
 * Compact, information-dense, with inline action buttons.
 */
export function formatNewItem(item) {
  const lines = [];

  // Title
  const titleEmoji = item.brand?.toLowerCase()?.includes('nike') ? '\ud83d\udc5f'
    : item.brand?.toLowerCase()?.includes('adidas') ? '\ud83d\udc5f'
    : '\ud83c\udff7\ufe0f';
  lines.push(`${titleEmoji} <b>${escapeHtml(item.title)}</b>`);
  lines.push(SEP);

  // Price line
  let priceLine = `\ud83d\udcb0 ${formatPrice(item.price)}`;
  if (item.marketMedian) {
    priceLine += `  \u00b7  \ud83d\udcca M\u00e9d. ${formatPrice(item.marketMedian)}`;
  }
  if (item.previousPrice) {
    priceLine += `  <s>${Number(item.previousPrice).toFixed(2)}\u20ac</s>`;
  }
  lines.push(priceLine);

  // Details line
  const details = [];
  if (item.brand) details.push(`\ud83c\udff7 ${escapeHtml(item.brand)}`);
  if (item.size) details.push(`\ud83d\udccf ${escapeHtml(item.size)}`);
  if (item.condition) details.push(formatCondition(item.condition));
  if (details.length) lines.push(details.join('  \u00b7  '));

  // Seller line
  if (item.seller?.login) {
    let sellerLine = `\ud83d\udc64 ${escapeHtml(item.seller.login)}`;
    if (item.seller.rating) sellerLine += ` \u2b50 ${item.seller.rating}`;
    if (item.seller.reviewCount) sellerLine += ` (${item.seller.reviewCount} avis)`;
    lines.push(sellerLine);
  }

  // Deal badge
  if (item.dealLabel) {
    const pct = item.marketMedian ? Math.round((1 - item.price / item.marketMedian) * 100) : null;
    let badgeLine = `\ud83d\udd25 ${dealBadge(item.dealLabel, item.dealScore)}`;
    if (pct && pct > 0) badgeLine += ` <b>-${pct}%</b>`;
    lines.push(badgeLine);
  }

  return {
    text: lines.join('\n'),
    photo: item.photo || null,
    reply_markup: itemKeyboard(item),
  };
}

/**
 * Formats a deal notification for the Deals topic.
 * More emphasis on deal score, market comparison, and savings.
 */
export function formatDeal(item) {
  const lines = [];

  // Badge first for deals
  if (item.dealLabel) {
    lines.push(dealBadge(item.dealLabel, item.dealScore));
    lines.push('');
  }

  lines.push(`\ud83c\udff7\ufe0f <b>${escapeHtml(item.title)}</b>`);
  lines.push(SEP);

  // Price with market comparison
  lines.push(`\ud83d\udcb0 ${formatPrice(item.price)}`);
  if (item.marketMedian) {
    const saving = (item.marketMedian - item.price).toFixed(2);
    const pct = Math.round((1 - item.price / item.marketMedian) * 100);
    lines.push(`\ud83d\udcca March\u00e9: ~${formatPrice(item.marketMedian)} \u2014 <b>-${pct}%</b> (${saving}\u20ac d'\u00e9conomie)`);
  }

  // Details
  const details = [];
  if (item.brand) details.push(`\ud83c\udff7 ${escapeHtml(item.brand)}`);
  if (item.size) details.push(`\ud83d\udccf ${escapeHtml(item.size)}`);
  if (item.condition) details.push(formatCondition(item.condition));
  if (details.length) {
    lines.push('');
    lines.push(details.join('  \u00b7  '));
  }

  // Seller
  if (item.seller?.login) {
    let sellerLine = `\ud83d\udc64 ${escapeHtml(item.seller.login)}`;
    if (item.seller.rating) sellerLine += ` \u2b50 ${item.seller.rating}`;
    if (item.seller.reviewCount) sellerLine += ` (${item.seller.reviewCount} avis)`;
    lines.push(sellerLine);
  }

  return {
    text: lines.join('\n'),
    photo: item.photo || null,
    reply_markup: itemKeyboard(item),
  };
}

/**
 * Formats an autobuy action notification.
 */
export function formatAutobuyAction(item, record) {
  const lines = [];

  if (record?.dryRun) {
    lines.push('\ud83e\uddea <b>[DRY RUN] Achat simul\u00e9</b>');
  } else if (record?.awaitingConfirmation) {
    lines.push('\u23f3 <b>Confirmation requise</b>');
  } else {
    lines.push('\ud83d\udcb3 <b>Achat effectu\u00e9 !</b>');
  }

  lines.push(SEP);
  lines.push(`\ud83c\udff7\ufe0f ${escapeHtml(item.title)}`);
  lines.push(`\ud83d\udcb0 ${formatPrice(item.price)}`);

  if (record?.rule) lines.push(`\ud83d\udccb R\u00e8gle: <i>${escapeHtml(record.rule)}</i>`);
  if (record?.mode) lines.push(`\ud83d\udd27 Mode: ${record.mode === 'offer' ? 'Offre' : 'Achat direct'}`);
  if (record?.transactionId) lines.push(`\ud83c\udd94 TX: <code>${record.transactionId}</code>`);
  if (item.seller?.login) lines.push(`\ud83d\udc64 ${escapeHtml(item.seller.login)}`);

  return {
    text: lines.join('\n'),
    photo: item.photo || null,
    reply_markup: record?.dryRun ? itemKeyboard(item) : undefined,
  };
}

/**
 * Formats an alert message.
 */
export function formatAlert(title, details = {}) {
  const lines = [];
  lines.push(`\u26a0\ufe0f <b>${escapeHtml(title)}</b>`);
  lines.push(SEP);

  if (details.error) {
    const msg = typeof details.error === 'string'
      ? details.error
      : (details.error.message || JSON.stringify(details.error));
    lines.push(`<code>${escapeHtml(msg)}</code>`);
  }

  if (details.query) lines.push(`\ud83d\udd0d Requ\u00eate: ${escapeHtml(details.query)}`);
  if (details.country) lines.push(`\ud83c\udf0d Pays: ${details.country}`);
  lines.push(`\ud83d\udd52 ${new Date().toLocaleString('fr-FR')}`);

  return { text: lines.join('\n') };
}

/**
 * Formats the bot status for /status command.
 */
export function formatBotStatus(status) {
  const icon = status.running ? '\ud83d\udfe2' : '\ud83d\udd34';
  const text = [
    `${icon} <b>Vinted Sniper</b>`,
    SEP,
    `\u00c9tat: ${status.running ? 'En cours' : 'Arr\u00eat\u00e9'}`,
    `\ud83d\udd0d Filtres: ${status.queriesCount || 0}`,
    `\ud83d\udce1 Sessions: ${status.activeSessions || 0}`,
    `\ud83d\udce6 Articles: ${status.totalNewItems || 0}`,
    `\ud83d\udd04 Cycles: ${status.pollCycles || 0}`,
  ];

  if (status.autobuy) {
    text.push('');
    text.push(`\ud83e\udd16 Autobuy: ${status.autobuy.enabled ? '\ud83d\udfe2' : '\ud83d\udd34'}${status.autobuy.dryRun ? ' (dry run)' : ''}`);
    text.push(`\ud83d\uded2 Achats: ${status.autobuy.dailyPurchases || 0}/${status.autobuy.maxDailyPurchases || 0}`);
  }

  const uptime = Math.round(process.uptime());
  text.push('');
  text.push(`\u23f1 Uptime: ${formatUptime(uptime)}`);

  return { text: text.join('\n') };
}

// ══════════════════════════════════════════
//  LEGACY COMPAT (keep same export names)
// ══════════════════════════════════════════

// These are aliases to keep backward compatibility with any code
// that may import the old names.
export const formatAutobuyConfig = formatAutobuyMenu;
export const formatSettingsMenu = formatConfigMenu;
export const formatFilterSummary = formatFilterRecap;
