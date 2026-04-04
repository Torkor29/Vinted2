import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useBackButton } from '../hooks/useTelegram.js';
import { usePurchaseStats } from '../hooks/usePurchases.js';
import StatsCard from '../components/StatsCard.js';
import { formatPriceCompact } from '../utils/formatters.js';
import api from '../api/client.js';

interface OverviewData {
  totalArticlesDetected: number;
  totalPepites: number;
  articlesToday: number;
  pepitesToday: number;
  purchaseStats: {
    totalInvested: number;
    totalRevenue: number;
    totalProfit: number;
    averageRoi: number;
    totalPurchases: number;
    totalSold: number;
    avgTimeToSellDays: number;
  };
}

interface ProfitTimeline {
  date: string;
  profit: number;
  cumulative: number;
}

interface TopBrand {
  brand: string;
  count: number;
  totalProfit: number;
  avgProfit: number;
}

const PERIODS = [
  { key: '7d', label: '7j' },
  { key: '30d', label: '30j' },
  { key: '90d', label: '90j' },
  { key: 'all', label: 'Tout' },
];

export default function Analytics() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('30d');

  const handleBack = useCallback(() => navigate('/'), [navigate]);
  useBackButton(handleBack);

  const { data: overview } = useQuery<OverviewData>({
    queryKey: ['analytics', 'overview'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/overview');
      return data.data;
    },
  });

  const { data: timeline } = useQuery<ProfitTimeline[]>({
    queryKey: ['analytics', 'timeline', period],
    queryFn: async () => {
      const { data } = await api.get(`/analytics/profit-timeline?period=${period}`);
      return data.data;
    },
  });

  const { data: topBrands } = useQuery<TopBrand[]>({
    queryKey: ['analytics', 'top-brands'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/top-brands');
      return data.data;
    },
  });

  const stats = overview?.purchaseStats;

  return (
    <div className="p-4 pb-24 space-y-6">
      <h1 className="text-xl font-bold text-tg">Analytics</h1>

      {/* Period selector */}
      <div className="flex gap-2">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              period === p.key
                ? 'bg-tg-button text-tg-button'
                : 'bg-tg-secondary text-tg-hint'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatsCard
          label="Total investi"
          value={stats ? formatPriceCompact(stats.totalInvested) : '-'}
          icon="💸"
        />
        <StatsCard
          label="Total revenus"
          value={stats ? formatPriceCompact(stats.totalRevenue) : '-'}
          icon="💰"
        />
        <StatsCard
          label="Profit net"
          value={stats ? formatPriceCompact(stats.totalProfit) : '-'}
          trend={stats && stats.totalProfit > 0 ? 'up' : stats && stats.totalProfit < 0 ? 'down' : 'neutral'}
          icon="📈"
        />
        <StatsCard
          label="ROI moyen"
          value={stats ? `${stats.averageRoi.toFixed(1)}%` : '-'}
          trend={stats && stats.averageRoi > 0 ? 'up' : 'neutral'}
          icon="📊"
        />
        <StatsCard
          label="Articles achetes"
          value={stats?.totalPurchases ?? 0}
          icon="🛒"
        />
        <StatsCard
          label="Articles vendus"
          value={stats?.totalSold ?? 0}
          icon="✅"
        />
      </div>

      {stats && stats.avgTimeToSellDays > 0 && (
        <StatsCard
          label="Temps moyen de vente"
          value={`${stats.avgTimeToSellDays.toFixed(1)} jours`}
          icon="⏱️"
        />
      )}

      {/* Detection stats */}
      {overview && (
        <div className="bg-tg-section rounded-xl p-4">
          <h2 className="text-sm font-semibold text-tg-section-header mb-3">Detection</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-tg-hint">Articles aujourd'hui</div>
              <div className="text-lg font-bold text-tg">{overview.articlesToday}</div>
            </div>
            <div>
              <div className="text-xs text-tg-hint">Pepites aujourd'hui</div>
              <div className="text-lg font-bold text-tg">{overview.pepitesToday}</div>
            </div>
            <div>
              <div className="text-xs text-tg-hint">Total articles</div>
              <div className="text-lg font-bold text-tg">{overview.totalArticlesDetected}</div>
            </div>
            <div>
              <div className="text-xs text-tg-hint">Total pepites</div>
              <div className="text-lg font-bold text-tg">{overview.totalPepites}</div>
            </div>
          </div>
        </div>
      )}

      {/* Profit timeline */}
      {timeline && timeline.length > 0 && (
        <div className="bg-tg-section rounded-xl p-4">
          <h2 className="text-sm font-semibold text-tg-section-header mb-3">Profit cumule</h2>
          <div className="space-y-2">
            {timeline.slice(-10).map(entry => (
              <div key={entry.date} className="flex items-center justify-between">
                <span className="text-xs text-tg-hint">{entry.date}</span>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${entry.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {entry.profit >= 0 ? '+' : ''}{formatPriceCompact(entry.profit)}
                  </span>
                  <span className="text-xs text-tg font-bold w-20 text-right">
                    {formatPriceCompact(entry.cumulative)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top brands */}
      {topBrands && topBrands.length > 0 && (
        <div className="bg-tg-section rounded-xl p-4">
          <h2 className="text-sm font-semibold text-tg-section-header mb-3">Top marques par profit</h2>
          <div className="space-y-2">
            {topBrands.map((brand, i) => (
              <div key={brand.brand} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-tg-hint w-5">{i + 1}.</span>
                  <span className="text-sm text-tg">{brand.brand}</span>
                  <span className="text-xs text-tg-hint">({brand.count})</span>
                </div>
                <span className={`text-sm font-medium ${brand.totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {brand.totalProfit >= 0 ? '+' : ''}{formatPriceCompact(brand.totalProfit)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
