import { useNavigate } from 'react-router-dom';
import { useFilters, useToggleFilter, useDeleteFilter } from '../hooks/useFilters.js';
import { useBackButton } from '../hooks/useTelegram.js';
import { hapticFeedback, hapticNotification } from '../utils/telegram.js';
import { useCallback } from 'react';

export default function Filters() {
  const navigate = useNavigate();
  const { data: filters, isLoading } = useFilters();
  const toggleFilter = useToggleFilter();
  const deleteFilter = useDeleteFilter();

  const handleBack = useCallback(() => navigate('/'), [navigate]);
  useBackButton(handleBack);

  const handleToggle = (id: string) => {
    hapticFeedback('medium');
    toggleFilter.mutate(id);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Supprimer le filtre "${name}" ?`)) {
      hapticNotification('warning');
      deleteFilter.mutate(id);
    }
  };

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-tg">Mes Filtres</h1>
        <span className="text-sm text-tg-hint">{filters?.length ?? 0}/5</span>
      </div>

      {isLoading && (
        <div className="text-center text-tg-hint py-12">Chargement...</div>
      )}

      {!isLoading && (!filters || filters.length === 0) && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-lg font-medium text-tg mb-2">Aucun filtre</h2>
          <p className="text-sm text-tg-hint mb-6">
            Cree ton premier filtre pour commencer a surveiller Vinted
          </p>
          <button
            onClick={() => { hapticFeedback('medium'); navigate('/filters/new'); }}
            className="bg-tg-button text-tg-button px-6 py-3 rounded-xl font-medium"
          >
            Creer un filtre
          </button>
        </div>
      )}

      <div className="space-y-3">
        {filters?.map(filter => (
          <div key={filter.id} className="bg-tg-section rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-tg">{filter.name}</h3>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {filter.search_text && (
                    <span className="px-2 py-0.5 bg-tg-secondary rounded-full text-xs text-tg-hint">
                      "{filter.search_text}"
                    </span>
                  )}
                  {filter.catalog_ids?.length ? (
                    <span className="px-2 py-0.5 bg-tg-secondary rounded-full text-xs text-tg-hint">
                      {filter.catalog_ids.length} cat.
                    </span>
                  ) : null}
                  {filter.price_from && (
                    <span className="px-2 py-0.5 bg-tg-secondary rounded-full text-xs text-tg-hint">
                      &gt;{filter.price_from} EUR
                    </span>
                  )}
                  {filter.price_to && (
                    <span className="px-2 py-0.5 bg-tg-secondary rounded-full text-xs text-tg-hint">
                      &lt;{filter.price_to} EUR
                    </span>
                  )}
                  {filter.pepite_enabled && (
                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs">
                      Pepites
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleToggle(filter.id)}
                className={`w-12 h-7 rounded-full relative transition-colors ${
                  filter.is_active ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  filter.is_active ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => { hapticFeedback('light'); navigate(`/filters/${filter.id}`); }}
                className="flex-1 text-xs text-tg-link py-1.5"
              >
                Modifier
              </button>
              <button
                onClick={() => handleDelete(filter.id, filter.name)}
                className="flex-1 text-xs text-tg-destructive py-1.5"
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* FAB */}
      <button
        onClick={() => { hapticFeedback('medium'); navigate('/filters/new'); }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-tg-button text-tg-button rounded-full shadow-lg flex items-center justify-center text-2xl hover:scale-105 transition-transform"
      >
        +
      </button>
    </div>
  );
}
