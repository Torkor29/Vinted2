import { useQuery } from '@tanstack/react-query'
import { getStats, getSessions, getCrmStats } from '../api/client'

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
    refetchInterval: 15000,
  })
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: getSessions,
    refetchInterval: 10000,
  })
}

export function useCrmStats() {
  return useQuery({
    queryKey: ['crmStats'],
    queryFn: getCrmStats,
  })
}
