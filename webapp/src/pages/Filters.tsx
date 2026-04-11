import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Filter, Loader2 } from 'lucide-react'
import PageTransition from '../components/PageTransition'
import FilterCard from '../components/FilterCard'
import { useQueries, useDeleteQuery } from '../hooks/useQueries'

export default function Filters() {
  const navigate = useNavigate()
  const { data: queries, isLoading } = useQueries()
  const deleteMutation = useDeleteQuery()
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const handleDelete = (index: number) => {
    if (deleteConfirm === index) {
      deleteMutation.mutate(index)
      setDeleteConfirm(null)
    } else {
      setDeleteConfirm(index)
      setTimeout(() => setDeleteConfirm(null), 3000)
    }
  }

  return (
    <PageTransition>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Filter size={18} className="text-accent" />
            Mes filtres
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {queries?.length || 0} filtre{(queries?.length || 0) > 1 ? 's' : ''} actif{(queries?.length || 0) > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filter List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="text-accent animate-spin" />
        </div>
      ) : queries && queries.length > 0 ? (
        <div className="flex flex-col gap-3 mb-20">
          {queries.map((query, index) => (
            <div key={index} className="relative">
              <FilterCard
                query={query}
                index={index}
                onEdit={() => navigate(`/filters/${index}`)}
                onDelete={() => handleDelete(index)}
              />
              {deleteConfirm === index && (
                <div className="absolute inset-0 bg-danger/10 border-2 border-danger/30 rounded-2xl flex items-center justify-center backdrop-blur-sm animate-fade-in">
                  <button
                    onClick={() => handleDelete(index)}
                    className="btn-press bg-danger text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
                  >
                    Confirmer la suppression
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
            <Filter size={28} className="text-accent/50" />
          </div>
          <p className="text-sm text-gray-400 font-medium mb-1">Aucun filtre</p>
          <p className="text-xs text-gray-500 mb-6">
            Cr\u00e9ez votre premier filtre pour commencer la d\u00e9tection
          </p>
          <button
            onClick={() => navigate('/filters/new')}
            className="btn-press gradient-purple text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-accent/20"
          >
            Cr\u00e9er un filtre
          </button>
        </div>
      )}

      {/* FAB */}
      {queries && queries.length > 0 && (
        <button
          onClick={() => navigate('/filters/new')}
          className="btn-press fixed bottom-[80px] right-4 left-auto w-14 h-14 rounded-2xl gradient-purple shadow-xl shadow-accent/30 flex items-center justify-center z-40"
          style={{
            right: 'max(16px, calc((100vw - 480px) / 2 + 16px))',
          }}
        >
          <Plus size={24} className="text-white" />
        </button>
      )}
    </PageTransition>
  )
}
