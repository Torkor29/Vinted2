import { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { useBrandSearch } from '../hooks/useQueries'

interface BrandSearchProps {
  selectedIds: number[]
  selectedLabels: string[]
  onToggle: (id: number, title: string) => void
}

const popularBrands = [
  'Nike', 'Adidas', 'Zara', 'H&M', 'Shein',
  'Pull & Bear', 'Mango', 'Levi\'s', 'Ralph Lauren', 'Lacoste',
]

export default function BrandSearch({ selectedIds, selectedLabels, onToggle }: BrandSearchProps) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(t)
  }, [query])

  const { data: results, isLoading } = useBrandSearch(debounced)

  return (
    <div>
      {/* Search input */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une marque..."
          className="w-full pl-9 pr-9 py-2.5 bg-bg-secondary rounded-xl glass-border text-sm text-white placeholder:text-gray-500 outline-none focus:border-accent/30 transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Search results */}
      {debounced.length >= 2 && (
        <div className="mt-2 bg-bg-secondary rounded-xl glass-border max-h-48 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 text-xs text-gray-500 text-center">Recherche...</div>
          ) : results && results.length > 0 ? (
            results.slice(0, 15).map((brand) => {
              const isSelected = selectedIds.includes(brand.id)
              return (
                <button
                  key={brand.id}
                  onClick={() => onToggle(brand.id, brand.title)}
                  className={`btn-press w-full text-left px-3 py-2.5 text-sm flex items-center justify-between hover:bg-bg-hover transition-colors ${
                    isSelected ? 'text-accent-light' : 'text-gray-300'
                  }`}
                >
                  <span className="truncate">{brand.title}</span>
                  {isSelected && (
                    <span className="text-2xs bg-accent/20 text-accent px-1.5 py-0.5 rounded font-medium ml-2 shrink-0">
                      Ajouté
                    </span>
                  )}
                </button>
              )
            })
          ) : (
            <div className="p-3 text-xs text-gray-500 text-center">Aucun résultat</div>
          )}
        </div>
      )}

      {/* Popular brands */}
      {!debounced && selectedIds.length === 0 && (
        <div className="mt-3">
          <p className="text-2xs text-gray-500 uppercase tracking-wider mb-2 font-semibold">
            Marques populaires
          </p>
          <div className="flex flex-wrap gap-1.5">
            {popularBrands.map((name) => (
              <button
                key={name}
                onClick={() => {
                  setQuery(name)
                }}
                className="btn-press text-2xs bg-bg-secondary glass-border text-gray-400 px-2.5 py-1.5 rounded-lg hover:text-white transition-colors"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected brands */}
      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedLabels.map((label, i) => (
            <span
              key={i}
              className="text-2xs bg-blue-500/12 text-blue-400 px-2 py-1 rounded-md font-medium flex items-center gap-1"
            >
              {label}
              <button
                onClick={() => {
                  const id = selectedIds[i]
                  if (id !== undefined) onToggle(id, label)
                }}
                className="hover:text-white"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
