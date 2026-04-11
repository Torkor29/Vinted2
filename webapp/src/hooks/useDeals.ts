import { useQuery } from '@tanstack/react-query'
import { getTopDeals, getDealStats } from '../api/client'

export function useDeals() {
  return useQuery({
    queryKey: ['deals'],
    queryFn: getTopDeals,
    refetchInterval: 10000,
  })
}

export function useDealStats() {
  return useQuery({
    queryKey: ['dealStats'],
    queryFn: getDealStats,
  })
}
