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
    <div className="bg-tg-section rounded-xl overflow-hidden shadow-sm">
      <div className="flex gap-3 p-3">
        {article.photo_url ? (
          <img
            src={article.photo_url}
            alt={article.title ?? ''}
            className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
            loading="lazy"
          />
        ) : (
          <div className="w-20 h-20 bg-tg-secondary rounded-lg flex-shrink-0 flex items-center justify-center text-tg-hint text-2xl">
            ?
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-sm text-tg truncate">
              {article.title ?? 'Sans titre'}
            </h3>
            {article.is_pepite && (
              <span className="flex-shrink-0 px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-bold rounded-full">
                PEPITE
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="font-bold text-tg">
              {formatPriceCompact(article.price)}
            </span>
            {article.is_pepite && article.estimated_market_price && (
              <span className="text-xs text-tg-hint line-through">
                {formatPriceCompact(article.estimated_market_price)}
              </span>
            )}
            {article.is_pepite && article.price_difference_pct && (
              <span className="text-xs text-green-600 font-medium">
                {formatPercent(article.price_difference_pct)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1 text-xs text-tg-hint">
            {article.brand_name && <span>{article.brand_name}</span>}
            {article.size_name && <span>Taille {article.size_name}</span>}
          </div>

          <div className="flex items-center gap-2 mt-1 text-xs text-tg-hint">
            {article.seller_username && (
              <span>@{article.seller_username}</span>
            )}
            {article.seller_rating && (
              <span>* {article.seller_rating}</span>
            )}
            <span className="ml-auto">{formatTimeAgo(article.detected_at)}</span>
          </div>
        </div>
      </div>

      <div className="flex border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={handleOpen}
          className="flex-1 py-2.5 text-xs font-medium text-tg-link hover:bg-tg-secondary transition-colors"
        >
          Voir sur Vinted
        </button>
        {onAddPurchase && (
          <button
            onClick={() => { hapticFeedback('light'); onAddPurchase(article); }}
            className="flex-1 py-2.5 text-xs font-medium text-tg-accent border-l border-gray-100 dark:border-gray-800 hover:bg-tg-secondary transition-colors"
          >
            Ajouter aux achats
          </button>
        )}
      </div>
    </div>
  );
}
