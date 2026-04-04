import type { NotificationPayload } from '../../types/bot.js';

export function formatArticleNotification(payload: NotificationPayload): string {
  const lines: string[] = [];

  const brand = payload.brandName ? ` — ${escapeHtml(payload.brandName)}` : '';
  const size = payload.sizeName ? ` — Taille ${escapeHtml(payload.sizeName)}` : '';

  lines.push(`👕 <b>${escapeHtml(payload.title)}${brand}${size}</b>`);
  lines.push(`💰 <b>${payload.price} ${payload.currency}</b>${payload.conditionName ? ` — ${escapeHtml(payload.conditionName)}` : ''}`);

  if (payload.sellerUsername) {
    const rating = payload.sellerRating ? ` ⭐ ${payload.sellerRating}` : '';
    lines.push(`👤 @${escapeHtml(payload.sellerUsername)}${rating}`);
  }

  lines.push('');
  lines.push(`🔗 <a href="${payload.vintedUrl}">Voir sur Vinted</a>`);

  return lines.join('\n');
}

export function formatPepiteNotification(payload: NotificationPayload): string {
  const lines: string[] = [];

  lines.push('💎 <b>PEPITE DETECTEE !</b>');
  lines.push('');

  const brand = payload.brandName ? ` — ${escapeHtml(payload.brandName)}` : '';
  const size = payload.sizeName ? ` — Taille ${escapeHtml(payload.sizeName)}` : '';

  lines.push(`👕 <b>${escapeHtml(payload.title)}${brand}${size}</b>`);

  let priceText = `💰 <b>${payload.price} ${payload.currency}</b>`;
  if (payload.estimatedMarketPrice) {
    priceText += ` (Prix moyen : ${payload.estimatedMarketPrice} ${payload.currency})`;
  }
  lines.push(priceText);

  if (payload.priceDifferencePct) {
    lines.push(`📉 <b>${payload.priceDifferencePct}%</b> sous le marche !`);
  }

  if (payload.conditionName) {
    lines.push(`📦 ${escapeHtml(payload.conditionName)}`);
  }

  if (payload.sellerUsername) {
    const rating = payload.sellerRating ? ` ⭐ ${payload.sellerRating}` : '';
    lines.push(`👤 @${escapeHtml(payload.sellerUsername)}${rating}`);
  }

  lines.push('');
  lines.push(`🔗 <a href="${payload.vintedUrl}">Voir sur Vinted</a>`);

  return lines.join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
