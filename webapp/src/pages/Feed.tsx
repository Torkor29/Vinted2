import { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useArticles } from '../hooks/useArticles.js';
import { useFilters } from '../hooks/useFilters.js';
import { useBackButton } from '../hooks/useTelegram.js';
import ArticleCard from '../components/ArticleCard.js';
import FilterBadge from '../components/FilterBadge.js';
import type { Article } from '../hooks/useArticles.js';

export default function Feed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pepitesOnly = searchParams.get('pepites') === 'true';

  const [selectedFilter, setSelectedFilter] = useState<string | undefined>();
  const { data: filters } = useFilters();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useArticles(selectedFilter, pepitesOnly);

  const handleBack = useCallback(() => navigate('/'), [navigate]);
  useBackButton(handleBack);

  const articles = data?.pages.flatMap(p => p.data) ?? [];

  const handleAddPurchase = (article: Article) => {
    navigate(`/purchases/new?articleId=${article.id}&title=${encodeURIComponent(article.title ?? '')}&price=${article.price}&photo=${encodeURIComponent(article.photo_url ?? '')}&url=${encodeURIComponent(article.vinted_url)}&brand=${encodeURIComponent(article.brand_name ?? '')}`);
  };

  return (
    <div className="p-4 pb-24">
      <h1 className="text-xl font-bold text-tg mb-4">
        {pepitesOnly ? 'Pepites' : 'Feed'}
      </h1>

      {/* Filter chips */}
      {filters && filters.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-4 px-4">
          <FilterBadge
            name="Tous"
            isActive={!selectedFilter}
            onClick={() => setSelectedFilter(undefined)}
          />
          {filters.map(filter => (
            <FilterBadge
              key={filter.id}
              name={filter.name}
              isActive={selectedFilter === filter.id}
              onClick={() => setSelectedFilter(
                selectedFilter === filter.id ? undefined : filter.id,
              )}
            />
          ))}
        </div>
      )}

      {/* Articles list */}
      {isLoading && (
        <div className="text-center text-tg-hint py-12">Chargement...</div>
      )}

      {!isLoading && articles.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">{pepitesOnly ? '💎' : '📦'}</div>
          <h2 className="text-lg font-medium text-tg mb-2">
            {pepitesOnly ? 'Aucune pepite' : 'Aucun article'}
          </h2>
          <p className="text-sm text-tg-hint">
            Les articles apparaitront ici au fur et a mesure que tes filtres detectent des resultats.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {articles.map(article => (
          <ArticleCard
            key={article.id}
            article={article}
            onAddPurchase={handleAddPurchase}
          />
        ))}
      </div>

      {/* Load more */}
      {hasNextPage && (
        <div className="text-center mt-6">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="bg-tg-secondary text-tg px-6 py-2.5 rounded-xl text-sm font-medium"
          >
            {isFetchingNextPage ? 'Chargement...' : 'Charger plus'}
          </button>
        </div>
      )}
    </div>
  );
}
