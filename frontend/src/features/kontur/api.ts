import { useQuery } from '@tanstack/react-query'
import { getJson, retry } from '@/features/border/api'
import type { Kontur } from './types'

export function useKontur(id: number | null) {
  return useQuery({
    queryKey: ['kontur', id],
    queryFn: () => getJson<Kontur>(`/api/konturlar/${id}/`),
    enabled: id != null,
    retry,
  })
}
