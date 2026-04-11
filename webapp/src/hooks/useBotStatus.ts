import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getBotStatus, startBot, stopBot } from '../api/client'

export function useBotStatus() {
  return useQuery({
    queryKey: ['botStatus'],
    queryFn: getBotStatus,
    refetchInterval: 5000,
  })
}

export function useBotStart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: startBot,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['botStatus'] })
    },
  })
}

export function useBotStop() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: stopBot,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['botStatus'] })
    },
  })
}
