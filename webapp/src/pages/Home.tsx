import { useNavigate } from 'react-router-dom'
import {
  Activity,
  Gem,
  TrendingUp,
  Target,
  Plus,
  Radio,
  Power,
  Settings,
} from 'lucide-react'
import PageTransition from '../components/PageTransition'
import KpiCard from '../components/KpiCard'
import ArticleCard from '../components/ArticleCard'
import { useBotStatus, useBotStart, useBotStop } from '../hooks/useBotStatus'
import { useStats } from '../hooks/useStats'
import { useItems } from '../hooks/useItems'
import { formatNumber, formatPriceShort, formatPercent } from '../utils/format'

export default function Home() {
  const navigate = useNavigate()
  const { data: status } = useBotStatus()
  const { data: stats } = useStats()
  const { data: items } = useItems()
  const startBot = useBotStart()
  const stopBot = useBotStop()

  const running = status?.running ?? false
  const recent = (items || []).slice(0, 3)

  const handleToggleBot = () => {
    if (running) {
      stopBot.mutate()
    } else {
      startBot.mutate()
    }
  }

  return (
    <PageTransition>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Bonjour
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Vinted Sniper</p>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="btn-press w-10 h-10 rounded-xl bg-bg-card glass-border flex items-center justify-center"
        >
          <Settings size={18} className="text-gray-400" />
        </button>
      </div>

      {/* Bot Status */}
      <div className="glass-card p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${
              running
                ? 'bg-success animate-pulse-live'
                : 'bg-gray-600'
            }`}
          />
          <div>
            <p className="text-sm font-semibold text-white">
              {running ? 'Bot actif' : 'Bot arr\u00eat\u00e9'}
            </p>
            <p className="text-2xs text-gray-500">
              {running
                ? `${status?.queries || 0} filtre${(status?.queries || 0) > 1 ? 's' : ''} actif${(status?.queries || 0) > 1 ? 's' : ''}`
                : 'Appuyez pour d\u00e9marrer'}
            </p>
          </div>
        </div>
        <button
          onClick={handleToggleBot}
          disabled={startBot.isPending || stopBot.isPending}
          className={`btn-press w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
            running
              ? 'bg-danger/15 text-danger'
              : 'gradient-purple text-white shadow-lg shadow-accent/20'
          }`}
        >
          <Power size={20} />
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <KpiCard
          icon={<Activity size={16} className="text-accent-light" />}
          label="D\u00e9tect\u00e9s"
          value={formatNumber(stats?.total_items)}
          sub={stats?.items_today ? `+${stats.items_today} auj.` : undefined}
          gradient="bg-accent/15"
        />
        <KpiCard
          icon={<Gem size={16} className="text-gold" />}
          label="P\u00e9pites"
          value={formatNumber(stats?.total_deals)}
          sub={stats?.deals_today ? `+${stats.deals_today} auj.` : undefined}
          gradient="bg-gold/15"
        />
        <KpiCard
          icon={<TrendingUp size={16} className="text-success" />}
          label="Profit"
          value={formatPriceShort(stats?.profit)}
          gradient="bg-success/15"
        />
        <KpiCard
          icon={<Target size={16} className="text-blue-400" />}
          label="ROI"
          value={formatPercent(stats?.roi)}
          gradient="bg-blue-500/15"
        />
      </div>

      {/* Recent Articles */}
      {recent.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white">R\u00e9cents</h2>
            <button
              onClick={() => navigate('/feed')}
              className="btn-press text-2xs text-accent font-semibold"
            >
              Tout voir
            </button>
          </div>
          <div className="flex flex-col gap-2.5">
            {recent.map((item) => (
              <ArticleCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={() => navigate('/filters/new')}
          className="btn-press glass-card p-3.5 flex items-center gap-2.5"
        >
          <div className="w-9 h-9 rounded-xl gradient-purple flex items-center justify-center shadow-sm">
            <Plus size={18} className="text-white" />
          </div>
          <span className="text-xs font-semibold text-white">Nouveau filtre</span>
        </button>
        <button
          onClick={() => navigate('/feed')}
          className="btn-press glass-card p-3.5 flex items-center gap-2.5"
        >
          <div className="w-9 h-9 rounded-xl bg-success/15 flex items-center justify-center">
            <Radio size={18} className="text-success" />
          </div>
          <span className="text-xs font-semibold text-white">Voir le feed</span>
        </button>
      </div>
    </PageTransition>
  )
}
