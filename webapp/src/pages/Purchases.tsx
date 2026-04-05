import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Plus, Pencil, Trash2 } from 'lucide-react';
import { usePurchases, usePurchaseStats, useDeletePurchase } from '../hooks/usePurchases.js';
import { formatPriceCompact } from '../utils/formatters.js';
import ProfitIndicator from '../components/ProfitIndicator.js';
import { hapticFeedback, hapticNotification } from '../utils/telegram.js';

const TABS = [
  { key: undefined,    label: 'Tous' },
  { key: 'purchased',  label: 'Stock' },
  { key: 'listed',     label: 'En vente' },
  { key: 'sold',       label: 'Vendus' },
] as const;

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  purchased: { bg: 'rgba(59, 130, 246, 0.15)',  color: '#60a5fa', label: 'Stock'    },
  listed:    { bg: 'rgba(251, 146, 60, 0.15)',   color: '#fb923c', label: 'En vente' },
  sold:      { bg: 'rgba(0, 214, 143, 0.15)',    color: 'var(--success-color)', label: 'Vendu' },
  returned:  { bg: 'rgba(229, 87, 87, 0.15)',    color: 'var(--destructive-text-color)', label: 'Retour' },
};

export default function Purchases() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const { data: purchases, isLoading } = usePurchases(activeTab);
  const { data: stats }               = usePurchaseStats();
  const deletePurchase                = useDeletePurchase();

  return (
    <div className="px-4 pt-4 pb-28 max-w-full overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: 'rgba(108, 92, 231, 0.15)' }}
        >
          <ShoppingBag size={16} style={{ color: 'var(--button-color)' }} />
        </div>
        <div>
          <h1 className="text-base font-bold leading-none" style={{ color: 'var(--text-color)' }}>
            Achats
          </h1>
          {stats && (
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--hint-color)' }}>
              {stats.totalPurchases} achat{stats.totalPurchases !== 1 ? 's' : ''} &middot; {stats.totalSold} vendu{stats.totalSold !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────── */}
      {stats && (
        <div
          className="rounded-xl border p-3 mb-4"
          style={{ backgroundColor: 'var(--section-bg-color)', borderColor: 'var(--card-border)' }}
        >
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[9px] uppercase tracking-wide mb-1" style={{ color: 'var(--hint-color)' }}>
                Investi
              </p>
              <p className="text-sm font-bold" style={{ color: 'var(--text-color)' }}>
                {formatPriceCompact(stats.totalInvested)}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wide mb-1" style={{ color: 'var(--hint-color)' }}>
                Revenus
              </p>
              <p className="text-sm font-bold" style={{ color: 'var(--text-color)' }}>
                {formatPriceCompact(stats.totalRevenue)}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wide mb-1" style={{ color: 'var(--hint-color)' }}>
                Profit
              </p>
              <ProfitIndicator profit={stats.totalProfit} profitPct={stats.averageRoi} size="sm" />
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar">
        {TABS.map(tab => (
          <button
            key={tab.key ?? 'all'}
            onClick={() => { hapticFeedback('light'); setActiveTab(tab.key); }}
            className="px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap flex-shrink-0 transition-colors"
            style={{
              backgroundColor: activeTab === tab.key ? 'var(--button-color)' : 'var(--secondary-bg-color)',
              color: activeTab === tab.key ? '#fff' : 'var(--hint-color)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Loading ─────────────────────────────────────────────── */}
      {isLoading && (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--hint-color)' }}>
          Chargement…
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────── */}
      {!isLoading && (!purchases || purchases.length === 0) && (
        <div className="text-center py-16">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'var(--section-bg-color)', border: '1px solid var(--card-border)' }}
          >
            <ShoppingBag size={28} style={{ color: 'var(--hint-color)' }} />
          </div>
          <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text-color)' }}>
            Aucun achat
          </h2>
          <p className="text-xs mb-6" style={{ color: 'var(--hint-color)' }}>
            Ajoute tes achats pour suivre ta rentabilité
          </p>
          <button
            onClick={() => { hapticFeedback('medium'); navigate('/purchases/new'); }}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
            style={{ backgroundColor: 'var(--button-color)', color: '#fff' }}
          >
            Ajouter un achat
          </button>
        </div>
      )}

      {/* ── Purchase list ───────────────────────────────────────── */}
      <div className="space-y-2">
        {purchases?.map(p => {
          const s = STATUS_STYLES[p.status] ?? { bg: 'var(--secondary-bg-color)', color: 'var(--hint-color)', label: p.status };
          return (
            <div
              key={p.id}
              className="rounded-xl border overflow-hidden"
              style={{ backgroundColor: 'var(--section-bg-color)', borderColor: 'var(--card-border)' }}
            >
              <div className="flex gap-3 p-3">
                {/* Photo */}
                {p.photo_url ? (
                  <img
                    src={p.photo_url}
                    alt=""
                    className="w-14 h-14 object-cover rounded-xl flex-shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-xl flex-shrink-0"
                    style={{ backgroundColor: 'var(--secondary-bg-color)' }}
                  />
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1 mb-0.5">
                    <h3
                      className="font-semibold text-xs truncate flex-1"
                      style={{ color: 'var(--text-color)' }}
                    >
                      {p.title}
                    </h3>
                    <span
                      className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold"
                      style={{ backgroundColor: s.bg, color: s.color }}
                    >
                      {s.label}
                    </span>
                  </div>

                  {p.brand_name && (
                    <p className="text-[10px] mb-1" style={{ color: 'var(--hint-color)' }}>
                      {p.brand_name}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-color)' }}>
                      {formatPriceCompact(p.total_cost)}
                    </span>
                    {p.is_sold && p.sold_price && (
                      <span className="text-xs" style={{ color: 'var(--hint-color)' }}>
                        &rarr; {formatPriceCompact(p.sold_price)}
                      </span>
                    )}
                  </div>
                  {p.profit && (
                    <ProfitIndicator profit={p.profit} profitPct={p.profit_pct} size="sm" />
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex" style={{ borderTop: '1px solid var(--card-border)' }}>
                <button
                  onClick={() => { hapticFeedback('light'); navigate(`/purchases/${p.id}`); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-opacity active:opacity-60"
                  style={{ color: 'var(--accent-text-color)' }}
                >
                  <Pencil size={11} /> Modifier
                </button>
                <div className="w-px" style={{ backgroundColor: 'var(--card-border)' }} />
                <button
                  onClick={() => {
                    if (confirm('Supprimer cet achat ?')) {
                      hapticNotification('warning');
                      deletePurchase.mutate(p.id);
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-opacity active:opacity-60"
                  style={{ color: 'var(--destructive-text-color)' }}
                >
                  <Trash2 size={11} /> Supprimer
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── FAB ─────────────────────────────────────────────────── */}
      <button
        onClick={() => { hapticFeedback('medium'); navigate('/purchases/new'); }}
        className="fixed bottom-20 right-4 rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform glow-purple z-50"
        style={{ width: '52px', height: '52px', backgroundColor: 'var(--button-color)' }}
        aria-label="Nouvel achat"
      >
        <Plus size={22} color="#fff" />
      </button>
    </div>
  );
}
