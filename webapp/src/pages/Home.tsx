import { useNavigate } from 'react-router-dom';
import { useFilters } from '../hooks/useFilters.js';
import { useRecentArticles } from '../hooks/useArticles.js';
import { usePurchaseStats } from '../hooks/usePurchases.js';
import StatsCard from '../components/StatsCard.js';
import ArticleCard from '../components/ArticleCard.js';
import { formatPriceCompact } from '../utils/formatters.js';
import { hapticFeedback } from '../utils/telegram.js';

export default function Home() {
  const navigate = useNavigate();
  const { data: filters } = useFilters();
  const { data: recentArticles } = useRecentArticles();
  const { data: stats } = usePurchaseStats();

  const activeFilters = filters?.filter(f => f.is_active).length ?? 0;

  const goTo = (path: string) => {
    hapticFeedback('light');
    navigate(path);
  };

  return (
    <div className="p-4 pb-20 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-tg">Vinted Bot</h1>
        <p className="text-sm text-tg-hint mt-1">Surveillance en temps reel</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatsCard
          label="Filtres actifs"
          value={`${activeFilters}/${filters?.length ?? 0}`}
          icon="🔍"
        />
        <StatsCard
          label="Articles detectes"
          value={recentArticles?.length ?? 0}
          subtitle="Recents"
          icon="📦"
        />
        <StatsCard
          label="Profit net"
          value={stats ? formatPriceCompact(stats.totalProfit) : '0 EUR'}
          trend={stats && stats.totalProfit > 0 ? 'up' : stats && stats.totalProfit < 0 ? 'down' : 'neutral'}
          icon="💰"
        />
        <StatsCard
          label="Pepites"
          value={recentArticles?.filter(a => a.is_pepite).length ?? 0}
          icon="💎"
        />
      </div>

      {/* Quick actions */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-tg-section-header uppercase">Actions rapides</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Mes Filtres', icon: '🔍', path: '/filters' },
            { label: 'Feed', icon: '📦', path: '/feed' },
            { label: 'Achats', icon: '🛒', path: '/purchases' },
            { label: 'Analytics', icon: '📊', path: '/analytics' },
          ].map(item => (
            <button
              key={item.path}
              onClick={() => goTo(item.path)}
              className="bg-tg-section rounded-xl p-4 text-left hover:opacity-80 transition-opacity"
            >
              <span className="text-2xl">{item.icon}</span>
              <div className="text-sm font-medium text-tg mt-2">{item.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent articles */}
      {recentArticles && recentArticles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-tg-section-header uppercase">Derniers articles</h2>
            <button onClick={() => goTo('/feed')} className="text-xs text-tg-link">
              Voir tout
            </button>
          </div>
          {recentArticles.slice(0, 3).map(article => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-tg-section border-t border-gray-200 dark:border-gray-700 flex justify-around py-2 px-4 safe-bottom">
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
            className="flex flex-col items-center gap-0.5 text-tg-hint hover:text-tg-link transition-colors"
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-[10px]">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
