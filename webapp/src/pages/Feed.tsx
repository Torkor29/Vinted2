import { useState, useMemo, useEffect, useRef } from 'react'
import { Radio, Loader2 } from 'lucide-react'
import PageTransition from '../components/PageTransition'
import ArticleCard from '../components/ArticleCard'
import { useItems } from '../hooks/useItems'
import { useQueries } from '../hooks/useQueries'

export default function Feed() {
  const { data: items, isLoading } = useItems()
  const { data: queries } = useQueries()
  const [activeFilter, setActiveFilter] = useState('all')
  const [visibleCount, setVisibleCount] = useState(30)
  const bottomRef = useRef<HTMLDivElement>(null)

  const filterNames = useMemo(() => {
    if (!queries) return []
    return queries.map((q, i) => q._name || `Filtre #${i + 1}`)
  }, [queries])

  const filtered = useMemo(() => {
    if (!items) return []
    if (activeFilter === 'all') return items
    return items.filter((item) => item._query_name === activeFilter)
  }, [items, activeFilter])

  const visible = filtered.slice(0, visibleCount)

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && visibleCount < filtered.length) {
          setVisibleCount((prev) => Math.min(prev + 20, filtered.length))
        }
      },
      { threshold: 0.1 }
    )
    if (bottomRef.current) observer.observe(bottomRef.current)
    return () => observer.disconnect()
  }, [visibleCount, filtered.length])

  return (
    <PageTransition>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Radio size={18} className="text-success" />
        <h1 className="text-lg font-bold text-white tracking-tight">Feed</h1>
        <div className="w-2 h-2 rounded-full bg-success animate-pulse-live ml-1" />
        <span className="text-2xs text-gray-500 ml-auto">
          {filtered.length} article{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-3 -mx-4 px-4 scrollbar-hide">
        <button
          onClick={() => { setActiveFilter('all'); setVisibleCount(30) }}
          className={`btn-press shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeFilter === 'all'
              ? 'gradient-purple text-white shadow-sm'
              : 'bg-bg-secondary glass-border text-gray-400'
          }`}
        >
          Tous
        </button>
        {filterNames.map((name) => (
          <button
            key={name}
            onClick={() => { setActiveFilter(name); setVisibleCount(30) }}
            className={`btn-press shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              activeFilter === name
                ? 'gradient-purple text-white shadow-sm'
                : 'bg-bg-secondary glass-border text-gray-400'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Items */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="text-accent animate-spin" />
        </div>
      ) : visible.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {visible.map((item, i) => (
            <ArticleCard key={`${item.id}-${i}`} item={item} showDeal />
          ))}
          <div ref={bottomRef} className="h-4" />
          {visibleCount < filtered.length && (
            <div className="flex justify-center py-4">
              <Loader2 size={18} className="text-accent/50 animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-bg-secondary flex items-center justify-center mb-4">
            <Radio size={28} className="text-gray-600" />
          </div>
          <p className="text-sm text-gray-400 font-medium mb-1">Aucun article</p>
          <p className="text-xs text-gray-500">
            Les articles apparaîtront ici dès que le bot détecte des résultats
          </p>
        </div>
      )}
    </PageTransition>
  )
}
