import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatPriceCompact } from '../utils/formatters.js';
import api from '../api/client.js';

interface OverviewData {
  totalArticlesDetected: number;
  totalPepites: number;
  articlesToday: number;
  pepitesToday: number;
  purchaseStats: { totalInvested: number; totalRevenue: number; totalProfit: number; averageRoi: number; totalPurchases: number; totalSold: number; avgTimeToSellDays: number };
}

interface ProfitTimeline { date: string; profit: number; cumulative: number; }
interface TopBrand { brand: string; count: number; totalProfit: number; }

const PERIODS = [
  { key: '7d', label: '7j' }, { key: '30d', label: '30j' },
  { key: '90d', label: '90j' }, { key: 'all', label: 'Tout' },
];

export default function Analytics() {
  const [period, setPeriod] = useState('30d');

  const { data: overview } = useQuery<OverviewData>({ queryKey: ['analytics', 'overview'], queryFn: async () => (await api.get('/analytics/overview')).data.data });
  const { data: timeline } = useQuery<ProfitTimeline[]>({ queryKey: ['analytics', 'timeline', period], queryFn: async () => (await api.get(`/analytics/profit-timeline?period=${period}`)).data.data });
  const { data: topBrands } = useQuery<TopBrand[]>({ queryKey: ['analytics', 'top-brands'], queryFn: async () => (await api.get('/analytics/top-brands')).data.data });

  const s = overview?.purchaseStats;

  return (
    <div className="px-4 pt-4 pb-24 max-w-full overflow-hidden">
      <h1 className="text-lg font-bold text-tg mb-3">📊 Analytics</h1>

      <div className="flex gap-1.5 mb-4">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`px-3 py-1 rounded-full text-[11px] font-medium ${period === p.key ? 'bg-tg-button text-tg-button' : 'bg-tg-secondary text-tg-hint'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[
          { label: 'Investi', value: s ? formatPriceCompact(s.totalInvested) : '-', icon: '💸' },
          { label: 'Revenus', value: s ? formatPriceCompact(s.totalRevenue) : '-', icon: '💰' },
          { label: 'Profit', value: s ? formatPriceCompact(s.totalProfit) : '-', icon: '📈', color: s && s.totalProfit >= 0 ? 'var(--success-color)' : 'var(--destructive-text-color)' },
          { label: 'ROI', value: s ? `${s.averageRoi.toFixed(1)}%` : '-', icon: '📊', color: s && s.averageRoi >= 0 ? 'var(--success-color)' : 'var(--destructive-text-color)' },
        ].map(k => (
          <div key={k.label} className="bg-tg-section rounded-xl border border-[var(--card-border)] p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-tg-hint">{k.label}</span>
              <span>{k.icon}</span>
            </div>
            <div className="text-base font-bold mt-1" style={{ color: k.color ?? 'var(--text-color)' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Detection */}
      {overview && (
        <div className="bg-tg-section rounded-xl border border-[var(--card-border)] p-3 mb-3">
          <div className="text-[10px] font-semibold text-tg-section-header uppercase mb-2">Detection</div>
          <div className="grid grid-cols-2 gap-3">
            <div><div className="text-[10px] text-tg-hint">Aujourd'hui</div><div className="text-sm font-bold text-tg">{overview.articlesToday} articles</div></div>
            <div><div className="text-[10px] text-tg-hint">Pepites</div><div className="text-sm font-bold" style={{ color: 'var(--pepite-color)' }}>{overview.pepitesToday} 💎</div></div>
            <div><div className="text-[10px] text-tg-hint">Total articles</div><div className="text-sm font-bold text-tg">{overview.totalArticlesDetected}</div></div>
            <div><div className="text-[10px] text-tg-hint">Total pepites</div><div className="text-sm font-bold text-tg">{overview.totalPepites}</div></div>
          </div>
        </div>
      )}

      {/* Timeline */}
      {timeline && timeline.length > 0 && (
        <div className="bg-tg-section rounded-xl border border-[var(--card-border)] p-3 mb-3">
          <div className="text-[10px] font-semibold text-tg-section-header uppercase mb-2">Profit cumule</div>
          <div className="space-y-1.5">
            {timeline.slice(-8).map(e => (
              <div key={e.date} className="flex items-center justify-between text-[11px]">
                <span className="text-tg-hint">{e.date}</span>
                <div className="flex gap-3">
                  <span className={e.profit >= 0 ? 'text-green-400' : 'text-red-400'}>{e.profit >= 0 ? '+' : ''}{formatPriceCompact(e.profit)}</span>
                  <span className="text-tg font-bold w-16 text-right">{formatPriceCompact(e.cumulative)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top brands */}
      {topBrands && topBrands.length > 0 && (
        <div className="bg-tg-section rounded-xl border border-[var(--card-border)] p-3">
          <div className="text-[10px] font-semibold text-tg-section-header uppercase mb-2">Top marques</div>
          {topBrands.slice(0, 5).map((b, i) => (
            <div key={b.brand} className="flex items-center justify-between py-1 text-[11px]">
              <span className="text-tg">{i + 1}. {b.brand} <span className="text-tg-hint">({b.count})</span></span>
              <span className={b.totalProfit >= 0 ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>{b.totalProfit >= 0 ? '+' : ''}{formatPriceCompact(b.totalProfit)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
