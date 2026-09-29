import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { useKontur } from '@/features/kontur/api'
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
  const kontur = butunSon(params.get('kontur'))
  const yaroqsiz =
    (params.has('viloyat') && viloyat == null) ||
    (params.has('tuman') && tuman == null) ||
    (params.has('kontur') && kontur == null)

  const viloyatlar = useViloyatlar()
  const tumanlar = useTumanlar(viloyat)
  // faqat `tuman` berilgan bo'lsa — viloyatni tumandan aniqlaymiz
  const tumanYolgiz = useTuman(viloyat == null ? tuman : null)

  const konturQ = useKontur(kontur)

  const viloyatObj = viloyat != null ? viloyatlar.data?.find((v) => v.region_id === viloyat) ?? null : null
  const tumanObj = tuman != null ? tumanlar.data?.find((t) => t.kod === tuman) ?? null : null

  const yangila = useCallback(
    (v: number | null, t: number | null, replace: boolean, k: number | null = null) => {
      const p = new URLSearchParams()
      if (v != null) p.set('viloyat', String(v))
      if (t != null) p.set('tuman', String(t))
      if (k != null && t != null) p.set('kontur', String(k))
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
    // faqat kontur berilgan -> viloyat/tuman konturdan olinadi; topilmasa yoki boshqa tumanniki bo'lsa tozalanadi
    if (kontur != null) {
      if (konturQ.error instanceof ApiXato && konturQ.error.status === 404) {
        yangila(viloyat, tuman, true)
        return
      }
      if (konturQ.data) {
        if (tuman == null) {
          yangila(konturQ.data.viloyat.region_id, konturQ.data.tuman.kod, true, kontur)
          return
        }
        if (konturQ.data.tuman.kod !== tuman) {
          yangila(viloyat, tuman, true)
          return
        }
      }
    }
    // faqat tuman berilgan
    if (viloyat == null && tuman != null) {
      if (tumanYolgiz.data) yangila(tumanYolgiz.data.region_id, tuman, true, kontur)
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
    kontur,
    konturQ.data,
    konturQ.error,
    yangila,
  ])

  return {
    viloyat: yaroqsiz ? null : viloyat,
    tuman: yaroqsiz ? null : tuman,
    kontur: yaroqsiz || tuman == null ? null : kontur,
    viloyatObj,
    tumanObj,
    viloyatlar,
    tumanlar,
    setViloyat: (id: number | null) => yangila(id, null, false),
    setTuman: (kod: number | null) => yangila(viloyat, kod, false),
    setKontur: (id: number | null) => yangila(viloyat, tuman, false, id),
  }
}

export type Tanlov = ReturnType<typeof useTanlov>
