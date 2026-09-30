import { useQuery } from '@tanstack/react-query'
import { getJson, retry } from '@/features/border/api'
import type { Iqlim, Kontur } from './types'

export function useKontur(id: number | null) {
  return useQuery({
    queryKey: ['kontur', id],
    queryFn: () => getJson<Kontur>(`/api/konturlar/${id}/`),
    enabled: id != null,
    retry,
  })
}

/** Faqat Iqlim tabi ochilganda so'raladi (`enabled`); 404 — kontur iqlim katagidan tashqarida */
export function useIqlim(id: number | null, enabled = true) {
  return useQuery({
    queryKey: ['kontur', id, 'iqlim'],
    queryFn: () => getJson<Iqlim>(`/api/konturlar/${id}/iqlim/`),
    enabled: enabled && id != null,
    retry,
    staleTime: Infinity,
  })
}
