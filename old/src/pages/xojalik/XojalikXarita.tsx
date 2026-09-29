import { useEffect, useRef, useState } from 'react'
import { Map as MapLibreMap, Marker, ScaleControl } from 'maplibre-gl'
import type { GeoJSONSourceSpecification, Map as MlMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KONTUR_CHEGARA } from '@/lib/ranglar'
import { halqaMaydon, tashqiHalqalar, yorliqNuqta, type Bbox, type XojalikFC } from './turlar'

/** Konturlarga moslashda chetdan bo'sh joy, px */
const CHET = 60
/** Bitta kontur juda kichik bo'lsa ham haddan tashqari yaqinlashmasin */
const MAX_YAQIN = 17

export interface XojalikXaritaAPI {
  zoom: (d: number) => void
  hammasi: () => void
  konturga: (id: number) => void
}

export function XojalikXarita({
  fc,
  umumiy,
  chegaralar,
  tanlangan,
  hover,
  onTanla,
  onHover,
  apiRef,
}: {
  fc: XojalikFC
  /** Barcha konturlar extenti */
  umumiy: Bbox
  /** Har bir kontur extenti — id bo'yicha */
  chegaralar: Map<number, Bbox>
  tanlangan: number | null
  hover: number | null
  onTanla: (id: number | null) => void
  onHover: (id: number | null) => void
  apiRef: React.RefObject<XojalikXaritaAPI | null>
}) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MlMap | null>(null)
  const [stylTayyor, setStylTayyor] = useState(false)
  const [tayyor, setTayyor] = useState(false)

  // Hodisa tinglovchilari har doim oxirgi callback'larni chaqirsin
  const cb = useRef({ onTanla, onHover })
  useEffect(() => {
    cb.current = { onTanla, onHover }
  }, [onTanla, onHover])

  useEffect(() => {
    apiRef.current = {
      zoom: (d) => map.current?.easeTo({ zoom: map.current.getZoom() + d, duration: 250 }),
      hammasi: () =>
        map.current?.fitBounds(umumiy, { padding: CHET, maxZoom: MAX_YAQIN, duration: 600 }),
      konturga: (id) => {
        const b = chegaralar.get(id)
        if (b)
          map.current?.fitBounds(b, {
            padding: 120,
            maxZoom: 15.5,
            duration: 700,
          })
      },
    }
  }, [apiRef, umumiy, chegaralar])

  // ---------------------------------------------------------- xaritani qurish
  useEffect(() => {
    if (!box.current) return

    const m = new MapLibreMap({
      container: box.current,
      bounds: umumiy,
      fitBoundsOptions: { padding: CHET, maxZoom: MAX_YAQIN },
      minZoom: 5,
      maxZoom: 19,
      attributionControl: { compact: true },
      style: {
        version: 8,
        // `glyphs` ataylab yo'q — matn qatlami ishlatilmaydi (Xarita.tsx ga qarang)
        sources: {
          sputnik: {
            type: 'raster',
            tiles: [0, 1, 2, 3].map(
              (i) => `https://mt${i}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}`,
            ),
            tileSize: 256,
            maxzoom: 20,
            attribution: '© Google',
          },
          konturlar: {
            type: 'geojson',
            data: fc as unknown as GeoJSONSourceSpecification['data'],
          },
        },
        layers: [
          { id: 'fon', type: 'background', paint: { 'background-color': '#f5f6f8' } },
          { id: 'sputnik', type: 'raster', source: 'sputnik' },
          {
            id: 'kontur-fill',
            type: 'fill',
            source: 'konturlar',
            paint: {
              'fill-color': '#469d18',
              'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'tanlangan'], false],
                0.36,
                ['boolean', ['feature-state', 'hover'], false],
                0.38,
                0.25,
              ],
            },
          },
          {
            id: 'kontur-line',
            type: 'line',
            source: 'konturlar',
            paint: {
              'line-color': KONTUR_CHEGARA,
              'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.4, 16, 2.4],
            },
          },
          {
            id: 'kontur-hover',
            type: 'line',
            source: 'konturlar',
            paint: {
              'line-color': '#ffffff',
              'line-width': 2.6,
              'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0],
            },
          },
          {
            id: 'kontur-tanlangan',
            type: 'line',
            source: 'konturlar',
            paint: {
              'line-color': '#2ed0ff',
              'line-width': 3.6,
              'line-opacity': ['case', ['boolean', ['feature-state', 'tanlangan'], false], 1, 0],
            },
          },
        ],
      },
    })

    m.addControl(new ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left')
    m.on('error', (e) => console.error('[xarita]', e.error?.message ?? e))

    m.on('load', () => {
      setStylTayyor(true)
      m.once('idle', () => setTayyor(true))
    })

    m.on('mousemove', (e) => {
      const f = m.queryRenderedFeatures(e.point, { layers: ['kontur-fill'] })[0]
      const id = f && f.id !== undefined ? Number(f.id) : null
      m.getCanvas().style.cursor = id === null ? '' : 'pointer'
      cb.current.onHover(id)
    })
    m.on('mouseout', () => {
      m.getCanvas().style.cursor = ''
      cb.current.onHover(null)
    })
    // Umumiy `click` — chiziq qatlamlari to'ldirish ustida turadi
    m.on('click', (e) => {
      const f = m.queryRenderedFeatures(e.point, { layers: ['kontur-fill'] })[0]
      cb.current.onTanla(f && f.id !== undefined ? Number(f.id) : null)
    })

    // Kontur raqami yorlig'i — HTML marker: style'da glyphs yo'q (Xarita.tsx ga qarang),
    // konturlar soni kam, shuning uchun symbol qatlami shart emas
    const maydon = new Map(
      fc.features.map((f) => [f.id, tashqiHalqalar(f.geometry).reduce((s, h) => s + halqaMaydon(h), 0)]),
    )
    for (const f of fc.features) {
      const raqam = f.properties.contour_number
      if (raqam == null) continue
      // Ustma-ust tushgan kichikroq konturlar — yorliq ularning ustiga tushmasin
      const b = chegaralar.get(f.id)!
      const tosiqlar = fc.features
        .filter((o) => {
          if (o.id === f.id || maydon.get(o.id)! >= maydon.get(f.id)!) return false
          const ob = chegaralar.get(o.id)!
          return ob[0] < b[2] && ob[2] > b[0] && ob[1] < b[3] && ob[3] > b[1]
        })
        .flatMap((o) => tashqiHalqalar(o.geometry))
      const el = document.createElement('div')
      el.className = 'kontur-yorliq'
      el.textContent = String(raqam)
      new Marker({ element: el }).setLngLat(yorliqNuqta(f.geometry, tosiqlar)).addTo(m)
    }

    map.current = m
    return () => {
      m.remove()
      map.current = null
      // StrictMode qayta mount qilganda yangi xarita `load` ni kutsin
      setStylTayyor(false)
      setTayyor(false)
    }
  }, [fc, umumiy, chegaralar])

  // ------------------------------------------- hover va tanlov — feature-state
  const oldingi = useRef<{ hover: number | null; tanlangan: number | null }>({
    hover: null,
    tanlangan: null,
  })
  useEffect(() => {
    const m = map.current
    if (!m || !stylTayyor) return
    const o = oldingi.current
    const qoy = (id: number | null, kalit: 'hover' | 'tanlangan', v: boolean) => {
      if (id !== null) m.setFeatureState({ source: 'konturlar', id }, { [kalit]: v })
    }
    qoy(o.hover, 'hover', false)
    qoy(o.tanlangan, 'tanlangan', false)
    qoy(hover, 'hover', true)
    qoy(tanlangan, 'tanlangan', true)
    oldingi.current = { hover, tanlangan }
  }, [hover, tanlangan, stylTayyor])

  return (
    <div className="relative size-full">
      <div ref={box} className="size-full" />
      <div
        className={cn(
          'absolute inset-0 z-40 flex flex-col items-center justify-center gap-2.5 bg-paper transition-opacity duration-300',
          tayyor && 'pointer-events-none opacity-0',
        )}
        aria-hidden={tayyor}
      >
        <Loader2 className="size-6 animate-spin text-leaf" />
        <span className="text-[12px] text-muted">Xarita yuklanmoqda</span>
      </div>
    </div>
  )
}
