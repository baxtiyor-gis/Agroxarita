import { useQuery } from '@tanstack/react-query'
import type { Tuman, TumanBatafsil, Viloyat } from './types'

/** Backend xato javobi: {"detail": "..."} */
export class ApiXato extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    let xabar = res.statusText
    try {
      xabar = ((await res.json()) as { detail?: string }).detail ?? xabar
    } catch {
      /* JSON emas */
    }
    throw new ApiXato(res.status, xabar)
  }
  return (await res.json()) as T
}

// 404 — qayta urinishning foydasi yo'q
const retry = (n: number, e: Error) => !(e instanceof ApiXato && e.status === 404) && n < 1

export function useViloyatlar() {
  return useQuery({
    queryKey: ['viloyatlar'],
    queryFn: () => getJson<Viloyat[]>('/api/viloyatlar/'),
    retry,
  })
}

export function useTumanlar(regionId: number | null) {
  return useQuery({
    queryKey: ['tumanlar', regionId],
    queryFn: () => getJson<Tuman[]>(`/api/tumanlar/?viloyat=${regionId}`),
    enabled: regionId != null,
    retry,
  })
}

/** Bitta tuman (URL'da faqat `tuman` bo'lsa viloyatni aniqlash uchun) */
export function useTuman(kod: number | null) {
  return useQuery({
    queryKey: ['tuman', kod],
    queryFn: () => getJson<TumanBatafsil>(`/api/tumanlar/${kod}/`),
    enabled: kod != null,
    retry,
  })
}
