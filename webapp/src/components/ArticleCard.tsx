import { ExternalLink, Plus } from 'lucide-react';
import type { Article } from '../hooks/useArticles.js';
import { formatPriceCompact, formatTimeAgo } from '../utils/formatters.js';
import { openLink, hapticFeedback } from '../utils/telegram.js';

interface Props {
  article: Article;
  onAddPurchase?: (article: Article) => void;
}

export default function ArticleCard({ article, onAddPurchase }: Props) {
  const handleOpen = () => {
    hapticFeedback('light');
    openLink(article.vinted_url);
  };

  return (
    <div
      className="rounded-xl overflow-hidden border"
      style={{
        backgroundColor: 'var(--section-bg-color)',
        borderColor: article.is_pepite ? 'rgba(255, 211, 42, 0.28)' : 'var(--card-border)',
        boxShadow: article.is_pepite ? '0 0 20px rgba(255, 211, 42, 0.1)' : 'none',
      }}
    >
      <div className="flex gap-3 p-3">

        {/* ── Image ─────────────────────────────────────────────── */}
        <div className="relative flex-shrink-0">
          {article.photo_url ? (
            <img
              src={article.photo_url}
              alt=""
              className="w-16 h-16 object-cover rounded-xl"
              loading="lazy"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center text-xs font-medium"
              style={{ backgroundColor: 'var(--secondary-bg-color)', color: 'var(--hint-color)' }}
            >
              ?
            </div>
          )}

          {/* Pepite badge on image */}
          {article.is_pepite && (
            <span
              className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold tracking-wide"
              style={{ backgroundColor: 'var(--pepite-color)', color: '#1a1200' }}
            >
              PEPITE
            </span>
          )}
        </div>

        {/* ── Content ───────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* Title */}
          <h3
            className="font-medium text-xs leading-tight line-clamp-2 mb-1.5"
            style={{ color: 'var(--text-color)' }}
          >
            {article.title ?? 'Sans titre'}
          </h3>

          {/* Price row */}
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="font-bold text-sm"
              style={{ color: article.is_pepite ? 'var(--success-color)' : 'var(--text-color)' }}
            >
              {formatPriceCompact(article.price)}
            </span>
            {article.is_pepite && article.estimated_market_price && (
              <span className="text-[10px] line-through" style={{ color: 'var(--hint-color)' }}>
                {formatPriceCompact(article.estimated_market_price)}
              </span>
            )}
            {article.is_pepite && article.price_difference_pct && (
              <span
                className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(0, 214, 143, 0.12)', color: 'var(--success-color)' }}
              >
                -{Math.abs(Number(article.price_difference_pct))}%
              </span>
            )}
          </div>

          {/* Chips + time */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {article.brand_name && (
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                style={{ backgroundColor: 'var(--secondary-bg-color)', color: 'var(--hint-color)' }}
              >
                {article.brand_name}
              </span>
            )}
            {article.size_name && (
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                style={{ backgroundColor: 'var(--secondary-bg-color)', color: 'var(--hint-color)' }}
              >
                {article.size_name}
              </span>
            )}
            <span className="text-[9px] ml-auto" style={{ color: 'var(--hint-color)' }}>
              {formatTimeAgo(article.detected_at)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Actions ───────────────────────────────────────────────── */}
      <div className="flex" style={{ borderTop: '1px solid var(--card-border)' }}>
        <button
          onClick={handleOpen}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-opacity active:opacity-60"
          style={{ color: 'var(--accent-text-color)' }}
        >
          <ExternalLink size={12} />
          Voir sur Vinted
        </button>
        {onAddPurchase && (
          <>
            <div className="w-px" style={{ backgroundColor: 'var(--card-border)' }} />
            <button
              onClick={() => { hapticFeedback('light'); onAddPurchase(article); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-opacity active:opacity-60"
              style={{ color: 'var(--hint-color)' }}
            >
              <Plus size={12} />
              Achat
            </button>
          </>
        )}
      </div>
    </div>
  );
}
