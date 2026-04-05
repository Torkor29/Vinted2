import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Package, Gem } from 'lucide-react';
import { useArticles } from '../hooks/useArticles.js';
import { useFilters } from '../hooks/useFilters.js';
import ArticleCard from '../components/ArticleCard.js';
import type { Article } from '../hooks/useArticles.js';
import { hapticFeedback } from '../utils/telegram.js';

export default function Feed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pepitesOnly = searchParams.get('pepites') === 'true';

  const [selectedFilter, setSelectedFilter] = useState<string | undefined>();
  const { data: filters } = useFilters();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useArticles(selectedFilter, pepitesOnly);

  const articles = data?.pages.flatMap(p => p.data) ?? [];

  const handleAddPurchase = (article: Article) => {
    navigate(
      `/purchases/new?articleId=${article.id}` +
      `&title=${encodeURIComponent(article.title ?? '')}` +
      `&price=${article.price}` +
      `&photo=${encodeURIComponent(article.photo_url ?? '')}` +
      `&url=${encodeURIComponent(article.vinted_url)}` +
      `&brand=${encodeURIComponent(article.brand_name ?? '')}`
    );
  };

  const TitleIcon = pepitesOnly ? Gem : Package;
  const titleText = pepitesOnly ? 'Pépites' : 'Feed';

  return (
    <div className="px-4 pt-4 pb-24 max-w-full overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            backgroundColor: pepitesOnly ? 'var(--pepite-bg)' : 'rgba(108, 92, 231, 0.15)',
          }}
        >
          <TitleIcon
            size={16}
            style={{ color: pepitesOnly ? 'var(--pepite-color)' : 'var(--button-color)' }}
          />
        </div>
        <div>
          <h1 className="text-base font-bold leading-none" style={{ color: 'var(--text-color)' }}>
            {titleText}
          </h1>
          {articles.length > 0 && (
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--hint-color)' }}>
              {articles.length} article{articles.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* ── Filter chips ────────────────────────────────────────── */}
      {filters && filters.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-3 -mx-4 px-4 no-scrollbar">
          <button
            onClick={() => { hapticFeedback('light'); setSelectedFilter(undefined); }}
            className="px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap flex-shrink-0 transition-colors"
            style={{
              backgroundColor: !selectedFilter ? 'var(--button-color)' : 'var(--secondary-bg-color)',
              color: !selectedFilter ? '#fff' : 'var(--hint-color)',
            }}
          >
            Tous
          </button>
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => { hapticFeedback('light'); setSelectedFilter(selectedFilter === f.id ? undefined : f.id); }}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap flex-shrink-0 transition-colors"
              style={{
                backgroundColor: selectedFilter === f.id ? 'var(--button-color)' : 'var(--secondary-bg-color)',
                color: selectedFilter === f.id ? '#fff' : 'var(--hint-color)',
              }}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────── */}
      {isLoading && (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--hint-color)' }}>
          Chargement…
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────── */}
      {!isLoading && articles.length === 0 && (
        <div className="text-center py-16">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'var(--section-bg-color)', border: '1px solid var(--card-border)' }}
          >
            <TitleIcon size={28} style={{ color: 'var(--hint-color)' }} />
          </div>
          <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text-color)' }}>
            Aucun article
          </h2>
          <p className="text-xs px-6" style={{ color: 'var(--hint-color)' }}>
            Les articles apparaîtront ici quand tes filtres détecteront des résultats.
          </p>
        </div>
      )}

      {/* ── Article list ────────────────────────────────────────── */}
      <div className="space-y-2">
        {articles.map(article => (
          <ArticleCard key={article.id} article={article} onAddPurchase={handleAddPurchase} />
        ))}
      </div>

      {/* ── Load more ───────────────────────────────────────────── */}
      {hasNextPage && (
        <div className="text-center mt-4">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="px-6 py-2 rounded-xl text-xs font-semibold active:scale-95 transition-transform"
            style={{
              backgroundColor: 'var(--secondary-bg-color)',
              color: isFetchingNextPage ? 'var(--hint-color)' : 'var(--text-color)',
            }}
          >
            {isFetchingNextPage ? 'Chargement…' : 'Charger plus'}
          </button>
        </div>
      )}
    </div>
  );
}
