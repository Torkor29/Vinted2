import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal, Plus, Pencil, Trash2, Gem } from 'lucide-react';
import { useFilters, useToggleFilter, useDeleteFilter } from '../hooks/useFilters.js';
import { hapticFeedback, hapticNotification } from '../utils/telegram.js';

export default function Filters() {
  const navigate = useNavigate();
  const { data: filters, isLoading } = useFilters();
  const toggleFilter  = useToggleFilter();
  const deleteFilter  = useDeleteFilter();

  const total  = filters?.length ?? 0;
  const active = filters?.filter(f => f.is_active).length ?? 0;

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
    <div className="px-4 pt-4 pb-28 max-w-full overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'rgba(108, 92, 231, 0.15)' }}
          >
            <SlidersHorizontal size={16} style={{ color: 'var(--button-color)' }} />
          </div>
          <div>
            <h1 className="text-base font-bold leading-none" style={{ color: 'var(--text-color)' }}>
              Mes Filtres
            </h1>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--hint-color)' }}>
              {active} actif{active !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: 'var(--secondary-bg-color)', color: 'var(--hint-color)' }}
        >
          {total}/5
        </span>
      </div>

      {/* ── Loading ─────────────────────────────────────────────── */}
      {isLoading && (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--hint-color)' }}>
          Chargement…
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────── */}
      {!isLoading && total === 0 && (
        <div className="text-center py-16">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'var(--section-bg-color)', border: '1px solid var(--card-border)' }}
          >
            <SlidersHorizontal size={28} style={{ color: 'var(--hint-color)' }} />
          </div>
          <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text-color)' }}>
            Aucun filtre
          </h2>
          <p className="text-xs px-6 mb-6" style={{ color: 'var(--hint-color)' }}>
            Crée ton premier filtre pour surveiller Vinted
          </p>
          <button
            onClick={() => { hapticFeedback('medium'); navigate('/filters/new'); }}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
            style={{ backgroundColor: 'var(--button-color)', color: '#fff' }}
          >
            Créer un filtre
          </button>
        </div>
      )}

      {/* ── Filter list ─────────────────────────────────────────── */}
      <div className="space-y-2">
        {filters?.map(filter => (
          <div
            key={filter.id}
            className="rounded-xl border overflow-hidden"
            style={{
              backgroundColor: 'var(--section-bg-color)',
              borderColor: filter.is_active ? 'rgba(0, 214, 143, 0.18)' : 'var(--card-border)',
            }}
          >
            {/* Main row */}
            <div className="flex items-center gap-3 p-3.5">

              {/* Status dot */}
              <span
                className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
                style={{ backgroundColor: filter.is_active ? 'var(--success-color)' : 'var(--hint-color)' }}
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-color)' }}>
                  {filter.name}
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {filter.search_text && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] font-medium truncate max-w-[110px]"
                      style={{ backgroundColor: 'var(--secondary-bg-color)', color: 'var(--hint-color)' }}
                    >
                      &ldquo;{filter.search_text}&rdquo;
                    </span>
                  )}
                  {filter.price_from && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px]"
                      style={{ backgroundColor: 'var(--secondary-bg-color)', color: 'var(--hint-color)' }}
                    >
                      &gt;{filter.price_from}&nbsp;€
                    </span>
                  )}
                  {filter.price_to && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px]"
                      style={{ backgroundColor: 'var(--secondary-bg-color)', color: 'var(--hint-color)' }}
                    >
                      &lt;{filter.price_to}&nbsp;€
                    </span>
                  )}
                  {filter.pepite_enabled && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] font-semibold flex items-center gap-0.5"
                      style={{ backgroundColor: 'var(--pepite-bg)', color: 'var(--pepite-color)' }}
                    >
                      <Gem size={8} /> Pépites
                    </span>
                  )}
                </div>
              </div>

              {/* Toggle switch */}
              <button
                onClick={() => handleToggle(filter.id)}
                aria-label={filter.is_active ? 'Désactiver' : 'Activer'}
                className="relative w-11 h-6 rounded-full flex-shrink-0 transition-colors"
                style={{ backgroundColor: filter.is_active ? 'var(--success-color)' : '#2a2a3d' }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                  style={{ transform: filter.is_active ? 'translateX(22px)' : 'translateX(2px)' }}
                />
              </button>
            </div>

            {/* Actions row */}
            <div
              className="flex"
              style={{ borderTop: '1px solid var(--card-border)' }}
            >
              <button
                onClick={() => { hapticFeedback('light'); navigate(`/filters/${filter.id}`); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-opacity active:opacity-60"
                style={{ color: 'var(--accent-text-color)' }}
              >
                <Pencil size={11} /> Modifier
              </button>
              <div className="w-px" style={{ backgroundColor: 'var(--card-border)' }} />
              <button
                onClick={() => handleDelete(filter.id, filter.name)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-opacity active:opacity-60"
                style={{ color: 'var(--destructive-text-color)' }}
              >
                <Trash2 size={11} /> Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── FAB ─────────────────────────────────────────────────── */}
      {total < 5 && (
        <button
          onClick={() => { hapticFeedback('medium'); navigate('/filters/new'); }}
          className="fixed bottom-20 right-4 w-13 h-13 rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform glow-purple z-50"
          style={{
            width: '52px',
            height: '52px',
            backgroundColor: 'var(--button-color)',
          }}
          aria-label="Nouveau filtre"
        >
          <Plus size={22} color="#fff" />
        </button>
      )}
    </div>
  );
}
