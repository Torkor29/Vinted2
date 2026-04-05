import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, TrendingDown, Package, Gem, DollarSign, Percent } from 'lucide-react';
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

interface ProfitTimeline { date: string; profit: number; cumulative: number; }
interface TopBrand { brand: string; count: number; totalProfit: number; }

const PERIODS = [
  { key: '7d',  label: '7j'   },
  { key: '30d', label: '30j'  },
  { key: '90d', label: '90j'  },
  { key: 'all', label: 'Tout' },
];

export default function Analytics() {
  const [period, setPeriod] = useState('30d');

  const { data: overview } = useQuery<OverviewData>({
    queryKey: ['analytics', 'overview'],
    queryFn: async () => (await api.get('/analytics/overview')).data.data,
  });
  const { data: timeline } = useQuery<ProfitTimeline[]>({
    queryKey: ['analytics', 'timeline', period],
    queryFn: async () => (await api.get(`/analytics/profit-timeline?period=${period}`)).data.data,
  });
  const { data: topBrands } = useQuery<TopBrand[]>({
    queryKey: ['analytics', 'top-brands'],
    queryFn: async () => (await api.get('/analytics/top-brands')).data.data,
  });

  const s = overview?.purchaseStats;

  const kpis = [
    {
      label: 'Investi',
      value: s ? formatPriceCompact(s.totalInvested) : '—',
      Icon: DollarSign,
      color: 'var(--text-color)',
      iconBg: 'rgba(108, 92, 231, 0.12)',
      iconColor: 'var(--button-color)',
    },
    {
      label: 'Revenus',
      value: s ? formatPriceCompact(s.totalRevenue) : '—',
      Icon: TrendingUp,
      color: 'var(--text-color)',
      iconBg: 'rgba(0, 214, 143, 0.12)',
      iconColor: 'var(--success-color)',
    },
    {
      label: 'Profit',
      value: s ? formatPriceCompact(s.totalProfit) : '—',
      Icon: s && s.totalProfit >= 0 ? TrendingUp : TrendingDown,
      color: s && s.totalProfit >= 0 ? 'var(--success-color)' : 'var(--destructive-text-color)',
      iconBg: s && s.totalProfit >= 0 ? 'rgba(0, 214, 143, 0.12)' : 'rgba(229, 87, 87, 0.12)',
      iconColor: s && s.totalProfit >= 0 ? 'var(--success-color)' : 'var(--destructive-text-color)',
    },
    {
      label: 'ROI',
      value: s ? `${s.averageRoi.toFixed(1)}%` : '—',
      Icon: Percent,
      color: s && s.averageRoi >= 0 ? 'var(--success-color)' : 'var(--destructive-text-color)',
      iconBg: s && s.averageRoi >= 0 ? 'rgba(0, 214, 143, 0.12)' : 'rgba(229, 87, 87, 0.12)',
      iconColor: s && s.averageRoi >= 0 ? 'var(--success-color)' : 'var(--destructive-text-color)',
    },
  ];

  return (
    <div className="px-4 pt-4 pb-24 max-w-full overflow-hidden">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 mb-4">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: 'rgba(108, 92, 231, 0.15)' }}
        >
          <BarChart3 size={16} style={{ color: 'var(--button-color)' }} />
        </div>
        <h1 className="text-base font-bold" style={{ color: 'var(--text-color)' }}>
          Analytics
        </h1>
      </div>

      {/* ── Period selector ─────────────────────────────────────── */}
      <div className="flex gap-1.5 mb-5">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors"
            style={{
              backgroundColor: period === p.key ? 'var(--button-color)' : 'var(--secondary-bg-color)',
              color: period === p.key ? '#fff' : 'var(--hint-color)',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── KPI grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {kpis.map(k => (
          <div
            key={k.label}
            className="rounded-xl border p-3.5"
            style={{ backgroundColor: 'var(--section-bg-color)', borderColor: 'var(--card-border)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wide font-medium" style={{ color: 'var(--hint-color)' }}>
                {k.label}
              </span>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: k.iconBg }}
              >
                <k.Icon size={14} style={{ color: k.iconColor }} />
              </div>
            </div>
            <div className="text-lg font-bold" style={{ color: k.color }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Detection section ───────────────────────────────────── */}
      {overview && (
        <div
          className="rounded-xl border p-4 mb-4"
          style={{ backgroundColor: 'var(--section-bg-color)', borderColor: 'var(--card-border)' }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'var(--hint-color)' }}
          >
            Détection
          </p>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(108, 92, 231, 0.12)' }}
              >
                <Package size={13} style={{ color: 'var(--button-color)' }} />
              </div>
              <div>
                <p className="text-[9px]" style={{ color: 'var(--hint-color)' }}>Aujourd'hui</p>
                <p className="text-sm font-bold" style={{ color: 'var(--text-color)' }}>
                  {overview.articlesToday}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'var(--pepite-bg)' }}
              >
                <Gem size={13} style={{ color: 'var(--pepite-color)' }} />
              </div>
              <div>
                <p className="text-[9px]" style={{ color: 'var(--hint-color)' }}>Pépites auj.</p>
                <p className="text-sm font-bold" style={{ color: 'var(--pepite-color)' }}>
                  {overview.pepitesToday}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(108, 92, 231, 0.08)' }}
              >
                <Package size={13} style={{ color: 'var(--hint-color)' }} />
              </div>
              <div>
                <p className="text-[9px]" style={{ color: 'var(--hint-color)' }}>Total articles</p>
                <p className="text-sm font-bold" style={{ color: 'var(--text-color)' }}>
                  {overview.totalArticlesDetected}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(255, 211, 42, 0.08)' }}
              >
                <Gem size={13} style={{ color: 'var(--hint-color)' }} />
              </div>
              <div>
                <p className="text-[9px]" style={{ color: 'var(--hint-color)' }}>Total pépites</p>
                <p className="text-sm font-bold" style={{ color: 'var(--text-color)' }}>
                  {overview.totalPepites}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Profit timeline ─────────────────────────────────────── */}
      {timeline && timeline.length > 0 && (
        <div
          className="rounded-xl border p-4 mb-4"
          style={{ backgroundColor: 'var(--section-bg-color)', borderColor: 'var(--card-border)' }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'var(--hint-color)' }}
          >
            Profit cumulé
          </p>
          <div className="space-y-2">
            {timeline.slice(-8).map(e => (
              <div
                key={e.date}
                className="flex items-center justify-between py-1"
                style={{ borderBottom: '1px solid var(--card-border)' }}
              >
                <span className="text-[11px]" style={{ color: 'var(--hint-color)' }}>
                  {e.date}
                </span>
                <div className="flex items-center gap-3">
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: e.profit >= 0 ? 'var(--success-color)' : 'var(--destructive-text-color)' }}
                  >
                    {e.profit >= 0 ? '+' : ''}{formatPriceCompact(e.profit)}
                  </span>
                  <span
                    className="text-[11px] font-bold w-14 text-right"
                    style={{ color: 'var(--text-color)' }}
                  >
                    {formatPriceCompact(e.cumulative)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Top brands ──────────────────────────────────────────── */}
      {topBrands && topBrands.length > 0 && (
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--section-bg-color)', borderColor: 'var(--card-border)' }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'var(--hint-color)' }}
          >
            Top marques
          </p>
          <div className="space-y-2">
            {topBrands.slice(0, 5).map((b, i) => (
              <div key={b.brand} className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-bold w-4 text-center"
                    style={{ color: i === 0 ? 'var(--pepite-color)' : 'var(--hint-color)' }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[11px] font-medium" style={{ color: 'var(--text-color)' }}>
                    {b.brand}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--hint-color)' }}>
                    ({b.count})
                  </span>
                </div>
                <span
                  className="text-[11px] font-semibold"
                  style={{
                    color: b.totalProfit >= 0 ? 'var(--success-color)' : 'var(--destructive-text-color)',
                  }}
                >
                  {b.totalProfit >= 0 ? '+' : ''}{formatPriceCompact(b.totalProfit)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
