import { useState } from 'react'
import {
  BarChart3,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  Target,
  Activity,
  Gem,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import PageTransition from '../components/PageTransition'
import KpiCard from '../components/KpiCard'
import { useStats } from '../hooks/useStats'
import { useCrmStats } from '../hooks/useStats'
import { formatPriceShort, formatNumber, formatPercent } from '../utils/format'

const periods = [
  { key: '7', label: '7j' },
  { key: '30', label: '30j' },
  { key: '90', label: '90j' },
  { key: 'all', label: 'Tout' },
]

export default function Analytics() {
  const [period, setPeriod] = useState('30')
  const { data: stats } = useStats()
  const { data: crmStats } = useCrmStats()

  const crm = crmStats as any || {}
  const invested = crm.invested ?? stats?.invested ?? 0
  const revenue = crm.revenue ?? stats?.revenue ?? 0
  const profit = crm.profit ?? stats?.profit ?? 0
  const roi = crm.roi ?? stats?.roi ?? 0

  const timeline = stats?.timeline || []
  const topBrands = stats?.top_brands || []

  return (
    <PageTransition>
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <BarChart3 size={18} className="text-accent" />
        <h1 className="text-lg font-bold text-white tracking-tight">Statistiques</h1>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 mb-5">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`btn-press flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
              period === p.key
                ? 'gradient-purple text-white shadow-sm'
                : 'bg-bg-secondary glass-border text-gray-400'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <KpiCard
          icon={<Wallet size={16} className="text-blue-400" />}
          label="Investi"
          value={formatPriceShort(invested)}
          gradient="bg-blue-500/15"
        />
        <KpiCard
          icon={<ArrowUpRight size={16} className="text-emerald-400" />}
          label="Revenus"
          value={formatPriceShort(revenue)}
          gradient="bg-emerald-500/15"
        />
        <KpiCard
          icon={<TrendingUp size={16} className="text-success" />}
          label="Profit"
          value={formatPriceShort(profit)}
          gradient="bg-success/15"
        />
        <KpiCard
          icon={<Target size={16} className="text-accent-light" />}
          label="ROI"
          value={formatPercent(roi)}
          gradient="bg-accent/15"
        />
      </div>

      {/* Profit Chart */}
      {timeline.length > 0 && (
        <div className="glass-card p-4 mb-5">
          <h2 className="text-sm font-bold text-white mb-3">Profit dans le temps</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline}>
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string) => {
                    const d = new Date(v)
                    return `${d.getDate()}/${d.getMonth() + 1}`
                  }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v}\u20ac`}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    background: '#161628',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12,
                    fontSize: 12,
                    color: '#e2e8f0',
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)} \u20ac`, 'Profit']}
                  labelFormatter={(label: string) => {
                    const d = new Date(label)
                    return d.toLocaleDateString('fr-FR')
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#profitGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Detection Stats */}
      <div className="glass-card p-4 mb-5">
        <h2 className="text-sm font-bold text-white mb-3">Détection</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
              <Activity size={15} className="text-accent-light" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Aujourd'hui</p>
              <p className="text-sm font-bold text-white">{formatNumber(stats?.items_today)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
              <Activity size={15} className="text-accent-light" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-sm font-bold text-white">{formatNumber(stats?.total_items)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gold/15 flex items-center justify-center">
              <Gem size={15} className="text-gold" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Pépites auj.</p>
              <p className="text-sm font-bold text-white">{formatNumber(stats?.deals_today)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gold/15 flex items-center justify-center">
              <Gem size={15} className="text-gold" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Pépites total</p>
              <p className="text-sm font-bold text-white">{formatNumber(stats?.total_deals)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Brands */}
      {topBrands.length > 0 && (
        <div className="glass-card p-4 mb-4">
          <h2 className="text-sm font-bold text-white mb-3">Top marques</h2>
          <div className="flex flex-col gap-2.5">
            {topBrands.slice(0, 5).map((brand, i) => {
              const maxCount = topBrands[0]?.count || 1
              const pct = (brand.count / maxCount) * 100
              return (
                <div key={brand.name} className="flex items-center gap-3">
                  <span className="text-2xs text-gray-500 w-4 text-right font-mono">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-300">{brand.name}</span>
                      <span className="text-2xs text-gray-500">{brand.count}</span>
                    </div>
                    <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full gradient-purple transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </PageTransition>
  )
}
