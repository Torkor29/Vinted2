import { useQuery } from '@tanstack/react-query'
import { getItems } from '../api/client'

export function useItems() {
  return useQuery({
    queryKey: ['items'],
    queryFn: getItems,
    refetchInterval: 8000,
  })
}
