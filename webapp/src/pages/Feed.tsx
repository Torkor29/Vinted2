import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useArticles } from '../hooks/useArticles.js';
import { useFilters } from '../hooks/useFilters.js';
import ArticleCard from '../components/ArticleCard.js';
import type { Article } from '../hooks/useArticles.js';

export default function Feed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pepitesOnly = searchParams.get('pepites') === 'true';

  const [selectedFilter, setSelectedFilter] = useState<string | undefined>();
  const { data: filters } = useFilters();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useArticles(selectedFilter, pepitesOnly);

  const articles = data?.pages.flatMap(p => p.data) ?? [];

  const handleAddPurchase = (article: Article) => {
    navigate(`/purchases/new?articleId=${article.id}&title=${encodeURIComponent(article.title ?? '')}&price=${article.price}&photo=${encodeURIComponent(article.photo_url ?? '')}&url=${encodeURIComponent(article.vinted_url)}&brand=${encodeURIComponent(article.brand_name ?? '')}`);
  };

  return (
    <div className="px-4 pt-4 pb-24 max-w-full overflow-hidden">
      <h1 className="text-lg font-bold text-tg mb-3">
        {pepitesOnly ? '💎 Pepites' : '📦 Feed'}
      </h1>

      {/* Filter chips */}
      {filters && filters.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-3 -mx-4 px-4 no-scrollbar">
          <button
            onClick={() => setSelectedFilter(undefined)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
              !selectedFilter ? 'bg-tg-button text-tg-button' : 'bg-tg-secondary text-tg-hint'}`}
          >
            Tous
          </button>
          {filters.map(f => (
            <button key={f.id}
              onClick={() => setSelectedFilter(selectedFilter === f.id ? undefined : f.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
                selectedFilter === f.id ? 'bg-tg-button text-tg-button' : 'bg-tg-secondary text-tg-hint'}`}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {isLoading && <div className="text-center text-tg-hint py-12 text-sm">Chargement...</div>}

      {!isLoading && articles.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">{pepitesOnly ? '💎' : '📦'}</div>
          <h2 className="text-base font-semibold text-tg mb-1">Aucun article</h2>
          <p className="text-xs text-tg-hint px-6">Les articles apparaitront ici quand tes filtres detecteront des resultats.</p>
        </div>
      )}

      <div className="space-y-2">
        {articles.map(article => (
          <ArticleCard key={article.id} article={article} onAddPurchase={handleAddPurchase} />
        ))}
      </div>

      {hasNextPage && (
        <div className="text-center mt-4">
          <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
            className="bg-tg-secondary text-tg px-5 py-2 rounded-xl text-xs font-medium active:scale-95 transition-transform">
            {isFetchingNextPage ? 'Chargement...' : 'Charger plus'}
          </button>
        </div>
      )}
    </div>
  );
}
