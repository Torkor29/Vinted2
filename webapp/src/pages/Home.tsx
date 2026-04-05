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
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold text-tg">Vinted Bot</h1>
        <p className="text-xs text-tg-hint mt-0.5">Surveillance en temps reel</p>
      </div>

      {/* Stats row */}
      <div className="px-4 grid grid-cols-4 gap-2 mb-4">
        {[
          { value: `${activeFilters}`, label: 'Filtres', emoji: '🔍' },
          { value: `${recentArticles?.length ?? 0}`, label: 'Articles', emoji: '📦' },
          { value: `${pepitesCount}`, label: 'Pepites', emoji: '💎' },
          { value: stats ? `${stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit.toFixed(0)}` : '0', label: 'Profit', emoji: '💰' },
        ].map(s => (
          <div key={s.label} className="bg-tg-section rounded-xl p-2.5 text-center border border-[var(--card-border)]">
            <div className="text-base">{s.emoji}</div>
            <div className="text-sm font-bold text-tg mt-0.5">{s.value}</div>
            <div className="text-[10px] text-tg-hint">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="px-4 grid grid-cols-2 gap-2 mb-4">
        {[
          { label: 'Mes Filtres', sub: `${filters?.length ?? 0} configures`, icon: '🔍', path: '/filters', glow: 'glow-purple' },
          { label: 'Feed Live', sub: 'Articles detectes', icon: '📦', path: '/feed', glow: '' },
          { label: 'Achats', sub: 'Suivi financier', icon: '🛒', path: '/purchases', glow: '' },
          { label: 'Analytics', sub: 'Statistiques', icon: '📊', path: '/analytics', glow: '' },
        ].map(item => (
          <button
            key={item.path}
            onClick={() => goTo(item.path)}
            className={`bg-tg-section rounded-xl p-3 text-left border border-[var(--card-border)] active:scale-[0.97] transition-transform ${item.glow}`}
          >
            <span className="text-xl">{item.icon}</span>
            <div className="text-sm font-semibold text-tg mt-1.5">{item.label}</div>
            <div className="text-[10px] text-tg-hint">{item.sub}</div>
          </button>
        ))}
      </div>

      {/* Recent articles */}
      {recentArticles && recentArticles.length > 0 && (
        <div className="px-4 flex-1 mb-20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-tg-section-header uppercase">Derniers articles</span>
            <button onClick={() => goTo('/feed')} className="text-xs text-tg-link">Voir tout</button>
          </div>
          <div className="space-y-2">
            {recentArticles.slice(0, 3).map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-tg-section border-t border-[var(--card-border)] px-2 py-1.5 z-50" style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}>
        <div className="flex justify-around max-w-md mx-auto">
          {[
            { label: 'Home', icon: '🏠', path: '/' },
            { label: 'Filtres', icon: '🔍', path: '/filters' },
            { label: 'Feed', icon: '📦', path: '/feed' },
            { label: 'Achats', icon: '💰', path: '/purchases' },
            { label: 'Stats', icon: '📊', path: '/analytics' },
          ].map(item => (
            <button
              key={item.path}
              onClick={() => goTo(item.path)}
              className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg active:bg-tg-secondary transition-colors"
            >
              <span className="text-base">{item.icon}</span>
              <span className="text-[9px] text-tg-hint">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
