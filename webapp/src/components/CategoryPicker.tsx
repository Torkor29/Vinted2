import { useState } from 'react'
import { ChevronRight, ChevronDown, Check, Loader2 } from 'lucide-react'
import { type CatalogCategory } from '../api/client'

interface CategoryPickerProps {
  categories: CatalogCategory[]
  selected: number[]
  selectedLabels: string[]
  onToggle: (id: number, title: string) => void
  isLoading?: boolean
}

function CategoryNode({
  cat,
  selected,
  onToggle,
  depth,
}: {
  cat: CatalogCategory
  selected: number[]
  onToggle: (id: number, title: string) => void
  depth: number
}) {
  const [expanded, setExpanded] = useState(false)
  const isSelected = selected.includes(cat.id)
  const hasChildren = cat.children && cat.children.length > 0

  return (
    <div>
      <button
        className="btn-press w-full flex items-center gap-2 py-2.5 px-3 hover:bg-bg-hover rounded-lg transition-colors"
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => {
          if (hasChildren) {
            setExpanded(!expanded)
          }
          onToggle(cat.id, cat.title)
        }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown size={14} className="text-gray-500 shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-gray-500 shrink-0" />
          )
        ) : (
          <div className="w-3.5" />
        )}
        <span
          className={`text-sm flex-1 text-left truncate ${
            isSelected ? 'text-accent-light font-semibold' : 'text-gray-300'
          }`}
        >
          {cat.title}
        </span>
        {isSelected && <Check size={14} className="text-accent shrink-0" />}
      </button>
      {expanded && hasChildren && (
        <div>
          {cat.children!.map((child) => (
            <CategoryNode
              key={child.id}
              cat={child}
              selected={selected}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CategoryPicker({
  categories,
  selected,
  selectedLabels,
  onToggle,
  isLoading,
}: CategoryPickerProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="btn-press w-full flex items-center justify-between p-3 rounded-xl bg-bg-secondary glass-border"
      >
        <span className="text-sm text-gray-300">
          {selected.length > 0
            ? `${selected.length} catégorie${selected.length > 1 ? 's' : ''}`
            : 'Choisir les catégories'}
        </span>
        {expanded ? (
          <ChevronDown size={16} className="text-gray-500" />
        ) : (
          <ChevronRight size={16} className="text-gray-500" />
        )}
      </button>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedLabels.map((label, i) => (
            <span
              key={i}
              className="text-2xs bg-accent/12 text-accent-light px-2 py-1 rounded-md font-medium"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-2 bg-bg-secondary rounded-xl glass-border max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 size={16} className="text-accent animate-spin" />
              <span className="text-xs text-gray-500">Chargement des catégories...</span>
            </div>
          ) : categories.length > 0 ? (
            categories.map((cat) => (
              <CategoryNode
                key={cat.id}
                cat={cat}
                selected={selected}
                onToggle={onToggle}
                depth={0}
              />
            ))
          ) : (
            <div className="py-8 text-center">
              <p className="text-xs text-gray-500">Aucune catégorie disponible</p>
              <p className="text-2xs text-gray-600 mt-1">Le catalogue se charge au démarrage du bot</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
