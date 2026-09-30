import { useQuery } from '@tanstack/react-query'
import { getJson, retry } from '@/features/border/api'

/** GET /api/tumanlar/{kod}/relyef/ — DEM legendasi (docs/api.md) */
export interface RelyefLegenda {
  min: number
  max: number
  klasslar: { min: number; max: number; rang: string }[]
}

export function useRelyefLegenda(tuman: number | null) {
  return useQuery({
    queryKey: ['relyef-legenda', tuman],
    queryFn: () => getJson<RelyefLegenda>(`/api/tumanlar/${tuman}/relyef/`),
    enabled: tuman != null,
    retry,
    staleTime: Infinity,
  })
}

/** GET /api/ekinlar/ — bazadagi ekin yillari (yangi -> eski) */
export interface EkinlarJavob {
  yillar: number[]
  ekinlar: { kod: number; nom: string; maydonlar: Record<string, number> }[]
}

export function useEkinYillar() {
  return useQuery({
    queryKey: ['ekinlar'],
    queryFn: () => getJson<EkinlarJavob>('/api/ekinlar/'),
    retry,
    staleTime: Infinity,
  })
}
