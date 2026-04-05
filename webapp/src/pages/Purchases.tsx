import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePurchases, usePurchaseStats, useDeletePurchase } from '../hooks/usePurchases.js';
import { formatPriceCompact } from '../utils/formatters.js';
import ProfitIndicator from '../components/ProfitIndicator.js';
import { hapticFeedback, hapticNotification } from '../utils/telegram.js';

const TABS = [
  { key: undefined, label: 'Tous' },
  { key: 'purchased', label: 'Stock' },
  { key: 'listed', label: 'En vente' },
  { key: 'sold', label: 'Vendus' },
] as const;

export default function Purchases() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);
  const { data: purchases, isLoading } = usePurchases(activeTab);
  const { data: stats } = usePurchaseStats();
  const deletePurchase = useDeletePurchase();

  const statusColors: Record<string, string> = {
    purchased: 'bg-blue-500/20 text-blue-400',
    listed: 'bg-orange-500/20 text-orange-400',
    sold: 'bg-green-500/20 text-green-400',
    returned: 'bg-red-500/20 text-red-400',
  };
  const statusLabels: Record<string, string> = {
    purchased: 'Stock', listed: 'En vente', sold: 'Vendu', returned: 'Retour',
  };

  return (
    <div className="px-4 pt-4 pb-24 max-w-full overflow-hidden">
      <h1 className="text-lg font-bold text-tg mb-3">🛒 Achats</h1>

      {/* Stats bar */}
      {stats && (
        <div className="bg-tg-section rounded-xl border border-[var(--card-border)] p-3 mb-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[10px] text-tg-hint">Investi</div>
              <div className="text-xs font-bold text-tg">{formatPriceCompact(stats.totalInvested)}</div>
            </div>
            <div>
              <div className="text-[10px] text-tg-hint">Revenus</div>
              <div className="text-xs font-bold text-tg">{formatPriceCompact(stats.totalRevenue)}</div>
            </div>
            <div>
              <div className="text-[10px] text-tg-hint">Profit</div>
              <ProfitIndicator profit={stats.totalProfit} profitPct={stats.averageRoi} size="sm" />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar">
        {TABS.map(tab => (
          <button key={tab.key ?? 'all'}
            onClick={() => { hapticFeedback('light'); setActiveTab(tab.key); }}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap flex-shrink-0 ${
              activeTab === tab.key ? 'bg-tg-button text-tg-button' : 'bg-tg-secondary text-tg-hint'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-center text-tg-hint py-12 text-sm">Chargement...</div>}

      {!isLoading && (!purchases || purchases.length === 0) && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🛒</div>
          <h2 className="text-base font-semibold text-tg mb-1">Aucun achat</h2>
          <p className="text-xs text-tg-hint mb-5">Ajoute tes achats pour suivre ta rentabilite</p>
          <button onClick={() => { hapticFeedback('medium'); navigate('/purchases/new'); }}
            className="bg-tg-button text-tg-button px-5 py-2.5 rounded-xl text-sm font-medium active:scale-95 transition-transform">
            Ajouter un achat
          </button>
        </div>
      )}

      <div className="space-y-2">
        {purchases?.map(p => (
          <div key={p.id} className="bg-tg-section rounded-xl border border-[var(--card-border)] overflow-hidden">
            <div className="flex gap-2.5 p-2.5">
              {p.photo_url ? (
                <img src={p.photo_url} alt="" className="w-14 h-14 object-cover rounded-lg flex-shrink-0" loading="lazy" />
              ) : (
                <div className="w-14 h-14 bg-tg-secondary rounded-lg flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <h3 className="font-medium text-xs text-tg truncate">{p.title}</h3>
                  <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium ${statusColors[p.status] ?? ''}`}>
                    {statusLabels[p.status] ?? p.status}
                  </span>
                </div>
                {p.brand_name && <div className="text-[10px] text-tg-hint mt-0.5">{p.brand_name}</div>}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-tg">{formatPriceCompact(p.total_cost)}</span>
                  {p.is_sold && p.sold_price && <span className="text-xs text-tg-hint">→ {formatPriceCompact(p.sold_price)}</span>}
                </div>
                {p.profit && <ProfitIndicator profit={p.profit} profitPct={p.profit_pct} size="sm" />}
              </div>
            </div>
            <div className="flex border-t border-[var(--card-border)]">
              <button onClick={() => { hapticFeedback('light'); navigate(`/purchases/${p.id}`); }}
                className="flex-1 py-1.5 text-[11px] text-tg-link active:bg-tg-secondary">Modifier</button>
              <div className="w-px bg-[var(--card-border)]" />
              <button onClick={() => { if (confirm(`Supprimer ?`)) { hapticNotification('warning'); deletePurchase.mutate(p.id); }}}
                className="flex-1 py-1.5 text-[11px] text-tg-destructive active:bg-tg-secondary">Supprimer</button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => { hapticFeedback('medium'); navigate('/purchases/new'); }}
        className="fixed bottom-20 right-4 w-12 h-12 bg-tg-button text-tg-button rounded-full shadow-lg flex items-center justify-center text-xl active:scale-90 transition-transform glow-purple z-50">
        +
      </button>
    </div>
  );
}
