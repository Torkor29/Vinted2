import { useNavigate } from 'react-router-dom';
import { Plus, Gem, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { useFilters, useToggleFilter } from '../hooks/useFilters.js';
import { hapticFeedback } from '../utils/telegram.js';

export default function Filters() {
  const navigate = useNavigate();
  const { data: filters, isLoading } = useFilters();
  const toggleFilter = useToggleFilter();

  const total  = filters?.length ?? 0;
  const active = filters?.filter(f => f.is_active).length ?? 0;

  const go = (path: string) => { hapticFeedback('light'); navigate(path); };

  return (
    <div style={{ background: 'var(--bg-color)', minHeight: '100dvh', paddingBottom: 96 }}>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-color)', letterSpacing: '-0.5px' }}>
            Mes Filtres
          </h1>
          {total < 5 && (
            <button
              onClick={() => go('/filters/new')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 20,
                background: 'var(--button-color)', border: 'none',
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Plus size={14} strokeWidth={2.5} />
              Nouveau
            </button>
          )}
        </div>
        <p style={{ fontSize: 13, color: 'var(--hint-color)', marginBottom: 20 }}>
          {total === 0
            ? 'Aucun filtre configuré'
            : `${active} actif${active !== 1 ? 's' : ''} · ${total}/5 filtre${total !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* ── Loading ──────────────────────────────────────────────── */}
      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div className="anim-spin" style={{
            width: 28, height: 28, borderRadius: '50%',
            border: '2.5px solid var(--secondary-bg-color)',
            borderTopColor: 'var(--button-color)',
          }} />
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────── */}
      {!isLoading && total === 0 && (
        <div style={{ padding: '0 20px' }}>
          <div style={{
            borderRadius: 20, padding: '40px 24px',
            background: 'var(--section-bg-color)', border: '1px solid var(--card-border)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18, marginBottom: 16,
              background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <SlidersHorizontal size={28} style={{ color: 'var(--button-color)' }} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-color)', marginBottom: 8 }}>
              Pas encore de filtre
            </p>
            <p style={{ fontSize: 13, color: 'var(--hint-color)', lineHeight: 1.6, marginBottom: 24 }}>
              Crée ton premier filtre pour que le bot surveille Vinted et t'alerte en temps réel.
            </p>
            <button
              onClick={() => go('/filters/new')}
              style={{
                padding: '12px 28px', borderRadius: 14,
                background: 'var(--button-color)', border: 'none',
                color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Créer mon premier filtre
            </button>
          </div>
        </div>
      )}

      {/* ── Filter list ──────────────────────────────────────────── */}
      {!isLoading && total > 0 && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filters!.map(filter => (
            <FilterCard
              key={filter.id}
              filter={filter}
              onEdit={() => go(`/filters/${filter.id}`)}
              onToggle={() => { hapticFeedback('medium'); toggleFilter.mutate(filter.id); }}
            />
          ))}
        </div>
      )}

      {/* ── Quota bar ───────────────────────────────────────────── */}
      {total > 0 && (
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--hint-color)', marginBottom: 6 }}>
            <span>Filtres utilisés</span>
            <span style={{ fontWeight: 700, color: total >= 5 ? 'var(--destructive-text-color)' : 'var(--text-color)' }}>
              {total}/5
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--secondary-bg-color)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2, transition: 'width 0.4s ease',
              width: `${(total / 5) * 100}%`,
              background: total >= 5
                ? 'var(--destructive-text-color)'
                : total >= 4
                ? 'var(--warning-color)'
                : 'var(--button-color)',
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Filter Card ─────────────────────────────────────────────────────
interface FilterCardProps {
  filter: {
    id: string; name: string; is_active: boolean;
    search_text: string | null; price_from: string | null;
    price_to: string | null; pepite_enabled: boolean;
    catalog_ids: number[] | null; size_ids: number[] | null;
  };
  onEdit: () => void;
  onToggle: () => void;
}

function FilterCard({ filter, onEdit, onToggle }: FilterCardProps) {
  const tags: Array<{ label: string; gold?: boolean }> = [];
  if (filter.search_text) tags.push({ label: `"${filter.search_text}"` });
  if (filter.price_from && filter.price_to) tags.push({ label: `${filter.price_from}–${filter.price_to} €` });
  else if (filter.price_from) tags.push({ label: `> ${filter.price_from} €` });
  else if (filter.price_to) tags.push({ label: `< ${filter.price_to} €` });
  if (filter.catalog_ids?.length) tags.push({ label: `${filter.catalog_ids.length} catégorie${filter.catalog_ids.length > 1 ? 's' : ''}` });
  if (filter.size_ids?.length) tags.push({ label: `${filter.size_ids.length} taille${filter.size_ids.length > 1 ? 's' : ''}` });

  return (
    <div
      style={{
        borderRadius: 16, overflow: 'hidden',
        background: 'var(--section-bg-color)',
        border: `1px solid ${filter.is_active ? 'rgba(16,185,129,0.2)' : 'var(--card-border)'}`,
        boxShadow: filter.is_active ? '0 0 0 1px rgba(16,185,129,0.08) inset' : 'none',
      }}
    >
      {/* Clickable body → edit */}
      <button
        onClick={onEdit}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px 12px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        {/* Active indicator */}
        <div style={{
          width: 8, height: 8, borderRadius: 4, flexShrink: 0,
          background: filter.is_active ? 'var(--success-color)' : 'var(--hint-color)',
          boxShadow: filter.is_active ? '0 0 6px rgba(16,185,129,0.6)' : 'none',
          transition: 'all 0.2s',
        }} />

        {/* Name + tags */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 15, fontWeight: 700, color: 'var(--text-color)',
            marginBottom: tags.length > 0 ? 6 : 0, lineHeight: 1.2,
          }}>
            {filter.name}
          </p>
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {tags.map((t, i) => (
                <span key={i} style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 6,
                  background: 'var(--secondary-bg-color)', color: 'var(--hint-color)',
                  fontWeight: 500,
                }}>
                  {t.label}
                </span>
              ))}
              {filter.pepite_enabled && (
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 6,
                  background: 'var(--pepite-bg)', color: 'var(--pepite-color)',
                  fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3,
                }}>
                  <Gem size={9} /> Pépites
                </span>
              )}
            </div>
          )}
        </div>

        <ChevronRight size={15} style={{ color: 'var(--hint-color)', opacity: 0.4, flexShrink: 0 }} />
      </button>

      {/* Bottom bar: status label + toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px 10px',
        borderTop: '1px solid var(--card-border)',
      }}>
        <span style={{
          fontSize: 11, fontWeight: 600,
          color: filter.is_active ? 'var(--success-color)' : 'var(--hint-color)',
        }}>
          {filter.is_active ? '● Actif' : '○ Inactif'}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          style={{
            width: 44, height: 24, borderRadius: 12, border: 'none',
            cursor: 'pointer', position: 'relative', flexShrink: 0,
            background: filter.is_active ? 'var(--success-color)' : 'var(--secondary-bg-color)',
            transition: 'background 0.2s',
          }}
        >
          <span style={{
            position: 'absolute', top: 2, width: 20, height: 20, borderRadius: 10,
            background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            transition: 'transform 0.2s',
            transform: filter.is_active ? 'translateX(22px)' : 'translateX(2px)',
          }} />
        </button>
      </div>
    </div>
  );
}
