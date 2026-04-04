import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePurchases, usePurchaseStats, useDeletePurchase } from '../hooks/usePurchases.js';
import { useBackButton } from '../hooks/useTelegram.js';
import { formatPriceCompact } from '../utils/formatters.js';
import ProfitIndicator from '../components/ProfitIndicator.js';
import { hapticFeedback, hapticNotification } from '../utils/telegram.js';

const TABS = [
  { key: undefined, label: 'Tous' },
  { key: 'purchased', label: 'En stock' },
  { key: 'listed', label: 'En vente' },
  { key: 'sold', label: 'Vendus' },
  { key: 'returned', label: 'Retournes' },
] as const;

export default function Purchases() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);

  const { data: purchases, isLoading } = usePurchases(activeTab);
  const { data: stats } = usePurchaseStats();
  const deletePurchase = useDeletePurchase();

  const handleBack = useCallback(() => navigate('/'), [navigate]);
  useBackButton(handleBack);

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Supprimer "${title}" ?`)) {
      hapticNotification('warning');
      deletePurchase.mutate(id);
    }
  };

  const statusColors: Record<string, string> = {
    purchased: 'bg-blue-100 text-blue-700',
    listed: 'bg-orange-100 text-orange-700',
    sold: 'bg-green-100 text-green-700',
    returned: 'bg-red-100 text-red-700',
  };

  const statusLabels: Record<string, string> = {
    purchased: 'En stock',
    listed: 'En vente',
    sold: 'Vendu',
    returned: 'Retourne',
  };

  return (
    <div className="p-4 pb-24">
      <h1 className="text-xl font-bold text-tg mb-4">Achats / Reventes</h1>

      {/* Stats summary */}
      {stats && (
        <div className="bg-tg-section rounded-xl p-4 mb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-tg-hint">Investi</div>
              <div className="text-sm font-bold text-tg">{formatPriceCompact(stats.totalInvested)}</div>
            </div>
            <div>
              <div className="text-xs text-tg-hint">Revenus</div>
              <div className="text-sm font-bold text-tg">{formatPriceCompact(stats.totalRevenue)}</div>
            </div>
            <div>
              <div className="text-xs text-tg-hint">Profit</div>
              <ProfitIndicator profit={stats.totalProfit} profitPct={stats.averageRoi} size="sm" />
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-3 mb-4 -mx-4 px-4">
        {TABS.map(tab => (
          <button
            key={tab.key ?? 'all'}
            onClick={() => { hapticFeedback('light'); setActiveTab(tab.key); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-tg-button text-tg-button'
                : 'bg-tg-secondary text-tg-hint'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading && <div className="text-center text-tg-hint py-12">Chargement...</div>}

      {!isLoading && (!purchases || purchases.length === 0) && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🛒</div>
          <h2 className="text-lg font-medium text-tg mb-2">Aucun achat</h2>
          <p className="text-sm text-tg-hint mb-6">
            Ajoute tes achats pour suivre ta rentabilite
          </p>
          <button
            onClick={() => { hapticFeedback('medium'); navigate('/purchases/new'); }}
            className="bg-tg-button text-tg-button px-6 py-3 rounded-xl font-medium"
          >
            Ajouter un achat
          </button>
        </div>
      )}

      <div className="space-y-3">
        {purchases?.map(purchase => (
          <div key={purchase.id} className="bg-tg-section rounded-xl overflow-hidden">
            <div className="flex gap-3 p-3">
              {purchase.photo_url ? (
                <img src={purchase.photo_url} alt="" className="w-16 h-16 object-cover rounded-lg flex-shrink-0" loading="lazy" />
              ) : (
                <div className="w-16 h-16 bg-tg-secondary rounded-lg flex-shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-sm text-tg truncate">{purchase.title}</h3>
                  <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[purchase.status] ?? ''}`}>
                    {statusLabels[purchase.status] ?? purchase.status}
                  </span>
                </div>

                {purchase.brand_name && (
                  <div className="text-xs text-tg-hint mt-0.5">{purchase.brand_name}</div>
                )}

                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-tg">
                    Achat: {formatPriceCompact(purchase.total_cost)}
                  </span>
                  {purchase.is_sold && purchase.sold_price && (
                    <span className="text-sm text-tg">
                      Vente: {formatPriceCompact(purchase.sold_price)}
                    </span>
                  )}
                </div>

                {purchase.profit && (
                  <ProfitIndicator profit={purchase.profit} profitPct={purchase.profit_pct} size="sm" />
                )}
              </div>
            </div>

            <div className="flex border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => { hapticFeedback('light'); navigate(`/purchases/${purchase.id}`); }}
                className="flex-1 py-2 text-xs text-tg-link"
              >
                Modifier
              </button>
              <button
                onClick={() => handleDelete(purchase.id, purchase.title)}
                className="flex-1 py-2 text-xs text-tg-destructive border-l border-gray-100 dark:border-gray-800"
              >
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* FAB */}
      <button
        onClick={() => { hapticFeedback('medium'); navigate('/purchases/new'); }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-tg-button text-tg-button rounded-full shadow-lg flex items-center justify-center text-2xl hover:scale-105 transition-transform"
      >
        +
      </button>
    </div>
  );
}
