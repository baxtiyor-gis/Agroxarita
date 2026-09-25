import { useEffect, useRef, useState } from 'react'
import { Marker } from 'maplibre-gl'
import type { Map as MlMap } from 'maplibre-gl'
import type { Feature, FeatureCollection, Point } from 'geojson'
import { useApp } from '@/store/useApp'
import { jsonOl, tumanUrl } from './tuman'

/**
 * Relyef (Copernicus DEM 30 m) va gorizontallar qatlamlari.
 * Fayllar faqat qatlam birinchi marta yoqilganda yuklanadi.
 */

export interface RelyefMeta {
  /** TL, TR, BR, BL — WGS84 */
  corners: [[number, number], [number, number], [number, number], [number, number]]
  min: number
  max: number
  /** balandlik (m) → rang */
  stops: [number, string][]
  /** Gorizontallar izohi, masalan "har 10 m (1100 m gacha), asosiy — 50 m" (ixtiyoriy) */
  gorizontalIzoh?: string
}

const DEM_ATTR = 'Copernicus DEM © ESA'
/** Gorizontal chiziqlari — iliq jigarrang: sputnikda ham, relyefda ham o'qiladi */
const GOR_RANG = '#9a5218'
/** Asosiy (50 m) chiziqlar biroz to'qroq */
const GOR_ASOSIY = '#7c3c0c'
/** Shu zoomdan kichikda yorliqlar yashiriladi */
const YORLIQ_ZOOM = 12.5

/**
 * Tuman bo'yicha kesh — faqat joriy tuman saqlanadi (boshqa tumanga o'tilsa
 * eski relyef/gorizontallar xotiradan ketadi). Xato bo'lgan so'rov keshda
 * qolmaydi — keyingi yoqishda qayta uriniladi.
 */
let keshTuman: string | null = null
let metaVaad: Promise<RelyefMeta> | null = null
let gorVaad: Promise<FeatureCollection> | null = null
function keshTekshir(tuman: string) {
  if (keshTuman === tuman) return
  keshTuman = tuman
  metaVaad = null
  gorVaad = null
}

/** Tumanning relyef.json i (rasm burchaklari, balandlik shkalasi, izohlar) */
export function relyefMeta(tuman: string): Promise<RelyefMeta> {
  keshTekshir(tuman)
  const p = (metaVaad ??= jsonOl<RelyefMeta>(tumanUrl(tuman, 'relyef.json')))
  p.catch(() => {
    if (metaVaad === p) metaVaad = null
  })
  return p
}

function gorOl(tuman: string): Promise<FeatureCollection> {
  keshTekshir(tuman)
  const p = (gorVaad ??= jsonOl<FeatureCollection>(tumanUrl(tuman, 'gorizontal.geojson')))
  p.catch(() => {
    if (gorVaad === p) gorVaad = null
  })
  return p
}

/** Relyef va gorizontallar qatlamlari ostiga qo'yiladigan qatlam — konturlar doim ustida */
const USTKI = 'kontur-fill'

export function useRelyef(map: React.RefObject<MlMap | null>, stylTayyor: boolean) {
  const relyefKorinsin = useApp((s) => s.relyefKorinsin)
  const gorizontalKorinsin = useApp((s) => s.gorizontalKorinsin)
  const tuman = useApp((s) => s.tuman)
  const [meta, setMeta] = useState<RelyefMeta | null>(null)
  const yorliqlar = useRef<Marker[]>([])

  // ------------------------------------------------------------- relyef
  useEffect(() => {
    const m = map.current
    if (!m || !stylTayyor) return
    if (m.getLayer('relyef')) {
      m.setLayoutProperty('relyef', 'visibility', relyefKorinsin ? 'visible' : 'none')
      return
    }
    if (!relyefKorinsin) return
    let bekor = false
    relyefMeta(tuman)
      .then((d) => {
        setMeta(d)
        if (bekor || m !== map.current || m.getSource('relyef')) return
        m.addSource('relyef', { type: 'image', url: tumanUrl(tuman, 'relyef.webp'), coordinates: d.corners })
        // Image manbasi spetsifikatsiyada `attribution` qabul qilmaydi —
        // atribusiya boshqaruvi uni manba obyektidan o'qiydi
        const src = m.getSource('relyef') as unknown as { attribution?: string }
        src.attribution = DEM_ATTR
        m.addLayer(
          {
            id: 'relyef',
            type: 'raster',
            source: 'relyef',
            paint: { 'raster-opacity': 0.75, 'raster-fade-duration': 0 },
          },
          // Gorizontallar allaqachon bo'lsa — ularning ostiga
          m.getLayer('gorizontal-halo') ? 'gorizontal-halo' : USTKI,
        )
      })
      .catch((e) => console.error('[relyef]', e))
    return () => {
      bekor = true
    }
  }, [map, stylTayyor, relyefKorinsin, tuman])

  // -------------------------------------------------------- gorizontallar
  useEffect(() => {
    const m = map.current
    if (!m || !stylTayyor) return
    const qatlamlar = ['gorizontal-halo', 'gorizontal', 'gorizontal-asosiy']

    const yorliqTozala = () => {
      for (const mk of yorliqlar.current) mk.remove()
      yorliqlar.current = []
    }

    if (!gorizontalKorinsin) {
      for (const l of qatlamlar)
        if (m.getLayer(l)) m.setLayoutProperty(l, 'visibility', 'none')
      yorliqTozala()
      return
    }

    let bekor = false
    const zoomda = () => {
      const k = m.getZoom() >= YORLIQ_ZOOM ? '' : 'none'
      for (const mk of yorliqlar.current) mk.getElement().style.display = k
    }

    gorOl(tuman)
      .then((fc) => {
        if (bekor || m !== map.current) return
        if (!m.getSource('gorizontal')) {
          m.addSource('gorizontal', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: fc.features.filter((f) => f.geometry.type !== 'Point'),
            },
            attribution: DEM_ATTR,
          })
          // Tartib: relyef < halo < oddiy < asosiy < konturlar
          const oldin = m.getLayer(USTKI) ? USTKI : undefined
          m.addLayer(
            {
              id: 'gorizontal-halo',
              type: 'line',
              source: 'gorizontal',
              filter: ['has', 'asosiy'],
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: {
                'line-color': '#fff7e8',
                'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.3, 14, 0.6],
                'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 3.6, 16, 4.6],
                'line-blur': 0.5,
              },
            },
            oldin,
          )
          m.addLayer(
            {
              id: 'gorizontal',
              type: 'line',
              source: 'gorizontal',
              filter: ['!', ['has', 'asosiy']],
              minzoom: 11,
              layout: { 'line-join': 'round' },
              paint: {
                'line-color': GOR_RANG,
                'line-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.35, 13, 0.65, 15, 0.8],
                'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 14, 0.9, 16, 1.2],
              },
            },
            oldin,
          )
          m.addLayer(
            {
              id: 'gorizontal-asosiy',
              type: 'line',
              source: 'gorizontal',
              filter: ['has', 'asosiy'],
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: {
                'line-color': GOR_ASOSIY,
                'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 14, 0.9],
                'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 14, 1.6, 16, 2.2],
              },
            },
            oldin,
          )
        } else {
          for (const l of qatlamlar) m.setLayoutProperty(l, 'visibility', 'visible')
        }

        // Asosiy chiziqlar yorliqlari — HTML markerlar (glyphs ishlatilmaydi)
        yorliqTozala()
        for (const f of fc.features) {
          if (f.geometry.type !== 'Point') continue
          const p = f as Feature<Point, { elev: number }>
          const el = document.createElement('div')
          el.className = 'gorizontal-yorliq'
          el.textContent = String(p.properties.elev)
          yorliqlar.current.push(
            new Marker({ element: el })
              .setLngLat(p.geometry.coordinates as [number, number])
              .addTo(m),
          )
        }
        zoomda()
        m.on('zoom', zoomda)
      })
      .catch((e) => console.error('[gorizontal]', e))

    return () => {
      bekor = true
      m.off('zoom', zoomda)
    }
  }, [map, stylTayyor, gorizontalKorinsin, tuman])

  // Xarita o'chirilganda markerlar ham ketadi
  useEffect(
    () => () => {
      for (const mk of yorliqlar.current) mk.remove()
      yorliqlar.current = []
    },
    [],
  )

  return relyefKorinsin ? meta : null
}
