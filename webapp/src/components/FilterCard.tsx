import { Trash2, Tag, Euro } from 'lucide-react'
import { type VintedQuery } from '../api/client'

interface FilterCardProps {
  query: VintedQuery
  index: number
  onEdit: () => void
  onDelete: () => void
}

export default function FilterCard({ query, index, onEdit, onDelete }: FilterCardProps) {
  const labels = query._labels || {}
  const name = query._name || `Filtre #${index + 1}`
  const hasPrice = query.price_from || query.price_to

  return (
    <div
      className="glass-card p-4 animate-slide-up cursor-pointer btn-press"
      onClick={onEdit}
    >
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white truncate">{name}</h3>
          {query.search_text && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              Recherche : {query.search_text}
            </p>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="btn-press w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-danger hover:bg-danger/10 transition-colors ml-2"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Labels */}
      <div className="flex flex-wrap gap-1.5">
        {labels.catalogs?.map((c, i) => (
          <span key={`c${i}`} className="text-2xs bg-accent/12 text-accent-light px-2 py-1 rounded-md font-medium">
            {c}
          </span>
        ))}
        {labels.brands?.map((b, i) => (
          <span key={`b${i}`} className="text-2xs bg-blue-500/12 text-blue-400 px-2 py-1 rounded-md font-medium">
            {b}
          </span>
        ))}
        {labels.sizes?.map((s, i) => (
          <span key={`s${i}`} className="text-2xs bg-emerald-500/12 text-emerald-400 px-2 py-1 rounded-md font-medium">
            {s}
          </span>
        ))}
        {labels.statuses?.map((st, i) => (
          <span key={`st${i}`} className="text-2xs bg-orange-500/12 text-orange-400 px-2 py-1 rounded-md font-medium">
            {st}
          </span>
        ))}
        {labels.colors?.map((co, i) => (
          <span key={`co${i}`} className="text-2xs bg-pink-500/12 text-pink-400 px-2 py-1 rounded-md font-medium">
            {co}
          </span>
        ))}
        {hasPrice && (
          <span className="text-2xs bg-gold/12 text-gold px-2 py-1 rounded-md font-medium flex items-center gap-1">
            <Euro size={10} />
            {query.price_from || 0} - {query.price_to || '\u221e'}
          </span>
        )}
      </div>

      {query.gender && (
        <div className="mt-2 flex items-center gap-1">
          <Tag size={11} className="text-gray-500" />
          <span className="text-2xs text-gray-400">{query.gender}</span>
        </div>
      )}
    </div>
  )
}
