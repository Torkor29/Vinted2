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
    if (confirm(`Supprimer "${name}" ?`)) {
      hapticNotification('warning');
      deleteFilter.mutate(id);
    }
  };

  return (
    <div className="px-4 pt-4 pb-24 max-w-full overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-tg">Mes Filtres</h1>
        <span className="text-xs text-tg-hint bg-tg-secondary px-2 py-0.5 rounded-full">{filters?.length ?? 0}/5</span>
      </div>

      {isLoading && (
        <div className="text-center text-tg-hint py-12 text-sm">Chargement...</div>
      )}

      {!isLoading && (!filters || filters.length === 0) && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🔍</div>
          <h2 className="text-base font-semibold text-tg mb-1">Aucun filtre</h2>
          <p className="text-xs text-tg-hint mb-5 px-4">
            Cree ton premier filtre pour surveiller Vinted
          </p>
          <button
            onClick={() => { hapticFeedback('medium'); navigate('/filters/new'); }}
            className="bg-tg-button text-tg-button px-5 py-2.5 rounded-xl text-sm font-medium active:scale-95 transition-transform"
          >
            Creer un filtre
          </button>
        </div>
      )}

      <div className="space-y-2">
        {filters?.map(filter => (
          <div key={filter.id} className="bg-tg-section rounded-xl border border-[var(--card-border)] overflow-hidden">
            <div className="flex items-center gap-3 p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${filter.is_active ? 'bg-[var(--success-color)]' : 'bg-gray-500'}`} />
                  <h3 className="font-medium text-sm text-tg truncate">{filter.name}</h3>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5 ml-4">
                  {filter.search_text && (
                    <span className="px-1.5 py-0.5 bg-tg-secondary rounded text-[10px] text-tg-hint truncate max-w-[120px]">
                      "{filter.search_text}"
                    </span>
                  )}
                  {filter.price_from && (
                    <span className="px-1.5 py-0.5 bg-tg-secondary rounded text-[10px] text-tg-hint">
                      &gt;{filter.price_from}EUR
                    </span>
                  )}
                  {filter.price_to && (
                    <span className="px-1.5 py-0.5 bg-tg-secondary rounded text-[10px] text-tg-hint">
                      &lt;{filter.price_to}EUR
                    </span>
                  )}
                  {filter.pepite_enabled && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: 'var(--pepite-bg)', color: 'var(--pepite-color)' }}>
                      💎
                    </span>
                  )}
                </div>
              </div>

              {/* Toggle */}
              <button
                onClick={() => handleToggle(filter.id)}
                className={`w-11 h-6 rounded-full relative flex-shrink-0 transition-colors ${filter.is_active ? 'bg-[var(--success-color)]' : 'bg-gray-600'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${filter.is_active ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex border-t border-[var(--card-border)]">
              <button
                onClick={() => { hapticFeedback('light'); navigate(`/filters/${filter.id}`); }}
                className="flex-1 py-2 text-[11px] text-tg-link active:bg-tg-secondary transition-colors"
              >
                Modifier
              </button>
              <div className="w-px bg-[var(--card-border)]" />
              <button
                onClick={() => handleDelete(filter.id, filter.name)}
                className="flex-1 py-2 text-[11px] text-tg-destructive active:bg-tg-secondary transition-colors"
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
        className="fixed bottom-20 right-4 w-12 h-12 bg-tg-button text-tg-button rounded-full shadow-lg flex items-center justify-center text-xl active:scale-90 transition-transform glow-purple z-50"
      >
        +
      </button>
    </div>
  );
}
