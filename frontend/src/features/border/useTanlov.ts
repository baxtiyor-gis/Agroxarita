import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { ApiXato, useTuman, useTumanlar, useViloyatlar } from './api'

function butunSon(v: string | null): number | null {
  if (v == null || !/^\d+$/.test(v)) return null
  return Number(v)
}

/**
 * Viloyat/tuman tanlovi — URL `searchParams` da (`?viloyat=12&tuman=1201`).
 * Viloyat o'zgarsa tuman tozalanadi; mavjud bo'lmagan qiymat tozalanadi.
 */
export function useTanlov() {
  const [params, setParams] = useSearchParams()
  const viloyat = butunSon(params.get('viloyat'))
  const tuman = butunSon(params.get('tuman'))
  const yaroqsiz = (params.has('viloyat') && viloyat == null) || (params.has('tuman') && tuman == null)

  const viloyatlar = useViloyatlar()
  const tumanlar = useTumanlar(viloyat)
  // faqat `tuman` berilgan bo'lsa — viloyatni tumandan aniqlaymiz
  const tumanYolgiz = useTuman(viloyat == null ? tuman : null)

  const viloyatObj = viloyat != null ? viloyatlar.data?.find((v) => v.region_id === viloyat) ?? null : null
  const tumanObj = tuman != null ? tumanlar.data?.find((t) => t.kod === tuman) ?? null : null

  const yangila = useCallback(
    (v: number | null, t: number | null, replace: boolean) => {
      const p = new URLSearchParams()
      if (v != null) p.set('viloyat', String(v))
      if (t != null) p.set('tuman', String(t))
      setParams(p, { replace })
    },
    [setParams],
  )

  useEffect(() => {
    if (yaroqsiz) {
      yangila(null, null, true)
      return
    }
    // viloyat ro'yxat yuklangan va bunday viloyat yo'q -> tozalash
    if (viloyat != null && viloyatlar.data && !viloyatObj) {
      yangila(null, null, true)
      return
    }
    if (viloyat != null && tumanlar.error instanceof ApiXato && tumanlar.error.status === 404) {
      yangila(null, null, true)
      return
    }
    // tuman shu viloyatda emas -> tuman tozalanadi
    if (viloyat != null && tuman != null && tumanlar.data && !tumanObj) {
      yangila(viloyat, null, true)
      return
    }
    // faqat tuman berilgan
    if (viloyat == null && tuman != null) {
      if (tumanYolgiz.data) yangila(tumanYolgiz.data.region_id, tuman, true)
      else if (tumanYolgiz.error instanceof ApiXato && tumanYolgiz.error.status === 404)
        yangila(null, null, true)
    }
  }, [
    yaroqsiz,
    viloyat,
    tuman,
    viloyatlar.data,
    viloyatObj,
    tumanlar.data,
    tumanlar.error,
    tumanObj,
    tumanYolgiz.data,
    tumanYolgiz.error,
    yangila,
  ])

  return {
    viloyat: yaroqsiz ? null : viloyat,
    tuman: yaroqsiz ? null : tuman,
    viloyatObj,
    tumanObj,
    viloyatlar,
    tumanlar,
    setViloyat: (id: number | null) => yangila(id, null, false),
    setTuman: (kod: number | null) => yangila(viloyat, kod, false),
  }
}

export type Tanlov = ReturnType<typeof useTanlov>
