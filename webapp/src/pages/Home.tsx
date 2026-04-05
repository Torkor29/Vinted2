import { useNavigate } from 'react-router-dom';
import {
  Settings,
  SlidersHorizontal,
  Package,
  ShoppingBag,
  BarChart3,
  Gem,
  ChevronRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useFilters } from '../hooks/useFilters.js';
import { useRecentArticles } from '../hooks/useArticles.js';
import { usePurchaseStats } from '../hooks/usePurchases.js';
import ArticleCard from '../components/ArticleCard.js';
import { formatPriceCompact } from '../utils/formatters.js';
import { hapticFeedback } from '../utils/telegram.js';

export default function Home() {
  const navigate = useNavigate();
  const { data: filters } = useFilters();
  const { data: recentArticles } = useRecentArticles();
  const { data: stats } = usePurchaseStats();

  const activeFilters  = filters?.filter(f => f.is_active).length ?? 0;
  const totalFilters   = filters?.length ?? 0;
  const pepitesCount   = recentArticles?.filter(a => a.is_pepite).length ?? 0;
  const articlesCount  = recentArticles?.length ?? 0;

  const profit         = stats?.totalProfit ?? 0;
  const profitPositive = profit >= 0;

  const goTo = (path: string) => {
    hapticFeedback('light');
    navigate(path);
  };

  return (
    <div className="flex flex-col min-h-screen pb-24" style={{ backgroundColor: 'var(--bg-color)' }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="px-4 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-color)' }}>
            Vinted Bot
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--hint-color)' }}>
            Surveillance en temps réel
          </p>
        </div>
        <button
          onClick={() => goTo('/settings')}
          className="w-9 h-9 rounded-xl flex items-center justify-center border transition-transform active:scale-90"
          style={{ backgroundColor: 'var(--section-bg-color)', borderColor: 'var(--card-border)' }}
        >
          <Settings size={16} style={{ color: 'var(--hint-color)' }} />
        </button>
      </div>

      {/* ── Hero – Profit card ───────────────────────────────────── */}
      <div className="px-4 mb-4">
        <div
          className="rounded-2xl p-5 border"
          style={{
            background: 'linear-gradient(135deg, var(--section-bg-color) 0%, var(--secondary-bg-color) 100%)',
            borderColor: profitPositive ? 'rgba(0, 214, 143, 0.18)' : 'rgba(229, 87, 87, 0.18)',
          }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-2"
            style={{ color: 'var(--hint-color)' }}
          >
            Profit total
          </p>

          <div className="flex items-center gap-3 mb-3">
            <span
              className="text-4xl font-bold tracking-tight"
              style={{ color: profitPositive ? 'var(--success-color)' : 'var(--destructive-text-color)' }}
            >
              {profitPositive ? '+' : ''}{profit.toFixed(2)}&nbsp;€
            </span>
            {profitPositive
              ? <TrendingUp size={22} style={{ color: 'var(--success-color)' }} />
              : <TrendingDown size={22} style={{ color: 'var(--destructive-text-color)' }} />
            }
          </div>

          {stats && (
            <div
              className="grid grid-cols-3 gap-3 pt-3"
              style={{ borderTop: '1px solid var(--card-border)' }}
            >
              {[
                { label: 'Investi',  value: formatPriceCompact(stats.totalInvested), color: 'var(--text-color)' },
                { label: 'Revenus',  value: formatPriceCompact(stats.totalRevenue),  color: 'var(--text-color)' },
                {
                  label: 'ROI',
                  value: `${(stats.averageRoi ?? 0).toFixed(1)}%`,
                  color: (stats.averageRoi ?? 0) >= 0 ? 'var(--success-color)' : 'var(--destructive-text-color)',
                },
              ].map(item => (
                <div key={item.label}>
                  <p className="text-[9px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--hint-color)' }}>
                    {item.label}
                  </p>
                  <p className="text-sm font-bold" style={{ color: item.color }}>{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Stats row ────────────────────────────────────────────── */}
      <div className="px-4 grid grid-cols-3 gap-2 mb-4">
        {[
          {
            value: `${activeFilters}/${totalFilters}`,
            label: 'Filtres actifs',
            path: '/filters',
            Icon: SlidersHorizontal,
            highlight: false,
          },
          {
            value: `${articlesCount}`,
            label: 'Articles',
            path: '/feed',
            Icon: Package,
            highlight: false,
          },
          {
            value: `${pepitesCount}`,
            label: 'Pépites',
            path: '/feed?pepites=true',
            Icon: Gem,
            highlight: pepitesCount > 0,
          },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => goTo(s.path)}
            className="rounded-xl p-3 text-center border transition-transform active:scale-95"
            style={{
              backgroundColor: 'var(--section-bg-color)',
              borderColor: s.highlight ? 'rgba(255, 211, 42, 0.25)' : 'var(--card-border)',
              boxShadow: s.highlight ? '0 0 16px rgba(255, 211, 42, 0.1)' : 'none',
            }}
          >
            <s.Icon
              size={16}
              className="mx-auto mb-1.5"
              style={{ color: s.highlight ? 'var(--pepite-color)' : 'var(--hint-color)' }}
            />
            <div
              className="text-base font-bold leading-none"
              style={{ color: s.highlight ? 'var(--pepite-color)' : 'var(--text-color)' }}
            >
              {s.value}
            </div>
            <div className="text-[9px] mt-1 leading-none" style={{ color: 'var(--hint-color)' }}>
              {s.label}
            </div>
          </button>
        ))}
      </div>

      {/* ── Quick-action grid ────────────────────────────────────── */}
      <div className="px-4 grid grid-cols-2 gap-2 mb-5">
        {[
          {
            label: 'Mes Filtres',
            sub: `${totalFilters} configuré${totalFilters !== 1 ? 's' : ''}`,
            Icon: SlidersHorizontal,
            path: '/filters',
            accent: true,
          },
          {
            label: 'Feed Live',
            sub: 'Articles détectés',
            Icon: Package,
            path: '/feed',
            accent: false,
          },
          {
            label: 'Achats',
            sub: 'Suivi financier',
            Icon: ShoppingBag,
            path: '/purchases',
            accent: false,
          },
          {
            label: 'Analytics',
            sub: 'Statistiques',
            Icon: BarChart3,
            path: '/analytics',
            accent: false,
          },
        ].map(item => (
          <button
            key={item.path}
            onClick={() => goTo(item.path)}
            className="rounded-xl p-4 text-left border transition-transform active:scale-95"
            style={{
              backgroundColor: 'var(--section-bg-color)',
              borderColor: item.accent ? 'rgba(108, 92, 231, 0.3)' : 'var(--card-border)',
              boxShadow: item.accent ? '0 0 20px rgba(108, 92, 231, 0.12)' : 'none',
            }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
              style={{
                backgroundColor: item.accent ? 'rgba(108, 92, 231, 0.15)' : 'var(--secondary-bg-color)',
              }}
            >
              <item.Icon
                size={18}
                style={{ color: item.accent ? 'var(--button-color)' : 'var(--hint-color)' }}
              />
            </div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-color)' }}>
              {item.label}
            </div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--hint-color)' }}>
              {item.sub}
            </div>
          </button>
        ))}
      </div>

      {/* ── Recent articles ──────────────────────────────────────── */}
      {recentArticles && recentArticles.length > 0 && (
        <div className="px-4 flex-1">
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--hint-color)' }}
            >
              Récents
            </span>
            <button
              onClick={() => goTo('/feed')}
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: 'var(--accent-text-color)' }}
            >
              Voir tout <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {recentArticles.slice(0, 3).map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
