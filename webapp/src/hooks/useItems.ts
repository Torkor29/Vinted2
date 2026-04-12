import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getItems } from '../api/client'
import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'https://vintedlba.duckdns.org'

let socket: ReturnType<typeof io> | null = null

function getSocket() {
  if (!socket) {
    socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 3000,
    })
  }
  return socket
}

export function useItems() {
  const qc = useQueryClient()

  useEffect(() => {
    const s = getSocket()

    s.on('item:new', () => {
      qc.invalidateQueries({ queryKey: ['items'] })
    })

    s.on('items:backlog', () => {
      qc.invalidateQueries({ queryKey: ['items'] })
    })

    s.on('queries:updated', () => {
      qc.invalidateQueries({ queryKey: ['queries'] })
    })

    s.on('crm:updated', () => {
      qc.invalidateQueries({ queryKey: ['crmStats'] })
    })

    return () => {
      s.off('item:new')
      s.off('items:backlog')
      s.off('queries:updated')
      s.off('crm:updated')
    }
  }, [qc])

  return useQuery({
    queryKey: ['items'],
    queryFn: getItems,
    refetchInterval: 8000,
  })
}
