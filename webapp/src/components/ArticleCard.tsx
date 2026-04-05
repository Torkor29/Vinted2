import type { Article } from '../hooks/useArticles.js';
import { formatPriceCompact, formatTimeAgo, formatPercent } from '../utils/formatters.js';
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
    <div className={`bg-tg-section rounded-xl overflow-hidden border ${article.is_pepite ? 'border-[var(--pepite-color)]/30 glow-pepite' : 'border-[var(--card-border)]'}`}>
      {/* Pepite banner */}
      {article.is_pepite && (
        <div className="px-3 py-1 text-[10px] font-bold text-center" style={{ background: 'var(--pepite-bg)', color: 'var(--pepite-color)' }}>
          💎 PEPITE — {article.price_difference_pct ? `${article.price_difference_pct}% sous le marche` : 'Bonne affaire'}
        </div>
      )}

      <div className="flex gap-2.5 p-2.5">
        {/* Photo */}
        {article.photo_url ? (
          <img
            src={article.photo_url}
            alt=""
            className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
            loading="lazy"
          />
        ) : (
          <div className="w-16 h-16 bg-tg-secondary rounded-lg flex-shrink-0 flex items-center justify-center text-tg-hint text-lg">?</div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-xs text-tg leading-tight line-clamp-2">
            {article.title ?? 'Sans titre'}
          </h3>

          <div className="flex items-center gap-1.5 mt-1">
            <span className="font-bold text-sm" style={{ color: article.is_pepite ? 'var(--success-color)' : 'var(--text-color)' }}>
              {formatPriceCompact(article.price)}
            </span>
            {article.is_pepite && article.estimated_market_price && (
              <span className="text-[10px] text-tg-hint line-through">
                {formatPriceCompact(article.estimated_market_price)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-tg-hint overflow-hidden">
            {article.brand_name && <span className="truncate">{article.brand_name}</span>}
            {article.brand_name && article.size_name && <span>·</span>}
            {article.size_name && <span className="flex-shrink-0">{article.size_name}</span>}
            <span className="ml-auto flex-shrink-0">{formatTimeAgo(article.detected_at)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex border-t border-[var(--card-border)]">
        <button
          onClick={handleOpen}
          className="flex-1 py-2 text-[11px] font-medium text-tg-link active:bg-tg-secondary transition-colors"
        >
          Voir sur Vinted
        </button>
        {onAddPurchase && (
          <>
            <div className="w-px bg-[var(--card-border)]" />
            <button
              onClick={() => { hapticFeedback('light'); onAddPurchase(article); }}
              className="flex-1 py-2 text-[11px] font-medium text-tg-accent active:bg-tg-secondary transition-colors"
            >
              + Achats
            </button>
          </>
        )}
      </div>
    </div>
  );
}
