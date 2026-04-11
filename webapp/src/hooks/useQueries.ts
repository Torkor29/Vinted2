import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getQueries, createQuery, deleteQuery, getCatalog, searchBrands, type VintedQuery } from '../api/client'

export function useQueries() {
  return useQuery({
    queryKey: ['queries'],
    queryFn: getQueries,
  })
}

export function useCreateQuery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (query: VintedQuery) => createQuery(query),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queries'] })
    },
  })
}

export function useDeleteQuery() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (index: number) => deleteQuery(index),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queries'] })
    },
  })
}

export function useCatalog() {
  return useQuery({
    queryKey: ['catalog'],
    queryFn: getCatalog,
    staleTime: 60_000 * 10,
  })
}

export function useBrandSearch(query: string) {
  return useQuery({
    queryKey: ['brands', query],
    queryFn: () => searchBrands(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
  })
}
