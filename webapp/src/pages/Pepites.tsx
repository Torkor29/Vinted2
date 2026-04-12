import { Gem, Loader2 } from 'lucide-react'
import PageTransition from '../components/PageTransition'
import ArticleCard from '../components/ArticleCard'
import { useDeals } from '../hooks/useDeals'

export default function Pepites() {
  const { data: deals, isLoading } = useDeals()

  const sorted = [...(deals || [])].sort(
    (a, b) => (b.discount_percent || 0) - (a.discount_percent || 0)
  )

  return (
    <PageTransition>
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <Gem size={18} className="text-gold" />
        <h1 className="text-lg font-bold text-white tracking-tight">Pépites</h1>
        <span className="text-2xs bg-gold/15 text-gold px-2 py-0.5 rounded-full font-bold ml-2">
          {sorted.length}
        </span>
      </div>

      {/* Info banner */}
      <div className="glass-card p-3 mb-4 bg-gold/5 border-gold/10">
        <p className="text-xs text-gold/80 leading-relaxed">
          Les pépites sont des articles détectés en dessous du prix du marché. Plus le % est élevé, meilleure est l'affaire.
        </p>
      </div>

      {/* Deals */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="text-gold animate-spin" />
        </div>
      ) : sorted.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {sorted.map((deal, i) => (
            <ArticleCard key={`${deal.id}-${i}`} item={deal} showDeal />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mb-4">
            <Gem size={28} className="text-gold/40" />
          </div>
          <p className="text-sm text-gray-400 font-medium mb-1">Aucune pépite</p>
          <p className="text-xs text-gray-500">
            Les bonnes affaires apparaîtront ici automatiquement
          </p>
        </div>
      )}
    </PageTransition>
  )
}
