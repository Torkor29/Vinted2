import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Loader2, Check } from 'lucide-react'
import PageTransition from '../components/PageTransition'
import CategoryPicker from '../components/CategoryPicker'
import BrandSearch from '../components/BrandSearch'
import { useQueries, useCreateQuery, useCatalog } from '../hooks/useQueries'
import type { VintedQuery } from '../api/client'

const genderOptions = [
  { value: '', label: 'Tous' },
  { value: 'women', label: 'Femmes' },
  { value: 'men', label: 'Hommes' },
  { value: 'kids', label: 'Enfants' },
]

const conditionOptions = [
  { id: 6, label: 'Neuf avec \u00e9tiquette' },
  { id: 1, label: 'Neuf sans \u00e9tiquette' },
  { id: 2, label: 'Tr\u00e8s bon \u00e9tat' },
  { id: 3, label: 'Bon \u00e9tat' },
  { id: 4, label: 'Satisfaisant' },
]

export default function FilterEdit() {
  const { index } = useParams()
  const navigate = useNavigate()
  const isEdit = index !== undefined && index !== 'new'
  const editIndex = isEdit ? parseInt(index!) : -1

  const { data: queries } = useQueries()
  const { data: catalog } = useCatalog()
  const createMutation = useCreateQuery()

  const [name, setName] = useState('')
  const [searchText, setSearchText] = useState('')
  const [gender, setGender] = useState('')
  const [catalogIds, setCatalogIds] = useState<number[]>([])
  const [catalogLabels, setCatalogLabels] = useState<string[]>([])
  const [brandIds, setBrandIds] = useState<number[]>([])
  const [brandLabels, setBrandLabels] = useState<string[]>([])
  const [sizeIds, setSizeIds] = useState<number[]>([])
  const [sizeLabels, setSizeLabels] = useState<string[]>([])
  const [colorIds, setColorIds] = useState<number[]>([])
  const [colorLabels, setColorLabels] = useState<string[]>([])
  const [statusIds, setStatusIds] = useState<number[]>([])
  const [statusLabels, setStatusLabels] = useState<string[]>([])
  const [priceFrom, setPriceFrom] = useState('')
  const [priceTo, setPriceTo] = useState('')

  // Populate from existing query
  useEffect(() => {
    if (isEdit && queries && queries[editIndex]) {
      const q = queries[editIndex]
      setName(q._name || '')
      setSearchText(q.search_text || '')
      setGender(q.gender || '')
      setCatalogIds(q.catalog_ids || [])
      setCatalogLabels(q._labels?.catalogs || [])
      setBrandIds(q.brand_ids || [])
      setBrandLabels(q._labels?.brands || [])
      setSizeIds(q.size_ids || [])
      setSizeLabels(q._labels?.sizes || [])
      setColorIds(q.color_ids || [])
      setColorLabels(q._labels?.colors || [])
      setStatusIds(q.status_ids || [])
      setStatusLabels(q._labels?.statuses || [])
      setPriceFrom(q.price_from ? String(q.price_from) : '')
      setPriceTo(q.price_to ? String(q.price_to) : '')
    }
  }, [isEdit, editIndex, queries])

  const handleToggleCatalog = (id: number, title: string) => {
    setCatalogIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
    setCatalogLabels((prev) =>
      prev.includes(title) ? prev.filter((x) => x !== title) : [...prev, title]
    )
  }

  const handleToggleBrand = (id: number, title: string) => {
    setBrandIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
    setBrandLabels((prev) =>
      prev.includes(title) ? prev.filter((x) => x !== title) : [...prev, title]
    )
  }

  const handleToggleSize = (id: number, title: string) => {
    setSizeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
    setSizeLabels((prev) =>
      prev.includes(title) ? prev.filter((x) => x !== title) : [...prev, title]
    )
  }

  const handleToggleColor = (id: number, title: string) => {
    setColorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
    setColorLabels((prev) =>
      prev.includes(title) ? prev.filter((x) => x !== title) : [...prev, title]
    )
  }

  const handleToggleStatus = (id: number, label: string) => {
    setStatusIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
    setStatusLabels((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    )
  }

  const handleSave = () => {
    const query: VintedQuery = {
      _name: name || `Filtre ${new Date().toLocaleDateString('fr-FR')}`,
      search_text: searchText || undefined,
      gender: gender || undefined,
      catalog_ids: catalogIds.length > 0 ? catalogIds : undefined,
      brand_ids: brandIds.length > 0 ? brandIds : undefined,
      size_ids: sizeIds.length > 0 ? sizeIds : undefined,
      color_ids: colorIds.length > 0 ? colorIds : undefined,
      status_ids: statusIds.length > 0 ? statusIds : undefined,
      price_from: priceFrom ? Number(priceFrom) : undefined,
      price_to: priceTo ? Number(priceTo) : undefined,
      _labels: {
        catalogs: catalogLabels,
        brands: brandLabels,
        sizes: sizeLabels,
        colors: colorLabels,
        statuses: statusLabels,
      },
    }
    createMutation.mutate(query, {
      onSuccess: () => navigate('/filters'),
    })
  }

  const sizes = catalog?.sizes || []
  const colors = catalog?.colors || []
  const categories = catalog?.categories || []

  return (
    <PageTransition>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate('/filters')}
          className="btn-press w-10 h-10 rounded-xl bg-bg-card glass-border flex items-center justify-center"
        >
          <ArrowLeft size={18} className="text-gray-400" />
        </button>
        <h1 className="text-lg font-bold text-white">
          {isEdit ? 'Modifier le filtre' : 'Nouveau filtre'}
        </h1>
      </div>

      <div className="flex flex-col gap-5 pb-24">
        {/* Name */}
        <Section title="Nom du filtre">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Sneakers Nike pas ch\u00e8res"
            className="w-full px-3 py-2.5 bg-bg-secondary rounded-xl glass-border text-sm text-white placeholder:text-gray-500 outline-none focus:border-accent/30 transition-colors"
          />
        </Section>

        {/* Keyword */}
        <Section title="Mot-cl\u00e9" badge="Optionnel">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Terme de recherche..."
            className="w-full px-3 py-2.5 bg-bg-secondary rounded-xl glass-border text-sm text-white placeholder:text-gray-500 outline-none focus:border-accent/30 transition-colors"
          />
        </Section>

        {/* Gender */}
        <Section title="Genre">
          <div className="flex gap-2">
            {genderOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGender(opt.value)}
                className={`btn-press flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  gender === opt.value
                    ? 'gradient-purple text-white shadow-sm'
                    : 'bg-bg-secondary glass-border text-gray-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Categories */}
        <Section title="Cat\u00e9gories" count={catalogIds.length}>
          <CategoryPicker
            categories={categories}
            selected={catalogIds}
            selectedLabels={catalogLabels}
            onToggle={handleToggleCatalog}
          />
        </Section>

        {/* Brands */}
        <Section title="Marques" count={brandIds.length}>
          <BrandSearch
            selectedIds={brandIds}
            selectedLabels={brandLabels}
            onToggle={handleToggleBrand}
          />
        </Section>

        {/* Sizes */}
        <Section title="Tailles" count={sizeIds.length}>
          {sizes.length > 0 ? (
            <div className="grid grid-cols-5 gap-1.5">
              {sizes.slice(0, 30).map((size) => {
                const isSelected = sizeIds.includes(size.id)
                return (
                  <button
                    key={size.id}
                    onClick={() => handleToggleSize(size.id, size.title)}
                    className={`btn-press py-2 rounded-lg text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-accent text-white'
                        : 'bg-bg-secondary glass-border text-gray-400'
                    }`}
                  >
                    {size.title}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-500">Chargement des tailles...</p>
          )}
        </Section>

        {/* Colors */}
        <Section title="Couleurs" count={colorIds.length}>
          {colors.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => {
                const isSelected = colorIds.includes(color.id)
                return (
                  <button
                    key={color.id}
                    onClick={() => handleToggleColor(color.id, color.title)}
                    className={`btn-press w-9 h-9 rounded-xl border-2 transition-all flex items-center justify-center ${
                      isSelected ? 'border-accent scale-110' : 'border-transparent'
                    }`}
                    title={color.title}
                  >
                    <div
                      className="w-6 h-6 rounded-lg"
                      style={{ backgroundColor: color.hex || '#888' }}
                    />
                    {isSelected && (
                      <Check
                        size={12}
                        className="absolute text-white drop-shadow-lg"
                      />
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-500">Chargement des couleurs...</p>
          )}
        </Section>

        {/* Condition */}
        <Section title="\u00c9tat" count={statusIds.length}>
          <div className="flex flex-wrap gap-2">
            {conditionOptions.map((cond) => {
              const isSelected = statusIds.includes(cond.id)
              return (
                <button
                  key={cond.id}
                  onClick={() => handleToggleStatus(cond.id, cond.label)}
                  className={`btn-press px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-accent text-white'
                      : 'bg-bg-secondary glass-border text-gray-400'
                  }`}
                >
                  {cond.label}
                </button>
              )
            })}
          </div>
        </Section>

        {/* Price */}
        <Section title="Prix">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <input
                type="number"
                value={priceFrom}
                onChange={(e) => setPriceFrom(e.target.value)}
                placeholder="Min"
                className="w-full px-3 py-2.5 pr-8 bg-bg-secondary rounded-xl glass-border text-sm text-white placeholder:text-gray-500 outline-none focus:border-accent/30 transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                \u20ac
              </span>
            </div>
            <span className="text-gray-500 text-xs">\u2013</span>
            <div className="relative flex-1">
              <input
                type="number"
                value={priceTo}
                onChange={(e) => setPriceTo(e.target.value)}
                placeholder="Max"
                className="w-full px-3 py-2.5 pr-8 bg-bg-secondary rounded-xl glass-border text-sm text-white placeholder:text-gray-500 outline-none focus:border-accent/30 transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                \u20ac
              </span>
            </div>
          </div>
        </Section>
      </div>

      {/* Fixed save bar */}
      <div
        className="fixed bottom-[56px] left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-bg/95 backdrop-blur-xl border-t border-glass z-40"
      >
        <button
          onClick={handleSave}
          disabled={createMutation.isPending}
          className="btn-press w-full py-3.5 rounded-2xl gradient-purple text-white text-sm font-bold shadow-lg shadow-accent/25 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {createMutation.isPending ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {isEdit ? 'Mettre \u00e0 jour' : 'Enregistrer le filtre'}
        </button>
      </div>
    </PageTransition>
  )
}

function Section({
  title,
  badge,
  count,
  children,
}: {
  title: string
  badge?: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-sm font-bold text-white">{title}</h2>
        {badge && (
          <span className="text-2xs text-gray-500 bg-bg-secondary px-1.5 py-0.5 rounded font-medium">
            {badge}
          </span>
        )}
        {count !== undefined && count > 0 && (
          <span className="text-2xs bg-accent/20 text-accent-light px-1.5 py-0.5 rounded-full font-bold">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}
