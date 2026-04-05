import { useNavigate } from 'react-router-dom';
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

  const activeFilters = filters?.filter(f => f.is_active).length ?? 0;
  const pepitesCount = recentArticles?.filter(a => a.is_pepite).length ?? 0;

  const goTo = (path: string) => {
    hapticFeedback('light');
    navigate(path);
  };

  return (
    <div className="flex flex-col min-h-screen pb-20">
      {/* Header */}
      <div className="px-4 pt-5 pb-4" style={{ background: 'linear-gradient(135deg, var(--header-bg-color) 0%, var(--bg-color) 100%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-tg">Vinted Bot</h1>
            <p className="text-xs text-tg-hint mt-0.5">Surveillance en temps réel</p>
          </div>
          <button
            onClick={() => goTo('/settings')}
            className="w-9 h-9 bg-tg-section rounded-xl flex items-center justify-center text-base border border-[var(--card-border)] active:scale-90 transition-transform"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-4 grid grid-cols-4 gap-2 mb-4">
        {[
          { value: `${activeFilters}`, label: 'Filtres', emoji: '🔍', path: '/filters' },
          { value: `${recentArticles?.length ?? 0}`, label: 'Articles', emoji: '📦', path: '/feed' },
          { value: `${pepitesCount}`, label: 'Pépites', emoji: '💎', path: '/feed?pepites=true' },
          { value: stats ? `${stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit.toFixed(0)}€` : '0€', label: 'Profit', emoji: '💰', path: '/analytics' },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => goTo(s.path)}
            className="bg-tg-section rounded-xl p-2.5 text-center border border-[var(--card-border)] active:scale-[0.95] transition-transform"
          >
            <div className="text-base leading-none">{s.emoji}</div>
            <div className="text-sm font-bold text-tg mt-1 leading-none">{s.value}</div>
            <div className="text-[9px] text-tg-hint mt-0.5 leading-none">{s.label}</div>
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <div className="px-4 grid grid-cols-2 gap-2 mb-4">
        {[
          { label: 'Mes Filtres', sub: `${filters?.length ?? 0} configurés`, icon: '🔍', path: '/filters', glow: 'glow-purple', accent: true },
          { label: 'Feed Live', sub: 'Articles détectés', icon: '📦', path: '/feed', glow: '', accent: false },
          { label: 'Achats', sub: 'Suivi financier', icon: '🛒', path: '/purchases', glow: '', accent: false },
          { label: 'Analytics', sub: 'Statistiques', icon: '📊', path: '/analytics', glow: '', accent: false },
        ].map(item => (
          <button
            key={item.path}
            onClick={() => goTo(item.path)}
            className={`bg-tg-section rounded-xl p-3.5 text-left border border-[var(--card-border)] active:scale-[0.97] transition-transform ${item.glow}`}
          >
            <span className="text-2xl leading-none">{item.icon}</span>
            <div className="text-sm font-semibold text-tg mt-2">{item.label}</div>
            <div className="text-[10px] text-tg-hint mt-0.5">{item.sub}</div>
          </button>
        ))}
      </div>

      {/* Recent articles */}
      {recentArticles && recentArticles.length > 0 && (
        <div className="px-4 flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-tg-section-header uppercase tracking-wide">Derniers articles</span>
            <button onClick={() => goTo('/feed')} className="text-xs text-tg-link">Voir tout →</button>
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
